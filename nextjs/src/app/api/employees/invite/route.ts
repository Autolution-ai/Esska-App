import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { origin, requireAdmin } from "@/lib/esska/server";
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
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return NextResponse.json({ error: "Ungültige E-Mail-Adresse." }, { status: 400 });
        }

        const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${origin(request)}/auth/accept-invite`,
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Zuordnung anlegen, sobald der Auth-User (und damit per Trigger das
        // Profil) existiert. Ein Fehler hier soll die Einladung nicht
        // zuruecknehmen - er wird der Antwort als Hinweis mitgegeben.
        let zuordnungHinweis: string | null = null;
        if (centerId && data.user?.id) {
            const db = (await createServerAdminClient()) as unknown as SupabaseClient;
            const { error: aErr } = await db
                .from("center_assignments")
                .insert({ center_id: centerId, profile_id: data.user.id });
            if (aErr) {
                zuordnungHinweis = `Einladung verschickt, aber die Center-Zuordnung schlug fehl: ${aErr.message}`;
            }
        }

        return NextResponse.json({ ok: true, user_id: data.user?.id ?? null, hinweis: zuordnungHinweis });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Einladung fehlgeschlagen";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
