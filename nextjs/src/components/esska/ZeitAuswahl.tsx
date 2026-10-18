"use client";

import React from "react";

// Viertelstunden von 05:00 bis 23:45. Bewusst eine Liste statt eines
// Uhrzeitfelds: Safari und das iPhone ignorieren beim Uhrzeitfeld das
// Raster und bieten jede einzelne Minute an.
const ZEITEN = Array.from({ length: (24 - 5) * 4 }, (_, i) => {
    const min = 5 * 60 + i * 15;
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
});

/** Auswahl einer Uhrzeit im Viertelstundenraster (Wert im Format "HH:MM").
 *  Ein bereits gespeicherter Wert ausserhalb des Rasters bleibt sichtbar,
 *  damit er nicht unbemerkt verloren geht. */
export default function ZeitAuswahl({
    id,
    value,
    onChange,
    leerText = "–",
    className = "border rounded px-2 py-1 text-sm",
    ariaLabel,
}: {
    id?: string;
    value: string;
    onChange: (wert: string) => void;
    leerText?: string;
    className?: string;
    ariaLabel?: string;
}) {
    const wert = value ? value.slice(0, 5) : "";
    const optionen = wert && !ZEITEN.includes(wert) ? [...ZEITEN, wert].sort() : ZEITEN;
    return (
        <select
            id={id}
            value={wert}
            onChange={(e) => onChange(e.target.value)}
            className={className}
            aria-label={ariaLabel}
        >
            <option value="">{leerText}</option>
            {optionen.map((z) => (
                <option key={z} value={z}>
                    {z} Uhr
                </option>
            ))}
        </select>
    );
}
