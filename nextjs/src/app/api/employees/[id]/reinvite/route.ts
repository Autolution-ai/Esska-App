import { NextResponse } from "next/server";
import { origin, requireAdmin } from "@/lib/esska/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requireAdmin();
        if (guard instanceof NextResponse) return guard;
        const { adminClient } = guard;

        const { id: userId } = await context.params;

        // E-Mail des Users holen
        const { data: userData, error: userErr } = await adminClient.auth.admin.getUserById(userId);
        if (userErr || !userData?.user) {
            return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
        }
        const email = userData.user.email;
        if (!email) {
            return NextResponse.json({ error: "Benutzer hat keine E-Mail-Adresse." }, { status: 400 });
        }

        // Frischen Invite-Link erzeugen (loest auch das Versenden der Mail aus)
        const { error } = await adminClient.auth.admin.generateLink({
            type: "invite",
            email,
            options: { redirectTo: `${origin(request)}/auth/accept-invite` },
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true, email });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Erneutes Einladen fehlgeschlagen";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
