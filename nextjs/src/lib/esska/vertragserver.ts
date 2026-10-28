// Serverseitige Hilfen fuer Arbeitsvertraege: Daten zusammentragen und die
// Vorlage ausfuellen. NUR in API-Routen verwenden (nutzt den Admin-Client).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EsskaArbeitsvertrag, EsskaVertragsvorlage } from "@/lib/esska/types";
import { BEFRISTETE_ARTEN } from "@/lib/esska/types";
import { layoutFuer, type VertragsLayout } from "@/lib/esska/vertragslayouts";
import { betragDe, datumDe, stundenDe, type VertragsWerte } from "@/lib/esska/vertragpdf";

type Person = {
    id: string;
    vorname: string | null;
    nachname: string | null;
    anschrift_strasse: string | null;
    anschrift_plz: string | null;
    anschrift_ort: string | null;
    geburtsdatum: string | null;
};
type Center = { id: string; name: string; stadt: string };

export type VertragsDaten = {
    vertrag: EsskaArbeitsvertrag;
    person: Person;
    center: Center | null;
    vorlage: EsskaVertragsvorlage | null;
    layout: VertragsLayout | null;
};

/** Heutiges Datum in Deutschland als ISO (YYYY-MM-DD). */
export function heuteIso(): string {
    const teile = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
    return teile; // en-CA liefert YYYY-MM-DD
}

export async function ladeVertragsDaten(db: SupabaseClient, vertragId: string): Promise<VertragsDaten | null> {
    const { data: v } = await db.from("arbeitsvertraege").select("*").eq("id", vertragId).maybeSingle();
    const vertrag = v as EsskaArbeitsvertrag | null;
    if (!vertrag) return null;

    const [{ data: p }, { data: c }, { data: vo }] = await Promise.all([
        db
            .from("profiles")
            .select("id, vorname, nachname, anschrift_strasse, anschrift_plz, anschrift_ort, geburtsdatum")
            .eq("id", vertrag.profile_id)
            .maybeSingle(),
        vertrag.center_id
            ? db.from("centers").select("id, name, stadt").eq("id", vertrag.center_id).maybeSingle()
            : Promise.resolve({ data: null }),
        db.from("vertragsvorlagen").select("*").eq("art", vertrag.art).eq("aktiv", true).maybeSingle(),
    ]);
    if (!p) return null;

    // Ohne beim Vertrag hinterlegtes Center: das erste zugeordnete Center
    let center = c as Center | null;
    if (!center) {
        const { data: zu } = await db
            .from("center_assignments")
            .select("centers(id, name, stadt)")
            .eq("profile_id", vertrag.profile_id)
            .limit(1)
            .maybeSingle();
        center = ((zu as unknown) as { centers: Center | null } | null)?.centers ?? null;
    }

    return {
        vertrag,
        person: p as Person,
        center,
        vorlage: vo as EsskaVertragsvorlage | null,
        layout: layoutFuer(vertrag.art),
    };
}

/** Was fehlt, damit der Vertrag unterschrieben werden kann? (leer = nichts) */
export function fehlendeAngaben(d: VertragsDaten): string[] {
    const f: string[] = [];
    if (!d.person.vorname || !d.person.nachname) f.push("Vor- und Nachname");
    if (!d.person.anschrift_strasse || !d.person.anschrift_plz || !d.person.anschrift_ort) f.push("Anschrift");
    if (!d.center) f.push("Center (Arbeitsort)");
    if (BEFRISTETE_ARTEN.includes(d.vertrag.art) && !d.vertrag.befristet_bis) f.push("Enddatum der Befristung");
    if (d.vertrag.stunden_pro_woche === null) f.push("Stunden je Woche");
    if (d.vertrag.stundenlohn_cent === null) f.push("Stundenlohn");
    return f;
}

export function vertragsWerte(d: VertragsDaten, datumIso: string): VertragsWerte {
    const p = d.person;
    return {
        name: `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim(),
        anschrift: [p.anschrift_strasse, `${p.anschrift_plz ?? ""} ${p.anschrift_ort ?? ""}`.trim()]
            .filter(Boolean)
            .join(", "),
        beginn: datumDe(d.vertrag.beginn),
        befristet_bis: datumDe(d.vertrag.befristet_bis),
        arbeitsort: d.center ? `${d.center.name}, ${d.center.stadt}` : "",
        stunden: stundenDe(d.vertrag.stunden_pro_woche),
        stundenlohn: betragDe(d.vertrag.stundenlohn_cent),
        ort: d.center?.stadt ?? "",
        datum: datumDe(datumIso),
    };
}

/** Ist die Person am Stichtag minderjaehrig? (Geburtsdatum unbekannt: nein) */
export function minderjaehrig(geburtsdatum: string | null, stichtagIso: string): boolean {
    if (!geburtsdatum) return false;
    const [gy, gm, gd] = geburtsdatum.split("-").map(Number);
    const [sy, sm, sd] = stichtagIso.split("-").map(Number);
    let alter = sy - gy;
    if (sm < gm || (sm === gm && sd < gd)) alter--;
    return alter < 18;
}

export async function ladeVorlagePdf(db: SupabaseClient, vorlage: EsskaVertragsvorlage): Promise<Uint8Array> {
    const { data, error } = await db.storage.from("arbeitsvertraege").download(vorlage.datei_pfad);
    if (error || !data) throw new Error("Die Vertragsvorlage konnte nicht geladen werden.");
    return new Uint8Array(await data.arrayBuffer());
}
