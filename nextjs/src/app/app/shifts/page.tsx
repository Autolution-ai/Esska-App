"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import CenterAuswahl from "@/components/esska/CenterAuswahl";
import WocheEditor from "@/components/esska/WocheEditor";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter, EsskaShiftWeek } from "@/lib/esska/types";
import { addTage, isoDatum, montagDerWoche, parseIsoDatum } from "@/lib/esska/types";

// Zuletzt gewaehltes Center merken (nur Komfort, pro Browser)
const CENTER_SPEICHER = "esska.schichtplan.center";

const datumKurz = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

/** Schichtplan: Center waehlen, dann direkt den Wochenplan der aktuellen,
 *  naechsten oder uebernaechsten Woche bearbeiten. Andere (alte oder weiter
 *  vorausgeplante) Wochen ueber "Weitere Wochen". */
export default function ShiftsOverviewPage() {
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [weeks, setWeeks] = useState<EsskaShiftWeek[]>([]);
    const [centerId, setCenterId] = useState<string>("");
    const [wochenStart, setWochenStart] = useState<Date>(montagDerWoche(new Date()));
    const [weitereOffen, setWeitereOffen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const wochenLaden = useCallback(async () => {
        const client = await getEsskaClient();
        const { data, error: wErr } = await client.from("shift_weeks").select("*").order("woche_start", { ascending: false });
        if (wErr) throw wErr;
        setWeeks((data as EsskaShiftWeek[]) ?? []);
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const { data, error: cErr } = await client
                    .from("centers")
                    .select("*")
                    .order("saison", { ascending: false })
                    .order("name");
                if (cErr) throw cErr;
                const cs = (data as EsskaCenter[]) ?? [];
                setCenters(cs);
                let gemerkt: string | null = null;
                try {
                    gemerkt = localStorage.getItem(CENTER_SPEICHER);
                } catch {
                    // ohne Speicher einfach das erste Center
                }
                setCenterId(cs.some((c) => c.id === gemerkt) ? (gemerkt as string) : cs[0]?.id ?? "");
                await wochenLaden();
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [wochenLaden]);

    const centerWaehlen = (id: string) => {
        setCenterId(id);
        try {
            localStorage.setItem(CENTER_SPEICHER, id);
        } catch {
            // egal
        }
    };

    const heuteMontag = montagDerWoche(new Date());
    const reiter = [
        { label: "Aktuelle Woche", ziel: heuteMontag },
        { label: "Nächste Woche", ziel: addTage(heuteMontag, 7) },
        { label: "Übernächste Woche", ziel: addTage(heuteMontag, 14) },
    ];
    const gewaehlt = isoDatum(wochenStart);
    const reiterAktiv = reiter.some((r) => isoDatum(r.ziel) === gewaehlt);

    // Alle Wochenplaene dieses Centers: kommende (ab heute) und vergangene
    const { kommende, vergangene } = useMemo(() => {
        const eigene = weeks.filter((w) => w.center_id === centerId);
        const heute = isoDatum(heuteMontag);
        return {
            kommende: eigene.filter((w) => w.woche_start >= heute).sort((a, b) => a.woche_start.localeCompare(b.woche_start)),
            vergangene: eigene.filter((w) => w.woche_start < heute),
        };
        // heuteMontag aendert sich innerhalb einer Sitzung praktisch nicht
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weeks, centerId]);

    const wocheOeffnen = (iso: string) => {
        setWochenStart(montagDerWoche(parseIsoDatum(iso)));
        setWeitereOffen(false);
    };

    const WochenListe = ({ titel, liste }: { titel: string; liste: EsskaShiftWeek[] }) => (
        <div>
            <div className="text-xs font-medium text-gray-500 mb-1">{titel}</div>
            {liste.length === 0 ? (
                <p className="text-xs text-gray-400">keine</p>
            ) : (
                <ul className="divide-y border rounded-md bg-white max-h-64 overflow-y-auto">
                    {liste.map((w) => {
                        const start = parseIsoDatum(w.woche_start);
                        return (
                            <li key={w.id}>
                                <button
                                    type="button"
                                    onClick={() => wocheOeffnen(w.woche_start)}
                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-secondary-50 ${
                                        w.woche_start === gewaehlt ? "bg-primary-50" : ""
                                    }`}
                                >
                                    <span>
                                        {datumKurz(start)} – {addTage(start, 6).toLocaleDateString("de-DE")}
                                    </span>
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full ${
                                            w.veroeffentlicht ? "bg-green-100 text-green-800" : "bg-secondary-100 text-secondary-800"
                                        }`}
                                    >
                                        {w.veroeffentlicht ? "veröffentlicht" : "Entwurf"}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );

    return (
        <div className="space-y-4 p-2 md:p-6">
            <div>
                <h1 className="text-2xl font-bold">Schichtplan</h1>
                <p className="text-gray-500 text-sm">
                    Center und Woche wählen – der Wochenplan öffnet sich direkt darunter. Solange er „Entwurf“ ist, sehen
                    die Mitarbeiter nichts.
                </p>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

            <div className="bg-white border rounded-lg p-3 space-y-3">
                <div className="w-full sm:w-80">
                    <label className="block text-xs text-gray-500 mb-1">Center</label>
                    <CenterAuswahl centers={centers} value={centerId} onChange={centerWaehlen} />
                </div>

                <div className="flex flex-wrap gap-2">
                    {reiter.map((r) => {
                        const aktiv = isoDatum(r.ziel) === gewaehlt;
                        return (
                            <button
                                key={r.label}
                                type="button"
                                onClick={() => wocheOeffnen(isoDatum(r.ziel))}
                                className={`px-3 py-2 text-sm border rounded-md text-left ${
                                    aktiv ? "bg-primary-600 text-white border-primary-600" : "hover:bg-secondary-100"
                                }`}
                            >
                                <span className="block font-medium">{r.label}</span>
                                <span className={`block text-xs ${aktiv ? "text-white/80" : "text-gray-500"}`}>
                                    ab {datumKurz(r.ziel)}
                                </span>
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => setWeitereOffen((o) => !o)}
                        aria-expanded={weitereOffen}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md ${
                            !reiterAktiv ? "bg-primary-600 text-white border-primary-600" : "hover:bg-secondary-100"
                        }`}
                    >
                        <CalendarDays className="h-4 w-4" />
                        {reiterAktiv ? "Weitere Wochen" : `Woche ab ${datumKurz(wochenStart)}`}
                        {weitereOffen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                </div>

                {weitereOffen && (
                    <div className="border-t pt-3 grid gap-4 md:grid-cols-3">
                        <WochenListe titel="Vorausgeplant (ab dieser Woche)" liste={kommende} />
                        <WochenListe titel="Vergangene Wochen" liste={vergangene} />
                        <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">Beliebige Woche öffnen</div>
                            <input
                                type="date"
                                value={gewaehlt}
                                onChange={(e) => {
                                    if (!e.target.value) return;
                                    const d = parseIsoDatum(e.target.value);
                                    if (!Number.isNaN(d.getTime())) wocheOeffnen(isoDatum(d));
                                }}
                                className="border rounded-md px-3 py-2 text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Irgendeinen Tag wählen – die App springt auf den Montag dieser Woche.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="text-gray-500 text-sm">Lädt…</div>
            ) : !centerId ? (
                <div className="text-gray-500 text-sm">Kein Center verfügbar.</div>
            ) : (
                <WocheEditor
                    key={`${centerId}-${gewaehlt}`}
                    centerId={centerId}
                    woche={gewaehlt}
                    eingebettet
                    onGeaendert={() => {
                        wochenLaden().catch(() => undefined);
                    }}
                />
            )}
        </div>
    );
}
