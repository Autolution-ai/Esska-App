"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { EsskaCenter } from "@/lib/esska/types";

/** Text fuer die Suche vereinheitlichen: Gross-/Kleinschreibung, Umlaute
 *  und Akzente spielen keine Rolle ("Koln" findet "Köln", "ss" findet "ß"). */
export function suchText(s: string | null | undefined): string {
    return (s ?? "")
        .toLowerCase()
        .replace(/ß/g, "ss")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
}

/** Passt ein Center zur Suche? Gesucht wird in Name, Stadt und Kuerzel;
 *  mehrere Woerter muessen alle irgendwo vorkommen ("brau sab"). */
export function centerPasst(c: EsskaCenter, suche: string): boolean {
    const woerter = suchText(suche).split(/\s+/).filter(Boolean);
    if (woerter.length === 0) return true;
    const heu = suchText(`${c.name} ${c.stadt} ${c.kuerzel}`);
    return woerter.every((w) => heu.includes(w));
}

type Option = { value: string; label: string };

/** Center-Auswahl mit Suchfeld: Ein Suchfeld filtert die Liste nach Stadt,
 *  Kuerzel oder Name; darunter bleibt das normale Auswahlfeld (auf dem Handy
 *  gut bedienbar). Bleibt genau ein Treffer uebrig, wird er gewaehlt. Bei
 *  kurzen Listen erscheint kein Suchfeld. */
export default function CenterAuswahl({
    centers,
    value,
    onChange,
    beschriftung = (c) => `${c.name} (${c.kuerzel}) · ${c.stadt}`,
    vorne = [],
    hinten = [],
    id,
    className = "w-full border rounded-md px-3 py-2 text-sm",
    abSuche = 6,
}: {
    centers: EsskaCenter[];
    value: string;
    onChange: (wert: string) => void;
    beschriftung?: (c: EsskaCenter) => string;
    /** Feste Optionen vor den Centern, z. B. "– wählen –" oder "Alle Center" */
    vorne?: Option[];
    /** Feste Optionen nach den Centern, z. B. "Ohne Center" */
    hinten?: Option[];
    id?: string;
    className?: string;
    /** Ab wie vielen Centern das Suchfeld erscheint */
    abSuche?: number;
}) {
    const [suche, setSuche] = useState("");
    const mitSuche = centers.length >= abSuche;

    const treffer = useMemo(() => centers.filter((c) => centerPasst(c, suche)), [centers, suche]);
    // Das gewaehlte Center bleibt sichtbar, auch wenn es nicht zur Suche passt -
    // sonst stuende im Auswahlfeld ploetzlich etwas anderes.
    const sichtbar = useMemo(() => {
        const gewaehlt = centers.find((c) => c.id === value);
        return gewaehlt && !treffer.includes(gewaehlt) ? [gewaehlt, ...treffer] : treffer;
    }, [centers, treffer, value]);

    // Genau ein Treffer: direkt waehlen (spart auf dem Handy einen Schritt)
    useEffect(() => {
        if (suche.trim().length >= 2 && treffer.length === 1 && treffer[0].id !== value) {
            onChange(treffer[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [suche, treffer]);

    return (
        <div className="space-y-1.5">
            {mitSuche && (
                <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="search"
                        value={suche}
                        onChange={(e) => setSuche(e.target.value)}
                        placeholder="Suchen: Stadt, Kürzel oder Name"
                        aria-label="Center suchen"
                        className="w-full border rounded-md pl-9 pr-3 py-2 text-sm"
                    />
                </div>
            )}
            <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className}>
                {vorne.map((o) => (
                    <option key={`v-${o.value}`} value={o.value}>
                        {o.label}
                    </option>
                ))}
                {sichtbar.map((c) => (
                    <option key={c.id} value={c.id}>
                        {beschriftung(c)}
                    </option>
                ))}
                {hinten.map((o) => (
                    <option key={`h-${o.value}`} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            {mitSuche && suche.trim() && treffer.length === 0 && (
                <p className="text-xs text-gray-500">Kein Center gefunden für &bdquo;{suche.trim()}&ldquo;.</p>
            )}
        </div>
    );
}
