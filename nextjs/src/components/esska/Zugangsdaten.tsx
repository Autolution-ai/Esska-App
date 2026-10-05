"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

export type Zugang = { url: string; email: string | null; passwort: string };

/** Zeigt die Zugangsdaten eines Mitarbeiters als fertigen Text zum
 *  Weiterleiten (z. B. per WhatsApp). Nur fuer Admins sichtbar - die Daten
 *  kommen aus einer Admin-Route. */
export default function Zugangsdaten({ zugang, titel }: { zugang: Zugang; titel: string }) {
    const [kopiert, setKopiert] = useState(false);

    const text =
        `Hallo! Dein Zugang zur Esska-App:\n` +
        `${zugang.url}/auth/login\n` +
        `E-Mail: ${zugang.email ?? ""}\n` +
        `Passwort: ${zugang.passwort}\n\n` +
        `Tipp: Speichere die App auf deinem Startbildschirm – die Anleitung findest du nach dem Login.`;

    const kopieren = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setKopiert(true);
            setTimeout(() => setKopiert(false), 2000);
        } catch {
            // Zwischenablage gesperrt (z. B. in manchen Browsern ohne HTTPS):
            // Text bleibt markierbar.
        }
    };

    return (
        <div className="p-3 rounded-md bg-green-50 border border-green-200 text-sm space-y-2">
            <p className="font-medium text-green-800">{titel}</p>
            <pre className="whitespace-pre-wrap break-all bg-white border rounded p-2 text-xs text-gray-800 select-all">
                {text}
            </pre>
            <button
                type="button"
                onClick={kopieren}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-green-700 text-white text-xs hover:bg-green-800"
            >
                {kopiert ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {kopiert ? "Kopiert" : "Text kopieren"}
            </button>
        </div>
    );
}
