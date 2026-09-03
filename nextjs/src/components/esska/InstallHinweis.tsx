"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Smartphone, X } from "lucide-react";

const SPEICHER_SCHLUESSEL = "esska_install_hinweis_weg";

/**
 * Hinweis "App aufs Handy holen".
 *
 * Zeigt sich bewusst NICHT dauerhaft:
 *  - verschwindet automatisch, sobald die App installiert ist (dann laeuft
 *    sie im Standalone-Modus, erkennbar an display-mode: standalone bzw.
 *    navigator.standalone auf iOS)
 *  - verschwindet auf Desktop-Browsern (dort ist er sinnlos)
 *  - kann weggeklickt werden und bleibt dann weg (localStorage)
 *
 * Dauerhaft auffindbar bleibt die Anleitung ueber /anleitung, verlinkt in
 * den Einstellungen und auf der Startseite.
 */
export default function InstallHinweis() {
    const [sichtbar, setSichtbar] = useState(false);

    useEffect(() => {
        try {
            if (localStorage.getItem(SPEICHER_SCHLUESSEL) === "1") return;
        } catch {
            // localStorage kann blockiert sein - dann Hinweis trotzdem zeigen
        }
        const standalone =
            window.matchMedia?.("(display-mode: standalone)").matches ||
            (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
        if (standalone) return;

        // Nur auf Touch-/Handy-Geraeten sinnvoll
        const mobil = window.matchMedia?.("(max-width: 1023px)").matches;
        if (!mobil) return;

        setSichtbar(true);
    }, []);

    if (!sichtbar) return null;

    const schliessen = () => {
        setSichtbar(false);
        try {
            localStorage.setItem(SPEICHER_SCHLUESSEL, "1");
        } catch {
            // nicht kritisch
        }
    };

    return (
        <div className="relative flex items-start gap-3 p-3 pr-9 bg-secondary-100 border border-secondary-300 rounded-lg text-sm">
            <Smartphone className="h-5 w-5 shrink-0 text-primary-600 mt-0.5" />
            <div>
                <p className="font-medium text-gray-900">Esska als App auf dem Handy</p>
                <p className="text-gray-700 mt-0.5">
                    In einer Minute liegt die App als Icon auf deinem Startbildschirm – dann musst du
                    den Link nie wieder suchen.{" "}
                    <Link href="/anleitung" className="text-primary-700 underline font-medium">
                        So geht&apos;s
                    </Link>
                </p>
            </div>
            <button
                onClick={schliessen}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                title="Hinweis ausblenden"
                aria-label="Hinweis ausblenden"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
