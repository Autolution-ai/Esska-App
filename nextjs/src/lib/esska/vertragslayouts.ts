// Wo in einer Vertragsvorlage (PDF) welche Angabe eingesetzt wird.
//
// Die Vorlagen haben keine Formularfelder - die Luecken sind nur Linien.
// Deshalb steht hier je Vertragsart, an welche Stelle (Seite, x, y in PDF-
// Punkten, Ursprung unten links) jede Angabe geschrieben wird. Gemessen mit
// scripts/vertrag-einmessen.py. Kommt eine neue Fassung mit anderem Layout,
// wird sie damit neu eingemessen und hier eingetragen.
//
// Fehlt fuer eine Vertragsart ein Layout, laeuft der einfache Weg weiter:
// Vorlage ansehen und per Haken bestaetigen.

import type { EsskaArbeitszeitModell } from "@/lib/esska/types";

export type VertragsFeld =
    | "name"
    | "anschrift"
    | "beginn"
    | "befristet_bis"
    | "arbeitsort"
    | "stunden"
    | "stundenlohn"
    | "ort"
    | "datum";

export type Rechteck = { seite: number; x: number; y: number; breite: number; hoehe: number };

export type VertragsLayout = {
    /** Kurzbeschreibung fuer Admin-Hinweise */
    titel: string;
    felder: { feld: VertragsFeld; seite: number; x: number; y: number; maxBreite: number; groesse?: number }[];
    /** Unterschrift des Arbeitnehmers (Bild wird in dieses Feld eingepasst) */
    unterschrift: Rechteck;
    /** Unterschrift der gesetzlichen Vertretung bei Minderjaehrigen */
    vertreter?: Rechteck;
    /** Flaechen, die weiss uebermalt werden (z. B. vorgedruckte Beispielwerte
     *  in einer Vorlage, die noch nicht ganz leer ist). */
    abdecken?: Rechteck[];
};

// Seiten zaehlen ab 0.
// Seite 1 und 2 sind bei Minijob und kurzfristiger Beschaeftigung gleich
// aufgebaut, nur die Unterschriftenzeilen auf Seite 3 stehen verschieden hoch.
function felderSeite1und2(arbeitsortX: number): VertragsLayout["felder"] {
    return [
        { feld: "name", seite: 0, x: 60, y: 633.5, maxBreite: 480 },
        { feld: "anschrift", seite: 0, x: 104, y: 617.5, maxBreite: 436 },
        { feld: "beginn", seite: 0, x: 217, y: 494.8, maxBreite: 90 },
        { feld: "befristet_bis", seite: 0, x: 382, y: 494.8, maxBreite: 88 },
        { feld: "arbeitsort", seite: 0, x: arbeitsortX, y: 375.8, maxBreite: 540 - arbeitsortX },
        { feld: "stunden", seite: 0, x: 242, y: 268.8, maxBreite: 27 },
        { feld: "stundenlohn", seite: 1, x: 284, y: 704.5, maxBreite: 44 },
    ];
}

/** Ort/Datum, Unterschrift und Vertretung relativ zur Grundlinie der
 *  Zeile "____, den ____" auf Seite 3. */
function schluss(ortZeileY: number): Pick<VertragsLayout, "unterschrift" | "vertreter"> & { felder: VertragsLayout["felder"] } {
    return {
        felder: [
            { feld: "ort", seite: 2, x: 62, y: ortZeileY + 2, maxBreite: 160 },
            { feld: "datum", seite: 2, x: 250, y: ortZeileY + 2, maxBreite: 140 },
        ],
        unterschrift: { seite: 2, x: 296, y: ortZeileY - 31.9, breite: 175, hoehe: 28 },
        vertreter: { seite: 2, x: 60, y: ortZeileY - 84.9, breite: 175, hoehe: 16.5 },
    };
}

function layout(titel: string, arbeitsortX: number, ortZeileY: number): VertragsLayout {
    const s = schluss(ortZeileY);
    return {
        titel,
        felder: [...felderSeite1und2(arbeitsortX), ...s.felder],
        unterschrift: s.unterschrift,
        vertreter: s.vertreter,
    };
}

// Seiten zaehlen ab 0. Vorlagen "Arbeitsvertrag 26/27" (KuBe und Minijob).
export const VERTRAGSLAYOUTS: Partial<Record<EsskaArbeitszeitModell, VertragsLayout>> = {
    kurzfristig: layout("Arbeitsvertrag kurzfristige Beschäftigung 2026/27", 187, 368.8),
    minijob: layout("Arbeitsvertrag Minijob 2026/27", 190, 305.4),
};

export function layoutFuer(art: EsskaArbeitszeitModell | null | undefined): VertragsLayout | null {
    return art ? VERTRAGSLAYOUTS[art] ?? null : null;
}
