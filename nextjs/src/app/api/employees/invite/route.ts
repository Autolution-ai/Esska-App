import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STARTPASSWORT_FEHLT, origin, requireAdminOderRegional, startpasswort } from "@/lib/esska/server";
import { sendeMail, smtpKonfiguriert } from "@/lib/esska/mail";
import { zugangsMailBetreff, zugangsMailHtml, zugangsMailText } from "@/lib/esska/zugangsmail";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

export async function POST(request: Request) {
    try {
        const guard = await requireAdminOderRegional();
        if (guard instanceof NextResponse) return guard;
        const { adminClient, userId, rolle } = guard;

        const body = await request.json();
        const email: string | undefined = body?.email;
        // M-1: optionale Center-Zuordnung direkt beim Einladen
        const centerId: string | undefined = body?.centerId || undefined;
        // Rueckkehrer aus der Vorsaison: verkuerzter Personalfragebogen.
        // Nur hier setzbar - der Mitarbeiter selbst kann es nicht (Trigger).
        const rueckkehrer = body?.rueckkehrer === true;
        // Beschaeftigungsart und Vertragskonditionen (optional). Der Server
        // prueft selbst nach - die Browser-Pruefung ist nur Komfort.
        const ARTEN = ["minijob", "kurzfristig", "werkstudent", "teilzeit", "vollzeit"];
        const art: string | null = ARTEN.includes(body?.art) ? body.art : null;
        const v = body?.vertrag ?? null;
        const istDatum = (x: unknown) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
        let vertrag: {
            beginn: string;
            befristet_bis: string | null;
            stunden_pro_woche: number | null;
            stundenlohn_cent: number | null;
        } | null = null;
        if (v && art) {
            const stunden = v.stunden_pro_woche === null ? null : Number(v.stunden_pro_woche);
            const lohn = v.stundenlohn_cent === null ? null : Number(v.stundenlohn_cent);
            const ok =
                istDatum(v.beginn) &&
                (v.befristet_bis === null || (istDatum(v.befristet_bis) && v.befristet_bis >= v.beginn)) &&
                (stunden === null || (Number.isFinite(stunden) && stunden > 0 && stunden <= 60)) &&
                (lohn === null || (Number.isInteger(lohn) && lohn > 0));
            if (!ok) {
                return NextResponse.json({ error: "Die Vertragsangaben sind unvollständig oder ungültig." }, { status: 400 });
            }
            vertrag = { beginn: v.beginn, befristet_bis: v.befristet_bis, stunden_pro_woche: stunden, stundenlohn_cent: lohn };
        }
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return NextResponse.json({ error: "Ungültige E-Mail-Adresse." }, { status: 400 });
        }

        const db = (await createServerAdminClient()) as unknown as SupabaseClient;

        // Regionalmanager legen nur fuer ihre eigenen Center an - die
        // Zuordnung ist fuer sie Pflicht, sonst laege die Person ausserhalb
        // ihres Bereichs und sie koennten sie danach nicht mehr sehen.
        if (rolle === "regionalmanager") {
            if (!centerId) {
                return NextResponse.json({ error: "Bitte ein Center auswählen." }, { status: 400 });
            }
            // Zustaendig ist er, wenn er am Center als Regionalmanager steht
            // ODER dem Center zugeordnet ist (wie manages_center in der DB).
            const [{ data: alsManager }, { data: alsZugeordnet }] = await Promise.all([
                db.from("centers").select("id").eq("id", centerId).eq("manager_id", userId).maybeSingle(),
                db
                    .from("center_assignments")
                    .select("center_id")
                    .eq("center_id", centerId)
                    .eq("profile_id", userId)
                    .maybeSingle(),
            ]);
            if (!alsManager && !alsZugeordnet) {
                return NextResponse.json(
                    { error: "Du kannst nur Mitarbeiter für deine eigenen Center anlegen." },
                    { status: 403 }
                );
            }
        }

        // Kein Einladungslink mehr (Vorgabe Oktober 2026): Das Konto wird
        // direkt mit dem gemeinsamen Startpasswort angelegt und ist sofort
        // nutzbar. Die Zugangsdaten gibt der Admin selbst weiter.
        const passwort = startpasswort();
        if (!passwort) {
            return NextResponse.json({ error: STARTPASSWORT_FEHLT }, { status: 500 });
        }
        const { data, error } = await adminClient.auth.admin.createUser({
            email,
            password: passwort,
            email_confirm: true,
        });

        if (error) {
            const msg = /already|registered|exists/i.test(error.message)
                ? "Für diese E-Mail-Adresse gibt es bereits einen Zugang."
                : error.message;
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        // Zuordnung anlegen, sobald der Auth-User (und damit per Trigger das
        // Profil) existiert. Ein Fehler hier soll die Einladung nicht
        // zuruecknehmen - er wird der Antwort als Hinweis mitgegeben.
        let zuordnungHinweis: string | null = null;
        if (rueckkehrer && data.user?.id) {
            const { error: rErr } = await db
                .from("profiles")
                .update({ rueckkehrer: true })
                .eq("id", data.user.id);
            if (rErr) {
                zuordnungHinweis = `Einladung verschickt, aber die Markierung als Rückkehrer schlug fehl: ${rErr.message}`;
            }
        }
        if (centerId && data.user?.id) {
            const { error: aErr } = await db
                .from("center_assignments")
                .insert({ center_id: centerId, profile_id: data.user.id });
            if (aErr) {
                zuordnungHinweis = `Einladung verschickt, aber die Center-Zuordnung schlug fehl: ${aErr.message}`;
            }
        }

        // Beschaeftigungsart und Wochenstunden ans Profil, Vertrag anlegen
        if (art && data.user?.id) {
            const { error: pErr } = await db
                .from("profiles")
                .update({
                    arbeitszeit_modell: art,
                    ...(vertrag?.stunden_pro_woche ? { stunden_pro_woche: vertrag.stunden_pro_woche } : {}),
                })
                .eq("id", data.user.id);
            if (pErr) zuordnungHinweis = `Zugang angelegt, aber die Beschäftigungsart wurde nicht gespeichert: ${pErr.message}`;
        }
        if (vertrag && art && data.user?.id) {
            const { error: vErr } = await db.from("arbeitsvertraege").insert({
                profile_id: data.user.id,
                art,
                center_id: centerId ?? null,
                ...vertrag,
                erstellt_von: userId,
            });
            if (vErr) zuordnungHinweis = `Zugang angelegt, aber der Vertrag wurde nicht gespeichert: ${vErr.message}`;
        }

        // Zugangsdaten per E-Mail an die neue Person. Scheitert der Versand,
        // bleibt das Konto bestehen - die Daten werden dann zum Kopieren
        // angezeigt (z. B. fuer WhatsApp).
        const zugang = { url: origin(request), email, passwort };
        let mailVerschickt = false;
        let mailHinweis: string | null = null;
        if (smtpKonfiguriert()) {
            try {
                await sendeMail({
                    an: email,
                    betreff: zugangsMailBetreff(),
                    text: zugangsMailText(zugang),
                    html: zugangsMailHtml(zugang),
                });
                mailVerschickt = true;
            } catch (mErr) {
                mailHinweis = `Die E-Mail mit den Zugangsdaten konnte nicht verschickt werden (${
                    mErr instanceof Error ? mErr.message : "unbekannter Fehler"
                }). Bitte die Daten unten selbst weitergeben.`;
            }
        } else {
            mailHinweis = "E-Mail-Versand ist nicht eingerichtet – bitte die Zugangsdaten unten selbst weitergeben.";
        }

        // Zugangsdaten fuer die Weitergabe (nur an Admins/Regionalmanager)
        return NextResponse.json({
            ok: true,
            user_id: data.user?.id ?? null,
            hinweis: [zuordnungHinweis, mailHinweis].filter(Boolean).join(" ") || null,
            mail_verschickt: mailVerschickt,
            zugang,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Einladung fehlgeschlagen";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
