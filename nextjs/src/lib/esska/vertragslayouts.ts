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
export const VERTRAGSLAYOUTS: Partial<Record<EsskaArbeitszeitModell, VertragsLayout>> = {
    kurzfristig: {
        titel: "Arbeitsvertrag kurzfristige Beschäftigung (Arbeitszeit variabel) 2026",
        felder: [
            { feld: "name", seite: 0, x: 60, y: 633.5, maxBreite: 480 },
            { feld: "anschrift", seite: 0, x: 104, y: 617.5, maxBreite: 436 },
            { feld: "beginn", seite: 0, x: 217, y: 494.8, maxBreite: 90 },
            { feld: "befristet_bis", seite: 0, x: 382, y: 494.8, maxBreite: 88 },
            { feld: "arbeitsort", seite: 0, x: 187, y: 375.8, maxBreite: 360 },
            { feld: "stunden", seite: 0, x: 242, y: 268.8, maxBreite: 27 },
            { feld: "stundenlohn", seite: 1, x: 280, y: 704.5, maxBreite: 47 },
            { feld: "ort", seite: 2, x: 62, y: 307.4, maxBreite: 160 },
            { feld: "datum", seite: 2, x: 250, y: 307.4, maxBreite: 140 },
        ],
        unterschrift: { seite: 2, x: 296, y: 273.5, breite: 175, hoehe: 28 },
        vertreter: { seite: 2, x: 60, y: 220.5, breite: 175, hoehe: 16.5 },
        // Die aktuelle Fassung enthaelt noch Beispielwerte (31.01.2027, 15, 14).
        // Mit der leeren Vorlage entfaellt das.
        abdecken: [
            { seite: 0, x: 388, y: 493.6, breite: 76, hoehe: 12 },
            { seite: 0, x: 243, y: 268.0, breite: 22, hoehe: 12 },
            { seite: 1, x: 292, y: 702.6, breite: 18, hoehe: 12 },
        ],
    },
};

export function layoutFuer(art: EsskaArbeitszeitModell | null | undefined): VertragsLayout | null {
    return art ? VERTRAGSLAYOUTS[art] ?? null : null;
}
