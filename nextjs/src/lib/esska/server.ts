// Server-seitige Hilfsfunktionen, die in mehreren API-Routen gebraucht werden.

import { NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

type ProfileLookup = {
    from: (t: string) => {
        select: (c: string) => {
            eq: (k: string, v: string) => {
                single: () => Promise<{ data: { role: string } | null; error: { message: string } | null }>;
            };
        };
    };
};

type AdminAuthClient = {
    auth: {
        admin: {
            inviteUserByEmail: (
                email: string,
                options?: { redirectTo?: string }
            ) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
            deleteUser: (
                id: string
            ) => Promise<{ data: unknown; error: { message: string } | null }>;
            getUserById: (
                id: string
            ) => Promise<{ data: { user: { id: string; email: string | null } | null }; error: { message: string } | null }>;
            generateLink: (params: {
                type: "invite" | "magiclink" | "recovery";
                email: string;
                options?: { redirectTo?: string };
            }) => Promise<{ data: { properties?: { action_link?: string } | null }; error: { message: string } | null }>;
        };
    };
};

/** Prueft, ob der aktuelle User Admin ist. Liefert entweder den Admin-Client
 *  oder eine NextResponse mit passendem Fehlercode (401 / 403). */
export async function requireAdmin(): Promise<NextResponse | { adminClient: AdminAuthClient }> {
    const userClient = await createSSRClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    const { data: profile, error } = await (userClient as unknown as ProfileLookup)
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    if (error) {
        return NextResponse.json({ error: "Profil nicht gefunden" }, { status: 403 });
    }
    if (profile?.role !== "admin") {
        return NextResponse.json({ error: "Diese Aktion ist nur für Admins erlaubt." }, { status: 403 });
    }
    const admin = await createServerAdminClient();
    return { adminClient: admin as unknown as AdminAuthClient };
}

export function origin(request: Request): string {
    return (
        request.headers.get("origin") ??
        `${request.headers.get("x-forwarded-proto") ?? "http"}://${request.headers.get("host")}`
    );
}
