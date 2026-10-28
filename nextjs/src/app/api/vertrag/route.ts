// Arbeitsvertrag zuweisen bzw. die Konditionen eines offenen Vertrags
// aendern (Admin oder zustaendiger Regionalmanager). Schreibt mit dem
// Client der angemeldeten Person - die Datenbankregeln entscheiden, ob sie
// das darf. Bei einem neuen Vertrag bekommt der Mitarbeiter eine E-Mail.

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";
import { origin } from "@/lib/esska/server";
import { sendeMail } from "@/lib/esska/mail";
import { VERTRAGSMAIL_BETREFF, vertragsMailHtml, vertragsMailText } from "@/lib/esska/vertragsmail";
import { BEFRISTETE_ARTEN, MINIJOB_MAX_STUNDEN, VERTRAGS_ARTEN, type EsskaArbeitszeitModell } from "@/lib/esska/types";

const istDatum = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);

export async function POST(request: Request) {
    try {
        const userClient = (await createSSRClient()) as unknown as SupabaseClient;
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
        const { data: ich } = await userClient.from("profiles").select("role").eq("id", user.id).single();
        const rolle = (ich as { role: string } | null)?.role;
        if (rolle !== "admin" && rolle !== "regionalmanager") {
            return NextResponse.json({ error: "Nur Admins und Regionalmanager können Verträge zuweisen." }, { status: 403 });
        }

        const b = await request.json().catch(() => null);
        const profileId = typeof b?.profile_id === "string" ? b.profile_id : null;
        const art = VERTRAGS_ARTEN.includes(b?.art) ? (b.art as string) : null;
        const centerId = typeof b?.center_id === "string" && b.center_id ? b.center_id : null;
        const stunden = b?.stunden_pro_woche === null || b?.stunden_pro_woche === undefined ? null : Number(b.stunden_pro_woche);
        const lohn = b?.stundenlohn_cent === null || b?.stundenlohn_cent === undefined ? null : Number(b.stundenlohn_cent);
        const bis = b?.befristet_bis || null;
        if (profileId === user.id) {
            return NextResponse.json(
                { error: "Den eigenen Arbeitsvertrag kannst du nicht selbst zuweisen – das macht ein Admin." },
                { status: 403 }
            );
        }
        if (!profileId) return NextResponse.json({ error: "Mitarbeiter fehlt." }, { status: 400 });
        if (!art) return NextResponse.json({ error: "Bitte „Kurzfristig“ oder „Minijob“ wählen." }, { status: 400 });
        if (!istDatum(b?.beginn)) return NextResponse.json({ error: "Bitte den Beginn angeben." }, { status: 400 });
        if (bis !== null && (!istDatum(bis) || bis < b.beginn)) {
            return NextResponse.json({ error: "„Befristet bis“ ist ungültig oder liegt vor dem Beginn." }, { status: 400 });
        }
        if (BEFRISTETE_ARTEN.includes(art as EsskaArbeitszeitModell) && !bis) {
            return NextResponse.json({ error: "Für diese Beschäftigungsart bitte ein Enddatum angeben." }, { status: 400 });
        }
        if (stunden === null || lohn === null) {
            return NextResponse.json({ error: "Bitte Stunden je Woche und Stundenlohn angeben." }, { status: 400 });
        }
        if (stunden !== null && (!Number.isFinite(stunden) || stunden <= 0 || stunden > 60)) {
            return NextResponse.json({ error: "Ungültige Wochenstunden." }, { status: 400 });
        }
        if (art === "minijob" && rolle !== "admin" && (stunden === null || stunden > MINIJOB_MAX_STUNDEN)) {
            return NextResponse.json(
                { error: `Beim Minijob sind höchstens ${MINIJOB_MAX_STUNDEN} Wochenstunden möglich.` },
                { status: 400 }
            );
        }
        if (lohn !== null && (!Number.isInteger(lohn) || lohn <= 0)) {
            return NextResponse.json({ error: "Ungültiger Stundenlohn." }, { status: 400 });
        }

        const felder = {
            art,
            center_id: centerId,
            beginn: b.beginn as string,
            befristet_bis: bis as string | null,
            stunden_pro_woche: stunden,
            stundenlohn_cent: lohn,
        };

        // Offener Vertrag vorhanden? Dann aendern, sonst neu anlegen.
        const { data: offen, error: oErr } = await userClient
            .from("arbeitsvertraege")
            .select("id")
            .eq("profile_id", profileId)
            .is("unterschrieben_am", null)
            .maybeSingle();
        if (oErr) throw oErr;
        const neu = !offen;
        const { error: wErr } = offen
            ? await userClient.from("arbeitsvertraege").update(felder).eq("id", (offen as { id: string }).id)
            : await userClient.from("arbeitsvertraege").insert({ ...felder, profile_id: profileId });
        if (wErr) {
            if (wErr.code === "42501") {
                return NextResponse.json({ error: "Für diesen Mitarbeiter bist du nicht zuständig." }, { status: 403 });
            }
            throw wErr;
        }

        // Ab hier ist klar, dass die Person zustaendig ist (die Datenbank hat
        // das Schreiben erlaubt): Beschaeftigungsart im Profil mitziehen.
        const db = (await createServerAdminClient()) as unknown as SupabaseClient;
        await db
            .from("profiles")
            .update({ arbeitszeit_modell: art, ...(stunden ? { stunden_pro_woche: stunden } : {}) })
            .eq("id", profileId);

        let hinweis: string | null = null;
        if (neu) {
            const { data: p } = await db.from("profiles").select("vorname, email").eq("id", profileId).maybeSingle();
            const person = p as { vorname: string | null; email: string | null } | null;
            if (person?.email) {
                try {
                    const url = origin(request);
                    await sendeMail({
                        an: person.email,
                        betreff: VERTRAGSMAIL_BETREFF,
                        text: vertragsMailText({ vorname: person.vorname, url }),
                        html: vertragsMailHtml({ vorname: person.vorname, url }),
                    });
                    hinweis = `Der Mitarbeiter wurde per E-Mail (${person.email}) benachrichtigt.`;
                } catch (e) {
                    hinweis = `Vertrag gespeichert, aber die E-Mail konnte nicht gesendet werden: ${e instanceof Error ? e.message : "Fehler"}`;
                }
            }
        }

        return NextResponse.json({ ok: true, neu, hinweis });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Speichern fehlgeschlagen" }, { status: 500 });
    }
}
