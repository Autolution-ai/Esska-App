import { NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

export async function POST(request: Request) {
    try {
        const userClient = await createSSRClient();
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
        }

        const { data: profile } = await (userClient as unknown as {
            from: (t: string) => {
                select: (c: string) => {
                    eq: (k: string, v: string) => {
                        single: () => Promise<{ data: { role: string } | null }>;
                    };
                };
            };
        })
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profile?.role !== "admin") {
            return NextResponse.json({ error: "Nur Admins dürfen einladen" }, { status: 403 });
        }

        const body = await request.json();
        const email: string | undefined = body?.email;
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return NextResponse.json({ error: "Ungültige E-Mail" }, { status: 400 });
        }

        const admin = await createServerAdminClient();
        const adminClient = admin as unknown as {
            auth: {
                admin: {
                    inviteUserByEmail: (
                        email: string,
                        options?: { redirectTo?: string }
                    ) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
                };
            };
        };

        const origin =
            request.headers.get("origin") ??
            `${request.headers.get("x-forwarded-proto") ?? "http"}://${request.headers.get("host")}`;

        const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${origin}/api/auth/callback`,
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
