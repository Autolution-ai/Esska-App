// Esska-Client-Helper.
//
// Die vom Supabase-Template generierten Database-Typen kennen unsere neuen
// Tabellen (centers, profiles-Erweiterung, kube_declarations, ...) noch nicht.
// Bis wir die Typen via `supabase gen types` neu generieren, holen wir uns
// hier einen entkoppelten Client und kapseln die Esska-Modelle weiter in
// src/lib/esska/types.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSPASassClient } from "@/lib/supabase/client";

// Untypisierter Client, ueber den auf die Esska-Tabellen zugegriffen wird.
// Die Esska-Tabellen sind in src/lib/esska/types streng getypt; nur der
// Pfad durch `.from(tabelle)` wird hier locker gehandhabt.
export async function getEsskaClient(): Promise<SupabaseClient> {
    const sass = await createSPASassClient();
    return sass.getSupabaseClient() as unknown as SupabaseClient;
}
