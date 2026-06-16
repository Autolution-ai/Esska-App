import { NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/esska/server";

/**
 * Loescht einen Mitarbeiter vollstaendig: Auth-User und alle abhaengigen
 * Tabellen (Profil, Schichten, Verfuegbarkeiten, KuBe, Dokumente) werden
 * durch ON DELETE CASCADE in der Datenbank automatisch mitgeloescht.
 *
 * Verhindert das Loeschen des aktuell eingeloggten Admins – sonst koennte
 * der Admin sich selbst aussperren.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requireAdmin();
        if (guard instanceof NextResponse) return guard;
        const { adminClient } = guard;

        const { id: userId } = await context.params;

        const userClient = await createSSRClient();
        const { data: { user: currentUser } } = await userClient.auth.getUser();
        if (currentUser && currentUser.id === userId) {
            return NextResponse.json(
                { error: "Du kannst deinen eigenen Account nicht löschen." },
                { status: 400 }
            );
        }

        const { error } = await adminClient.auth.admin.deleteUser(userId);
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Löschen fehlgeschlagen";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
