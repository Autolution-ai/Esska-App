"use client";

import React from "react";
import type { EsskaArbeitszeitModell } from "@/lib/esska/types";
import { ARBEITSZEIT_MODELL_LABELS, BEFRISTETE_ARTEN, VERTRAGS_ARTEN, MINIJOB_MAX_STUNDEN, mindestlohnWaehrend, parseEuro } from "@/lib/esska/types";

export type Konditionen = {
    art: EsskaArbeitszeitModell;
    beginn: string;
    befristet_bis: string;
    stunden: string;
    stundenlohn: string;
};

export const LEERE_KONDITIONEN: Konditionen = {
    art: "kurzfristig",
    beginn: "",
    befristet_bis: "",
    stunden: "",
    stundenlohn: "",
};

export type GepruefteKonditionen = {
    art: EsskaArbeitszeitModell;
    beginn: string;
    befristet_bis: string | null;
    stunden_pro_woche: number | null;
    stundenlohn_cent: number | null;
};

/** Prueft die Eingaben. Ergebnis: Fehlertext oder die umgerechneten Werte.
 *  Ohne Beginn wird (noch) kein Vertrag angelegt -> null. */
export function konditionenPruefen(
    k: Konditionen,
    o: { minijobBegrenzt?: boolean } = {}
): { fehler: string } | { werte: GepruefteKonditionen | null } {
    if (!VERTRAGS_ARTEN.includes(k.art)) {
        return { fehler: "Bitte als Beschäftigungsart „Kurzfristig“ (KuBe) oder „Minijob“ wählen." };
    }
    if (!k.beginn) {
        if (k.befristet_bis || k.stunden || k.stundenlohn) {
            return { fehler: "Bitte den Vertragsbeginn angeben – oder die Vertragsfelder leer lassen." };
        }
        return { werte: null };
    }
    if (BEFRISTETE_ARTEN.includes(k.art) && !k.befristet_bis) {
        return { fehler: `Für „${ARBEITSZEIT_MODELL_LABELS[k.art]}“ bitte das Enddatum („befristet bis“) angeben.` };
    }
    if (!k.stunden.trim() || !k.stundenlohn.trim()) {
        return { fehler: "Bitte Stunden je Woche und Stundenlohn angeben – beides steht im Vertrag." };
    }
    if (k.befristet_bis && k.befristet_bis < k.beginn) {
        return { fehler: "„Befristet bis“ liegt vor dem Beginn." };
    }
    let stunden: number | null = null;
    if (k.stunden.trim()) {
        stunden = parseFloat(k.stunden.replace(",", "."));
        if (!Number.isFinite(stunden) || stunden <= 0 || stunden > 60) {
            return { fehler: "Bitte die Stunden je Woche als Zahl zwischen 1 und 60 angeben." };
        }
    }
    if (k.art === "minijob" && o.minijobBegrenzt && (stunden === null || stunden > MINIJOB_MAX_STUNDEN)) {
        return { fehler: `Beim Minijob bitte höchstens ${MINIJOB_MAX_STUNDEN} Wochenstunden auswählen.` };
    }
    let lohn: number | null = null;
    if (k.stundenlohn.trim()) {
        lohn = parseEuro(k.stundenlohn);
        if (lohn === null || lohn <= 0) return { fehler: "Bitte den Stundenlohn als Betrag angeben, z. B. 14,60." };
        const ml = mindestlohnWaehrend(k.beginn, k.befristet_bis || null);
        if (ml && lohn < ml.cent && ml.ab <= k.beginn) {
            return {
                fehler: `Der Stundenlohn liegt unter dem gesetzlichen Mindestlohn (${(ml.cent / 100).toFixed(2).replace(".", ",")} €).`,
            };
        }
    }
    return {
        werte: {
            art: k.art,
            beginn: k.beginn,
            befristet_bis: k.befristet_bis || null,
            stunden_pro_woche: stunden,
            stundenlohn_cent: lohn,
        },
    };
}

/** Eingabefelder fuer die Vertragskonditionen (Beginn, Befristung, Stunden,
 *  Stundenlohn, Beschaeftigungsart). */
