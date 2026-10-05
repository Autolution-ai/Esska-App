import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STARTPASSWORT_FEHLT, origin, requireAdmin, startpasswort } from "@/lib/esska/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

// Setzt das Passwort eines Mitarbeiters auf das gemeinsame Startpasswort
// zurueck (ersetzt das fruehere "Erneut einladen" per E-Mail).
// Admin-Konten sind ausgenommen: Sie behalten ein eigenes Passwort.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requireAdmin();
        if (guard instanceof NextResponse) return guard;
        const { adminClient, userId: adminId } = guard;

        const passwort = startpasswort();
        if (!passwort) {
            return NextResponse.json({ error: STARTPASSWORT_FEHLT }, { status: 500 });
        }

        const { id: zielId } = await context.params;
        const db = (await createServerAdminClient()) as unknown as SupabaseClient;

        const { data: ziel, error: pErr } = await db
            .from("profiles")
            .select("id, role, email")
            .eq("id", zielId)
            .maybeSingle();
        if (pErr || !ziel) {
            return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
        }
        if ((ziel as { role: string }).role === "admin") {
            return NextResponse.json(
                { error: "Admin-Konten behalten ein eigenes Passwort und werden nicht auf das Startpasswort gesetzt." },
                { status: 400 }
            );
        }

        const { error } = await adminClient.auth.admin.updateUserById(zielId, { password: passwort });
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Nachvollziehbarkeit: Wer hat wann zurueckgesetzt? Wichtig, weil
        // danach jeder mit dem Startpasswort in dieses Konto kaeme.
        await db.from("profile_change_log").insert({
            profile_id: zielId,
            changed_by: adminId,
            feld: "passwort_zurueckgesetzt",
            alter_wert: null,
            neuer_wert: "auf Startpasswort zurueckgesetzt",
        });

        const email = (ziel as { email: string | null }).email;
        return NextResponse.json({ ok: true, zugang: { url: origin(request), email, passwort } });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Zurücksetzen fehlgeschlagen";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
