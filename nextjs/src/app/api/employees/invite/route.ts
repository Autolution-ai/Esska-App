import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STARTPASSWORT_FEHLT, origin, requireAdmin, startpasswort } from "@/lib/esska/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

export async function POST(request: Request) {
    try {
        const guard = await requireAdmin();
        if (guard instanceof NextResponse) return guard;
        const { adminClient } = guard;

        const body = await request.json();
        const email: string | undefined = body?.email;
        // M-1: optionale Center-Zuordnung direkt beim Einladen
        const centerId: string | undefined = body?.centerId || undefined;
        // Rueckkehrer aus der Vorsaison: verkuerzter Personalfragebogen.
        // Nur hier setzbar - der Mitarbeiter selbst kann es nicht (Trigger).
        const rueckkehrer = body?.rueckkehrer === true;
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return NextResponse.json({ error: "Ungültige E-Mail-Adresse." }, { status: 400 });
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
        const db = (await createServerAdminClient()) as unknown as SupabaseClient;
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

        // Zugangsdaten fuer die Weitergabe (nur an Admins, s. requireAdmin)
        return NextResponse.json({
            ok: true,
            user_id: data.user?.id ?? null,
            hinweis: zuordnungHinweis,
            zugang: { url: origin(request), email, passwort },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Einladung fehlgeschlagen";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
