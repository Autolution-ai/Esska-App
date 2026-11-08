// Lohnberechnung aus den Wochenplaenen (nur fuer Admins und Regionalmanager;
// die Daten dazu - Stundenlohn und Bonus je Schicht - liegen in eigenen
// Tabellen, die Mitarbeiter nicht lesen koennen).
//
// Je Schicht: Stunden (Schichtzeit minus Pause) x Stundenlohn
//   + Sonntagszuschlag 1 EUR je Stunde an Sonntagen
//   + Bonus 1 EUR je Stunde, wenn im Schichtplan angehakt.
// Der Stundenlohn ist mindestens der gesetzliche Mindestlohn am Schichttag
// (so steht es auch im Vertrag: "ab 01.01.2027 ... 14,60 EUR").

import type { EsskaShift } from "@/lib/esska/types";
import { MINDESTLOHN, nettoStunden, zeitKurz } from "@/lib/esska/types";

export const SONNTAGSZUSCHLAG_CENT = 100;
export const BONUS_CENT = 100;

export const istSonntag = (datum: string) => new Date(`${datum}T12:00:00`).getDay() === 0;

export const schichtDauer = (s: Pick<EsskaShift, "start_zeit" | "end_zeit" | "pause_min">) =>
    nettoStunden(zeitKurz(s.start_zeit), zeitKurz(s.end_zeit), s.pause_min ?? 0);

/** Gesetzlicher Mindestlohn an einem Tag (Cent), 0 vor dem ersten Eintrag. */
export function mindestlohnAm(datum: string): number {
    const gueltig = MINDESTLOHN.filter((m) => m.ab <= datum);
    return gueltig.length ? gueltig[gueltig.length - 1].cent : 0;
}

export type LohnErgebnis = {
    schichten: number;
    stundenWerktag: number;
    stundenSonntag: number;
    stundenBonus: number;
    /** Stunden x Stundenlohn (ohne Zulagen) */
    grundCent: number;
    sonntagCent: number;
    bonusCent: number;
    gesamtCent: number;
    /** Kein Stundenlohn hinterlegt -> nur Stunden, kein Lohn */
    ohneLohn: boolean;
    /** Mindestens eine Schicht wurde auf den Mindestlohn angehoben */
    mindestlohnAngehoben: boolean;
};

export function lohnAuswerten(
    schichten: Array<Pick<EsskaShift, "id" | "datum" | "start_zeit" | "end_zeit" | "pause_min">>,
    stundenlohnCent: number | null,
    bonus: Map<string, number>
): LohnErgebnis {
    const e: LohnErgebnis = {
        schichten: schichten.length,
        stundenWerktag: 0,
        stundenSonntag: 0,
        stundenBonus: 0,
        grundCent: 0,
        sonntagCent: 0,
        bonusCent: 0,
        gesamtCent: 0,
        ohneLohn: stundenlohnCent === null,
        mindestlohnAngehoben: false,
    };
    for (const s of schichten) {
        const h = schichtDauer(s);
        const sonntag = istSonntag(s.datum);
        if (sonntag) e.stundenSonntag += h;
        else e.stundenWerktag += h;
        const b = bonus.get(s.id);
        if (b) {
            e.stundenBonus += h;
            e.bonusCent += Math.round(h * b);
        }
        if (sonntag) e.sonntagCent += Math.round(h * SONNTAGSZUSCHLAG_CENT);
        if (stundenlohnCent !== null) {
            const mindest = mindestlohnAm(s.datum);
            if (mindest > stundenlohnCent) e.mindestlohnAngehoben = true;
            e.grundCent += Math.round(h * Math.max(stundenlohnCent, mindest));
        }
    }
    e.gesamtCent = e.ohneLohn ? 0 : e.grundCent + e.sonntagCent + e.bonusCent;
    return e;
}

/** 12,5 -> "12:30 h" */
export function stundenText(h: number): string {
    const min = Math.round(h * 60);
    return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} h`;
}

export function euroText(cent: number): string {
    return `${(cent / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Stundenlohn je Person: eigener Eintrag (mitarbeiter_lohn), sonst der
 *  Stundenlohn aus dem neuesten Arbeitsvertrag. */
export function stundenlohnMap(
    lohn: Array<{ profile_id: string; stundenlohn_cent: number }>,
    vertraege: Array<{ profile_id: string; stundenlohn_cent: number | null; erstellt_am: string }>
): Map<string, { cent: number; quelle: "profil" | "vertrag" }> {
    const m = new Map<string, { cent: number; quelle: "profil" | "vertrag" }>();
    const sortiert = [...vertraege].sort((a, b) => a.erstellt_am.localeCompare(b.erstellt_am));
    for (const v of sortiert) if (v.stundenlohn_cent) m.set(v.profile_id, { cent: v.stundenlohn_cent, quelle: "vertrag" });
    for (const l of lohn) m.set(l.profile_id, { cent: Number(l.stundenlohn_cent), quelle: "profil" });
    return m;
}
