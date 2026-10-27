"use client";

import React, { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { Eraser } from "lucide-react";

/** Schneidet den leeren Rand ab und verkleinert auf hoechstens 900 px Breite,
 *  damit das PNG klein bleibt. Liefert eine data-URL (image/png). */
function zuschneiden(canvas: HTMLCanvasElement): string | null {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const { width, height } = canvas;
    const daten = ctx.getImageData(0, 0, width, height).data;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (daten[(y * width + x) * 4 + 3] > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < 0) return null;
    const rand = 4;
    minX = Math.max(0, minX - rand);
    minY = Math.max(0, minY - rand);
    maxX = Math.min(width - 1, maxX + rand);
    maxY = Math.min(height - 1, maxY + rand);
    const b = maxX - minX + 1;
    const h = maxY - minY + 1;
    const faktor = Math.min(1, 900 / b);
    const ziel = document.createElement("canvas");
    ziel.width = Math.max(1, Math.round(b * faktor));
    ziel.height = Math.max(1, Math.round(h * faktor));
    ziel.getContext("2d")?.drawImage(canvas, minX, minY, b, h, 0, 0, ziel.width, ziel.height);
    return ziel.toDataURL("image/png");
}

/** Feld zum Unterschreiben mit Finger, Stift oder Maus. Meldet die
 *  zugeschnittene Unterschrift als PNG-data-URL (oder null, wenn leer). */
export default function Unterschriftsfeld({
    label,
    hinweis,
    onChange,
    gesperrt = false,
}: {
    label: string;
    hinweis?: string;
    onChange: (png: string | null) => void;
    gesperrt?: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);
    const [leer, setLeer] = useState(true);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const pad = new SignaturePad(canvas, {
            penColor: "rgb(13, 26, 89)",
            minWidth: 0.8,
            maxWidth: 2.6,
        });
        padRef.current = pad;

        // Canvas an Breite und Pixeldichte anpassen (scharf auf dem Handy).
        // Beim Groessenwechsel geht die Zeichnung verloren - dann neu melden.
        const anpassen = () => {
            const dpr = Math.max(window.devicePixelRatio || 1, 1);
            const breite = canvas.offsetWidth;
            const hoehe = canvas.offsetHeight;
            if (canvas.width === Math.round(breite * dpr) && canvas.height === Math.round(hoehe * dpr)) return;
            canvas.width = Math.round(breite * dpr);
            canvas.height = Math.round(hoehe * dpr);
            canvas.getContext("2d")?.scale(dpr, dpr);
            pad.clear();
            setLeer(true);
            onChangeRef.current(null);
        };
        anpassen();
        const beobachter = new ResizeObserver(anpassen);
        beobachter.observe(canvas);

        const fertig = () => {
            const istLeer = pad.isEmpty();
            setLeer(istLeer);
            onChangeRef.current(istLeer ? null : zuschneiden(canvas));
        };
        pad.addEventListener("endStroke", fertig);

        return () => {
            beobachter.disconnect();
            pad.removeEventListener("endStroke", fertig);
            pad.off();
            padRef.current = null;
        };
    }, []);

    useEffect(() => {
        const pad = padRef.current;
        if (!pad) return;
        if (gesperrt) pad.off();
        else pad.on();
    }, [gesperrt]);

    const loeschen = () => {
        padRef.current?.clear();
        setLeer(true);
        onChange(null);
    };

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{label}</span>
                <button
                    type="button"
                    onClick={loeschen}
                    disabled={leer || gesperrt}
                    className="inline-flex items-center text-xs text-gray-600 hover:text-gray-900 disabled:opacity-40"
                >
                    <Eraser className="h-3.5 w-3.5 mr-1" />
                    Löschen
                </button>
            </div>
            <div className="relative">
                <canvas
                    ref={canvasRef}
                    className="block w-full h-40 rounded-md border-2 border-dashed border-gray-300 bg-white touch-none"
                    aria-label={label}
                />
                {leer && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
                        Hier mit dem Finger unterschreiben · Sign here
                    </span>
                )}
                <span className="pointer-events-none absolute left-4 right-4 bottom-8 border-b border-gray-300" />
            </div>
            {hinweis && <p className="text-xs text-gray-500">{hinweis}</p>}
        </div>
    );
}