export default function VertragKonditionen({
    wert,
    onChange,
    idPrefix = "vk",
    minijobBegrenzt = false,
}: {
    wert: Konditionen;
    onChange: (k: Konditionen) => void;
    idPrefix?: string;
    /** Regionalmanager: Minijob nur bis MINIJOB_MAX_STUNDEN Wochenstunden */
    minijobBegrenzt?: boolean;
}) {
    const setze = <K extends keyof Konditionen>(feld: K, v: Konditionen[K]) => onChange({ ...wert, [feld]: v });
    const stundenAuswahl = minijobBegrenzt && wert.art === "minijob";

    // Hinweis, wenn der Lohn ueber einen Jahreswechsel unter den dann
    // geltenden Mindestlohn faellt (z. B. 14 EUR bis Januar 2027).
    const lohn = wert.stundenlohn.trim() ? parseEuro(wert.stundenlohn) : null;
    const ml = wert.beginn ? mindestlohnWaehrend(wert.beginn, wert.befristet_bis || null) : null;
    const mindestlohnHinweis =
        lohn !== null && ml && lohn < ml.cent
            ? `Ab ${ml.ab.slice(8, 10)}.${ml.ab.slice(5, 7)}.${ml.ab.slice(0, 4)} gilt ein Mindestlohn von ${(ml.cent / 100)
                  .toFixed(2)
                  .replace(".", ",")} € – der Vertrag läuft bis in diesen Zeitraum.`
            : null;

    const feldKlasse = "w-full border rounded-md px-3 py-2 text-sm";
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <div>
                <label htmlFor={`${idPrefix}-art`} className="block text-xs text-gray-500 mb-1">Beschäftigungsart</label>
                <select
                    id={`${idPrefix}-art`}
                    value={wert.art}
                    onChange={(e) => setze("art", e.target.value as EsskaArbeitszeitModell)}
                    className={feldKlasse}
                >
                    {VERTRAGS_ARTEN.map((a) => (
                        <option key={a} value={a}>
                            {ARBEITSZEIT_MODELL_LABELS[a]}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor={`${idPrefix}-std`} className="block text-xs text-gray-500 mb-1">
                    Stunden je Woche (ca.){stundenAuswahl ? ` – Minijob: max. ${MINIJOB_MAX_STUNDEN}` : ""}
                </label>
                {stundenAuswahl ? (
                    <select
                        id={`${idPrefix}-std`}
                        value={wert.stunden}
                        onChange={(e) => setze("stunden", e.target.value)}
                        className={feldKlasse}
                    >
                        <option value="">– bitte wählen –</option>
                        {Array.from({ length: MINIJOB_MAX_STUNDEN }, (_, i) => String(i + 1)).map((h) => (
                            <option key={h} value={h}>
                                {h} Std.
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        id={`${idPrefix}-std`}
                        value={wert.stunden}
                        onChange={(e) => setze("stunden", e.target.value)}
                        inputMode="decimal"
                        placeholder="z. B. 15"
                        className={feldKlasse}
                    />
                )}
            </div>
            <div>
                <label htmlFor={`${idPrefix}-beginn`} className="block text-xs text-gray-500 mb-1">Beginn</label>
                <input
                    id={`${idPrefix}-beginn`}
                    type="date"
                    value={wert.beginn}
                    onChange={(e) => setze("beginn", e.target.value)}
                    className={feldKlasse}
                />
            </div>
            <div>
                <label htmlFor={`${idPrefix}-bis`} className="block text-xs text-gray-500 mb-1">Befristet bis</label>
                <input
                    id={`${idPrefix}-bis`}
                    type="date"
                    value={wert.befristet_bis}
                    onChange={(e) => setze("befristet_bis", e.target.value)}
                    className={feldKlasse}
                />
            </div>
            <div>
                <label htmlFor={`${idPrefix}-lohn`} className="block text-xs text-gray-500 mb-1">Stundenlohn brutto (€)</label>
                <input
                    id={`${idPrefix}-lohn`}
                    value={wert.stundenlohn}
                    onChange={(e) => setze("stundenlohn", e.target.value)}
                    inputMode="decimal"
                    placeholder="z. B. 14,60"
                    className={feldKlasse}
                />
            </div>
            {mindestlohnHinweis && (
                <p className="sm:col-span-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
                    {mindestlohnHinweis}
                </p>
            )}
        </div>
    );
}
