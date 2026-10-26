// Nach dem Veroeffentlichen eines Wochenplans: jede eingeplante Person
// bekommt ihre Schichten dieser Woche per E-Mail.
// Aufruf nur durch Admin oder zustaendigen Regionalmanager.

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";
import { origin } from "@/lib/esska/server";
import { sendeMail, smtpKonfiguriert } from "@/lib/esska/mail";
import { schichtMailBetreff, schichtMailHtml, schichtMailText, type SchichtZeile } from "@/lib/esska/schichtmail";

type Woche = { id: string; center_id: string; woche_start: string; veroeffentlicht: boolean };
type Schicht = { profile_id: string; datum: string; start_zeit: string; end_zeit: string };
type Person = { id: string; vorname: string | null; email: string | null };

function datumDe(iso: string): string {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
}

export async function POST(request: Request) {
    try {
        const userClient = await createSSRClient();
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

        const body = await request.json().catch(() => null);
        const wocheId: string | undefined = body?.wocheId;
        if (!wocheId) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

        const db = (await createServerAdminClient()) as unknown as SupabaseClient;

        const { data: wData } = await db
            .from("shift_weeks")
            .select("id, center_id, woche_start, veroeffentlicht")
            .eq("id", wocheId)
            .maybeSingle();
        const woche = wData as Woche | null;
        if (!woche) return NextResponse.json({ error: "Wochenplan nicht gefunden." }, { status: 404 });

        // Berechtigung: Admin oder zustaendiger Regionalmanager (am Center
        // eingetragen oder dem Center zugeordnet - wie manages_center).
        const { data: profil } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
        const rolle = (profil as { role?: string } | null)?.role;
        let darf = rolle === "admin";
        if (!darf && rolle === "regionalmanager") {
            const [{ data: alsManager }, { data: alsZugeordnet }] = await Promise.all([
                db.from("centers").select("id").eq("id", woche.center_id).eq("manager_id", user.id).maybeSingle(),
                db
                    .from("center_assignments")
                    .select("center_id")
                    .eq("center_id", woche.center_id)
                    .eq("profile_id", user.id)
                    .maybeSingle(),
            ]);
            darf = !!alsManager || !!alsZugeordnet;
        }
        if (!darf) return NextResponse.json({ error: "Keine Berechtigung für diesen Wochenplan." }, { status: 403 });

        if (!woche.veroeffentlicht) {
            return NextResponse.json({ error: "Der Wochenplan ist nicht veröffentlicht." }, { status: 400 });
        }
        if (!smtpKonfiguriert()) {
            return NextResponse.json({ error: "E-Mail-Versand ist nicht eingerichtet." }, { status: 500 });
        }

        const [{ data: cData }, { data: sData }] = await Promise.all([
            db.from("centers").select("name, kuerzel").eq("id", woche.center_id).maybeSingle(),
            db
                .from("shifts")
                .select("profile_id, datum, start_zeit, end_zeit")
                .eq("shift_week_id", woche.id)
                .order("datum")
                .order("start_zeit"),
        ]);
        const center = cData as { name: string; kuerzel: string } | null;
        const schichten = (sData as Schicht[]) ?? [];
        if (schichten.length === 0) {
            return NextResponse.json({ ok: true, verschickt: 0, ohneEmail: 0, fehlgeschlagen: [] });
        }

        const ids = [...new Set(schichten.map((s) => s.profile_id))];
        const { data: pData } = await db.from("profiles").select("id, vorname, email").in("id", ids);
        const personen = new Map(((pData as Person[]) ?? []).map((p) => [p.id, p]));

        const ende = new Date(woche.woche_start);
        ende.setDate(ende.getDate() + 6);
        const wocheText = `${datumDe(woche.woche_start)} – ${datumDe(ende.toISOString().slice(0, 10))}`;
        const centerName = center ? `${center.name} (${center.kuerzel})` : "dein Center";
        const url = origin(request);

        let verschickt = 0;
        let ohneEmail = 0;
        const fehlgeschlagen: string[] = [];
        for (const id of ids) {
            const p = personen.get(id);
            if (!p?.email) {
                ohneEmail++;
                continue;
            }
            const meine: SchichtZeile[] = schichten
                .filter((s) => s.profile_id === id)
                .map((s) => ({ datum: s.datum, start: s.start_zeit.slice(0, 5), ende: s.end_zeit.slice(0, 5) }));
            const daten = { vorname: p.vorname, center: centerName, woche: wocheText, schichten: meine, url };
            try {
                await sendeMail({
                    an: p.email,
                    betreff: schichtMailBetreff(centerName, wocheText),
                    text: schichtMailText(daten),
                    html: schichtMailHtml(daten),
                });
                verschickt++;
            } catch {
                // Einzelner Fehler (z. B. ungueltige Adresse) stoppt die anderen nicht
                fehlgeschlagen.push(p.email);
            }
        }

        return NextResponse.json({ ok: true, verschickt, ohneEmail, fehlgeschlagen });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Benachrichtigung fehlgeschlagen";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
