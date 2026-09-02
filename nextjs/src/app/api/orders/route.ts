// Bestell-Mails (B-3/B-5):
//   aktion "melden":       Bestellung per E-Mail an den Regionalmanager des
//                          Centers (B-3). Ohne Manager geht sie ersatzweise
//                          an das Esska-Postfach (SMTP_USER).
//   aktion "weiterleiten": Admin/Manager schickt die Bestellung an das Lager
//                          (B-5). Die Lager-Adresse kommt aus der Vercel-
//                          Umgebungsvariable LAGER_EMAIL und kann jederzeit
//                          nachgereicht werden - bis dahin kommt eine klare
//                          Fehlermeldung. Setzt den Status auf 'weitergeleitet'.

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";
import { sendeMail } from "@/lib/esska/mail";
import type { EsskaBestellArtikel, EsskaBestellung, EsskaBestellungPosition, EsskaCenter, EsskaProfile } from "@/lib/esska/types";

type Beteiligte = {
    bestellung: EsskaBestellung;
    positionen: (EsskaBestellungPosition & { artikel: EsskaBestellArtikel | null })[];
    center: EsskaCenter | null;
    besteller: Pick<EsskaProfile, "vorname" | "nachname" | "email"> | null;
    manager: Pick<EsskaProfile, "vorname" | "nachname" | "email"> | null;
};

async function lade(db: SupabaseClient, bestellungId: string): Promise<Beteiligte | null> {
    const { data: b } = await db.from("bestellungen").select("*").eq("id", bestellungId).maybeSingle();
    if (!b) return null;
    const bestellung = b as EsskaBestellung;
    const [pRes, cRes, uRes] = await Promise.all([
        db.from("bestellung_positionen").select("*, bestell_artikel(*)").eq("bestellung_id", bestellungId),
        db.from("centers").select("*").eq("id", bestellung.center_id).maybeSingle(),
        db.from("profiles").select("vorname, nachname, email").eq("id", bestellung.besteller_id).maybeSingle(),
    ]);
    const center = (cRes.data as EsskaCenter | null) ?? null;
    let manager: Beteiligte["manager"] = null;
    if (center?.manager_id) {
        const { data: m } = await db
            .from("profiles")
            .select("vorname, nachname, email")
            .eq("id", center.manager_id)
            .maybeSingle();
        manager = (m as Beteiligte["manager"]) ?? null;
    }
    return {
        bestellung,
        positionen: (((pRes.data as unknown) as Array<EsskaBestellungPosition & { bestell_artikel: EsskaBestellArtikel | null }>) ?? [])
            .map((p) => ({ ...p, artikel: p.bestell_artikel })),
        center,
        besteller: (uRes.data as Beteiligte["besteller"]) ?? null,
        manager,
    };
}

function mailText(d: Beteiligte): string {
    const name = d.besteller
        ? `${d.besteller.vorname ?? ""} ${d.besteller.nachname ?? ""}`.trim() || (d.besteller.email ?? "?")
        : "?";
    const zeilen = d.positionen.map((p) => {
        const einheit = p.artikel && p.artikel.einheit_groesse > 1
            ? ` ${p.artikel.einheit_label}`
            : p.artikel ? ` ${p.artikel.einheit_label}` : "";
        return `  - ${p.menge} x${einheit} ${p.artikel?.name ?? "?"}${p.farbe ? ` (${p.farbe})` : ""}`;
    });
    return (
        `Bestellung fuer ${d.center ? `${d.center.name} (${d.center.kuerzel}), ${d.center.stadt}` : "?"}\n` +
        `Bestellt von: ${name}\n` +
        `Zeitpunkt: ${new Date(d.bestellung.erstellt_am).toLocaleString("de-DE")}\n\n` +
        `Positionen:\n${zeilen.join("\n")}\n` +
        (d.bestellung.notiz ? `\nNotiz: ${d.bestellung.notiz}\n` : "") +
        `\nDiese E-Mail wurde automatisch von der Esska-App verschickt.`
    );
}

export async function POST(request: Request) {
    try {
        const userClient = await createSSRClient();
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

        const body = await request.json();
        const bestellungId: string | undefined = body?.bestellungId;
        const aktion: string | undefined = body?.aktion;
        if (!bestellungId || !aktion || !["melden", "weiterleiten"].includes(aktion)) {
            return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
        }

        const db = (await createServerAdminClient()) as unknown as SupabaseClient;
        const daten = await lade(db, bestellungId);
        if (!daten) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });

        // Berechtigung
        const { data: profil } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
        const rolle = (profil as { role?: string } | null)?.role;
        const istAdmin = rolle === "admin";
        const istManagerDesCenters = daten.center?.manager_id === user.id;
        const istBesteller = daten.bestellung.besteller_id === user.id;

        if (aktion === "melden") {
            if (!istBesteller && !istAdmin && !istManagerDesCenters) {
                return NextResponse.json({ error: "Keine Berechtigung für diese Bestellung." }, { status: 403 });
            }
            const empfaenger = daten.manager?.email ?? process.env.SMTP_USER ?? null;
            if (!empfaenger) {
                return NextResponse.json({ error: "Kein Empfänger ermittelbar (weder Manager noch SMTP_USER)." }, { status: 500 });
            }
            await sendeMail({
                an: empfaenger,
                betreff: `Neue Warenbestellung – ${daten.center?.name ?? "?"} (${daten.center?.kuerzel ?? "?"})`,
                text: mailText(daten),
            });
            return NextResponse.json({
                ok: true,
                empfaenger,
                hinweis: daten.manager?.email
                    ? null
                    : "Diesem Center ist kein Regionalmanager zugeordnet – die Bestellung ging an das Esska-Postfach.",
            });
        }

        // weiterleiten
        if (!istAdmin && !istManagerDesCenters) {
            return NextResponse.json({ error: "Weiterleiten dürfen nur Admin oder der zuständige Regionalmanager." }, { status: 403 });
        }
        const lager = process.env.LAGER_EMAIL;
        if (!lager) {
            return NextResponse.json(
                { error: "Die Lager-E-Mail-Adresse ist noch nicht hinterlegt (Vercel-Umgebungsvariable LAGER_EMAIL). Sobald sie eingetragen ist, funktioniert dieser Button." },
                { status: 400 }
            );
        }
        await sendeMail({
            an: lager,
            betreff: `Warenbestellung – ${daten.center?.name ?? "?"} (${daten.center?.kuerzel ?? "?"}), ${new Date(daten.bestellung.erstellt_am).toLocaleDateString("de-DE")}`,
            text: mailText(daten),
        });
        const { error: updErr } = await db
            .from("bestellungen")
            .update({ status: "weitergeleitet", weitergeleitet_am: new Date().toISOString() })
            .eq("id", bestellungId);
        if (updErr) throw new Error(updErr.message);
        return NextResponse.json({ ok: true, empfaenger: lager });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unbekannter Fehler." },
            { status: 500 }
        );
    }
}
