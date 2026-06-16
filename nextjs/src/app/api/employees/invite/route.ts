import { NextResponse } from "next/server";
import { origin, requireAdmin } from "@/lib/esska/server";

export async function POST(request: Request) {
    try {
        const guard = await requireAdmin();
        if (guard instanceof NextResponse) return guard;
        const { adminClient } = guard;

        const body = await request.json();
        const email: string | undefined = body?.email;
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return NextResponse.json({ error: "Ungültige E-Mail-Adresse." }, { status: 400 });
        }

        const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${origin(request)}/auth/accept-invite`,
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true, user_id: data.user?.id ?? null });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Einladung fehlgeschlagen";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
