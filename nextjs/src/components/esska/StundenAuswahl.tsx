"use client";

import React from "react";

// Volle Stunden von 05:00 bis 23:00. Ein Uhrzeit-Feld mit step=3600 reicht
// nicht: Safari und das iPhone ignorieren step und zeigen trotzdem Minuten.
const STUNDEN = Array.from({ length: 19 }, (_, i) => `${String(i + 5).padStart(2, "0")}:00`);

/** Auswahl einer Uhrzeit in vollen Stunden (Wert im Format "HH:MM").
 *  Ein bereits gespeicherter Wert mit Minuten bleibt sichtbar, damit er
 *  nicht unbemerkt verloren geht - er laesst sich auf eine volle Stunde
 *  umstellen. */
export default function StundenAuswahl({
    id,
    value,
    onChange,
    leerText = "–",
    className = "border rounded px-2 py-1 text-sm",
}: {
    id?: string;
    value: string;
    onChange: (wert: string) => void;
    leerText?: string;
    className?: string;
}) {
    const wert = value ? value.slice(0, 5) : "";
    const optionen = wert && !STUNDEN.includes(wert) ? [...STUNDEN, wert].sort() : STUNDEN;
    return (
        <select id={id} value={wert} onChange={(e) => onChange(e.target.value)} className={className}>
            <option value="">{leerText}</option>
            {optionen.map((z) => (
                <option key={z} value={z}>
                    {z} Uhr
                </option>
            ))}
        </select>
    );
}
