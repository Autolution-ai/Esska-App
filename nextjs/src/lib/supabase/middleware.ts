import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Bricht eine Promise nach `ms` Millisekunden mit `fallback` ab.
 *
 * Die Middleware laeuft in Vercels Edge-Runtime mit hartem Zeitlimit. Haengt
 * ein Supabase-Call (langsame Verbindung, Projekt im Ruhezustand, Ausfall),
 * antwortet die ganze Seite mit 504 MIDDLEWARE_INVOCATION_TIMEOUT – der
 * Nutzer sieht eine Vercel-Fehlerseite statt der App.
 *
 * Deshalb: lieber nach kurzer Zeit aufgeben und durchlassen. Das ist kein
 * Sicherheitsrisiko, weil die eigentliche Absicherung in der Datenbank sitzt
 * (Row Level Security). Ohne gueltige Session liefert jede Abfrage schlicht
 * keine Daten – die Middleware sorgt nur fuer die bequeme Weiterleitung.
 */
async function mitZeitlimit<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            promise,
            new Promise<T>((resolve) => {
                timer = setTimeout(() => resolve(fallback), ms)
            }),
        ])
    } catch {
        return fallback
    } finally {
        if (timer) clearTimeout(timer)
    }
}

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

    // Ohne Session-Cookie gar nicht erst bei Supabase nachfragen – spart auf
    // dem haeufigsten Pfad (nicht eingeloggter Besucher) einen Netzwerk-Call.
    const hatSessionCookie = request.cookies
        .getAll()
        .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))

    const authErgebnis = hatSessionCookie
        ? await mitZeitlimit(
              supabase.auth.getUser(),
              3000,
              { data: { user: null } } as Awaited<ReturnType<typeof supabase.auth.getUser>>
          )
        : ({ data: { user: null } } as Awaited<ReturnType<typeof supabase.auth.getUser>>)

    const user = authErgebnis.data.user

    if (!user) {
        // Kein Cookie -> sicher nicht eingeloggt -> zum Login.
        // Cookie vorhanden, aber Antwort blieb aus -> durchlassen; die Seite
        // selbst prueft die Session erneut und leitet noetigenfalls weiter.
        if (!hatSessionCookie) {
            const url = request.nextUrl.clone()
            url.pathname = '/auth/login'
            return NextResponse.redirect(url)
        }
        return supabaseResponse
    }

    // Onboarding-Gate: Mitarbeiter mit offenem Onboarding werden auf
    // /app/onboarding umgeleitet – unabhaengig davon, welche /app-Seite sie
    // aufrufen oder ueber welchen Link sie kommen.
    if (request.nextUrl.pathname !== '/app/onboarding') {
        const profilErgebnis = await mitZeitlimit(
            (supabase as unknown as {
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
                .eq('id', user.id)
                .maybeSingle(),
            2500,
            { data: null }
        )

        const profile = profilErgebnis.data
        if (profile && profile.role === 'mitarbeiter' && !profile.onboarding_abgeschlossen) {
            const url = request.nextUrl.clone()
            url.pathname = '/app/onboarding'
            return NextResponse.redirect(url)
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
