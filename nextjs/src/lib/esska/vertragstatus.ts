// Clientseitige Hilfen: welcher Arbeitsvertrag gilt fuer eine Person und
// ist der Vertragsschritt erledigt? (ohne pdf-lib, damit das Bundle klein bleibt)

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EsskaArbeitsvertrag } from "@/lib/esska/types";
import { layoutFuer } from "@/lib/esska/vertragslayouts";

/** Offener Vertrag, sonst der zuletzt unterschriebene, sonst null. */
export async function ladeAktuellenVertrag(
    client: SupabaseClient,
    profileId: string
): Promise<EsskaArbeitsvertrag | null> {
    const { data, error } = await client
        .from("arbeitsvertraege")
        .select("*")
        .eq("profile_id", profileId)
        .order("erstellt_am", { ascending: false });
    if (error) throw error;
    const alle = (data as EsskaArbeitsvertrag[]) ?? [];
    return alle.find((v) => !v.unterschrieben_am) ?? alle[0] ?? null;
}

/** Laesst sich dieser Vertrag in der App ausfuellen und unterschreiben?
 *  (Layout fuer die Art bekannt UND aktive Vorlage hinterlegt) */
export async function unterschreibbar(client: SupabaseClient, v: EsskaArbeitsvertrag | null): Promise<boolean> {
    if (!v || !layoutFuer(v.art)) return false;
    if (v.unterschrieben_am) return true;
    const { data } = await client
        .from("vertragsvorlagen")
        .select("id")
        .eq("art", v.art)
        .eq("aktiv", true)
        .maybeSingle();
    return !!data;
}

/** Stand des Arbeitsvertrags fuer den Mitarbeiter.
 *  zugewiesen: Admin/Regionalmanager hat schon einen Vertrag angelegt.
 *  erledigt: unterschrieben (ausfuellbarer Vertrag) bzw. bestaetigt (Vorlage
 *  ohne Ausfuellen) - oder noch kein Vertrag zugewiesen bzw. keine Vorlage. */
export async function vertragsstand(
    client: SupabaseClient,
    profileId: string
): Promise<{ zugewiesen: boolean; erledigt: boolean }> {
    const v = await ladeAktuellenVertrag(client, profileId);
    if (!v) return { zugewiesen: false, erledigt: true };
    if (await unterschreibbar(client, v)) return { zugewiesen: true, erledigt: !!v.unterschrieben_am };

    const { data: vData } = await client
        .from("vertragsvorlagen")
        .select("id")
        .eq("art", v.art)
        .eq("aktiv", true)
        .maybeSingle();
    const vorlageId = (vData as { id: string } | null)?.id;
    if (!vorlageId) return { zugewiesen: true, erledigt: true };
    const { data: bData } = await client
        .from("vertragsbestaetigungen")
        .select("id")
        .eq("profile_id", profileId)
        .eq("vorlage_id", vorlageId)
        .maybeSingle();
    return { zugewiesen: true, erledigt: !!bData };
}
