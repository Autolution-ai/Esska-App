import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // IMPORTANT: DO NOT REMOVE auth.getUser()

    const {data: user} = await supabase.auth.getUser()
    if (
        (!user || !user.user) && request.nextUrl.pathname.startsWith('/app')
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        return NextResponse.redirect(url)
    }

    // Onboarding-Gate: Mitarbeiter mit offenem Onboarding werden auf
    // /app/onboarding umgeleitet – unabhaengig davon, welche /app-Seite sie
    // aufrufen oder ueber welchen Link sie kommen.
    if (user?.user && request.nextUrl.pathname.startsWith('/app')) {
        const path = request.nextUrl.pathname
        const istOnboardingSeite = path === '/app/onboarding'
        // API-Routen unter /api ignorieren (kommen ohnehin nicht durch dieses matcher),
        // Logout-/Settings-Route fuer Passwort/Abmelden zulassen
        if (!istOnboardingSeite) {
            const { data: profile } = await (supabase as unknown as {
                from: (t: string) => {
                    select: (c: string) => {
                        eq: (k: string, v: string) => {
                            maybeSingle: () => Promise<{
                                data: { role: string; onboarding_abgeschlossen: boolean } | null
                            }>
                        }
                    }
                }
            })
                .from('profiles')
                .select('role, onboarding_abgeschlossen')
                .eq('id', user.user.id)
                .maybeSingle()

            if (
                profile
                && profile.role === 'mitarbeiter'
                && !profile.onboarding_abgeschlossen
            ) {
                const url = request.nextUrl.clone()
                url.pathname = '/app/onboarding'
                return NextResponse.redirect(url)
            }
        }
    }

    // IMPORTANT: You *must* return the supabaseResponse object as it is.
    // If you're creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely!

    return supabaseResponse
}