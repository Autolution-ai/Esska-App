import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
    return await updateSession(request)
}

export const config = {
    // Die Middleware laeuft NUR auf den geschuetzten App-Seiten.
    //
    // Frueher lief sie auf jedem Pfad (auch auf der oeffentlichen Startseite,
    // den Auth- und Legal-Seiten). Dort ist keine Auth-Pruefung noetig, es
    // entstand aber trotzdem bei jedem Aufruf ein Netzwerk-Call zu Supabase.
    // War Supabase langsam (z. B. weil das Free-Tier-Projekt aus dem
    // Ruhezustand aufwachen musste), lief die Middleware in Vercels Timeout
    // und die Seite antwortete mit 504 MIDDLEWARE_INVOCATION_TIMEOUT.
    matcher: ['/app/:path*'],
}
