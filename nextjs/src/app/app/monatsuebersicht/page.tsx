"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import { useGlobal } from "@/lib/context/GlobalContext";
import type { EsskaCenter, EsskaProfile, EsskaShift, EsskaShiftWeek } from "@/lib/esska/types";
import { SLOT_LABELS, isoDatum, nettoStunden, zeitKurz } from "@/lib/esska/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Person = Pick<EsskaProfile, "id" | "vorname" | "nachname" | "email">;

/** 12,5 -> "12:30 h" */
function stundenText(h: number): string {
    const min = Math.round(h * 60);
    return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} h`;
}

const istSonntag = (datum: string) => new Date(`${datum}T12:00:00`).getDay() === 0;
const dauer = (s: EsskaShift) => nettoStunden(zeitKurz(s.start_zeit), zeitKurz(s.end_zeit), s.pause_min ?? 0);

const MONATE = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** Monatsuebersicht fuer Admins und Regionalmanager: gearbeitete Zeit je
 *  Mitarbeiter laut Wochenplaenen (Schichtzeit minus Pause). Regionalmanager
 *  sehen nur die Schichten ihrer Center (Datenbankregel). */
export default function MonatsuebersichtPage() {
    const router = useRouter();
    const { role, loading: globalLoading } = useGlobal();
    const heute = new Date();
    const [jahr, setJahr] = useState(heute.getFullYear());
    const [monat, setMonat] = useState(heute.getMonth()); // 0-11
    const [nurVeroeffentlicht, setNurVeroeffentlicht] = useState(true);

    const [shifts, setShifts] = useState<EsskaShift[]>([]);
    const [wochen, setWochen] = useState<EsskaShiftWeek[]>([]);
    const [personen, setPersonen] = useState<Person[]>([]);
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [offen, setOffen] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!globalLoading && role === "mitarbeiter") router.replace("/app");
    }, [globalLoading, role, router]);

    const von = isoDatum(new Date(jahr, monat, 1));
    const bis = isoDatum(new Date(jahr, monat + 1, 0));

    useEffect(() => {
        if (globalLoading || !role || role === "mitarbeiter") return;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const client = await getEsskaClient();
                const [sRes, pRes, cRes] = await Promise.all([
                    client.from("shifts").select("*").gte("datum", von).lte("datum", bis).order("datum").order("slot"),
                    client.rpc("planungsprofile"),
                    client.from("centers").select("*"),
                ]);
                if (sRes.error) throw sRes.error;
                if (pRes.error) throw pRes.error;
                if (cRes.error) throw cRes.error;
                const s = (sRes.data as EsskaShift[]) ?? [];
                setShifts(s);
                setPersonen((pRes.data as Person[]) ?? []);
                setCenters((cRes.data as EsskaCenter[]) ?? []);
                const wochenIds = [...new Set(s.map((x) => x.shift_week_id))];
                if (wochenIds.length > 0) {
                    const { data, error: wErr } = await client.from("shift_weeks").select("*").in("id", wochenIds);
                    if (wErr) throw wErr;
                    setWochen((data as EsskaShiftWeek[]) ?? []);
                } else {
                    setWochen([]);
                }
            } catch (err) {
                setError(friendlyError(err, { aktion: "Monatsübersicht laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [globalLoading, role, von, bis]);

    const veroeffentlicht = useMemo(() => new Set(wochen.filter((w) => w.veroeffentlicht).map((w) => w.id)), [wochen]);

    const zeilen = useMemo(() => {
        const gezaehlt = shifts.filter((s) => !nurVeroeffentlicht || veroeffentlicht.has(s.shift_week_id));
        const map = new Map<string, EsskaShift[]>();
        for (const s of gezaehlt) map.set(s.profile_id, [...(map.get(s.profile_id) ?? []), s]);
        return [...map.entries()]
            .map(([pid, liste]) => {
                const p = personen.find((x) => x.id === pid);
                const name = p ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || (p.email ?? "?") : "Unbekannt";
                // Sonntagsschichten werden extra bezahlt -> getrennt ausweisen
                const sonntag = liste.filter((s) => istSonntag(s.datum)).reduce((sum, s) => sum + dauer(s), 0);
                const werktag = liste.filter((s) => !istSonntag(s.datum)).reduce((sum, s) => sum + dauer(s), 0);
                const stunden = werktag + sonntag;
                const centerNamen = [...new Set(liste.map((s) => centers.find((c) => c.id === s.center_id)?.kuerzel ?? "?"))];
                return { pid, name, liste, stunden, werktag, sonntag, centerNamen };
            })
            .sort((a, b) => a.name.localeCompare(b.name, "de"));
    }, [shifts, nurVeroeffentlicht, veroeffentlicht, personen, centers]);

    const gesamt = zeilen.reduce((s, z) => s + z.stunden, 0);
    const gesamtWerktag = zeilen.reduce((s, z) => s + z.werktag, 0);
    const gesamtSonntag = zeilen.reduce((s, z) => s + z.sonntag, 0);
    const entwuerfe = shifts.filter((s) => !veroeffentlicht.has(s.shift_week_id)).length;

    const monatWechseln = (delta: number) => {
        const d = new Date(jahr, monat + delta, 1);
        setJahr(d.getFullYear());
        setMonat(d.getMonth());
        setOffen(null);
    };

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div>
                <h1 className="text-2xl font-bold">Monatsübersicht</h1>
                <p className="text-gray-600 text-sm">
                    Gearbeitete Zeit je Mitarbeiter laut Wochenplänen (Schichtzeit abzüglich Pause), getrennt nach
                    Montag–Samstag und Sonntag (Sonntagsschichten werden extra bezahlt).
                    {role === "regionalmanager" ? " Es zählen nur Schichten in deinen Centern." : ""}
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => monatWechseln(-1)}
                                className="p-1.5 border rounded-md hover:bg-secondary-100"
                                aria-label="Vorheriger Monat"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <CardTitle className="min-w-[10rem] text-center">
                                {MONATE[monat]} {jahr}
                            </CardTitle>
                            <button
                                type="button"
                                onClick={() => monatWechseln(1)}
                                className="p-1.5 border rounded-md hover:bg-secondary-100"
                                aria-label="Nächster Monat"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={nurVeroeffentlicht}
                                onChange={(e) => setNurVeroeffentlicht(e.target.checked)}
                            />
                            Nur veröffentlichte Wochenpläne
                        </label>
                    </div>
                    <CardDescription>
                        {nurVeroeffentlicht && entwuerfe > 0
                            ? `${entwuerfe} Schicht${entwuerfe === 1 ? "" : "en"} aus noch nicht veröffentlichten Plänen sind nicht mitgezählt.`
                            : "Schichten aus allen Wochenplänen des Monats."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && <div className="p-3 mb-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
                    {loading ? (
                        <div className="text-sm text-gray-500">Lädt…</div>
                    ) : zeilen.length === 0 ? (
                        <div className="text-sm text-gray-500">In diesem Monat sind keine Schichten eingeplant.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-secondary-50 text-left">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Mitarbeiter</th>
                                        <th className="px-3 py-2 font-medium">Center</th>
                                        <th className="px-3 py-2 font-medium text-right">Schichten</th>
                                        <th className="px-3 py-2 font-medium text-right">Mo–Sa</th>
                                        <th className="px-3 py-2 font-medium text-right">Sonntag</th>
                                        <th className="px-3 py-2 font-medium text-right">Gesamtzeit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {zeilen.map((z) => (
                                        <React.Fragment key={z.pid}>
                                            <tr
                                                className="border-t hover:bg-gray-50 cursor-pointer"
                                                onClick={() => setOffen(offen === z.pid ? null : z.pid)}
                                            >
                                                <td className="px-3 py-2">
                                                    <span className="inline-flex items-center gap-1">
                                                        {offen === z.pid ? (
                                                            <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                                                        ) : (
                                                            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                                                        )}
                                                        {z.name}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-gray-600">{z.centerNamen.join(", ")}</td>
                                                <td className="px-3 py-2 text-right">{z.liste.length}</td>
                                                <td className="px-3 py-2 text-right">{stundenText(z.werktag)}</td>
                                                <td className={`px-3 py-2 text-right ${z.sonntag > 0 ? "text-primary-700 font-medium" : "text-gray-400"}`}>
                                                    {z.sonntag > 0 ? stundenText(z.sonntag) : "—"}
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold">{stundenText(z.stunden)}</td>
                                            </tr>
                                            {offen === z.pid &&
                                                z.liste.map((s) => (
                                                    <tr key={s.id} className="bg-secondary-50/40 text-xs text-gray-600">
                                                        <td className="px-3 py-1.5 pl-8">
                                                            {new Date(`${s.datum}T12:00:00`).toLocaleDateString("de-DE", {
                                                                weekday: "short",
                                                                day: "2-digit",
                                                                month: "2-digit",
                                                            })}{" "}
                                                            · {SLOT_LABELS[s.slot]}
                                                            {istSonntag(s.datum) && (
                                                                <span className="ml-1 rounded bg-primary-100 text-primary-800 px-1">Sonntag</span>
                                                            )}
                                                            {!veroeffentlicht.has(s.shift_week_id) && (
                                                                <span className="ml-1 text-amber-700">(Entwurf)</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-1.5">
                                                            {centers.find((c) => c.id === s.center_id)?.name ?? "?"}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right">
                                                            {zeitKurz(s.start_zeit)}–{zeitKurz(s.end_zeit)}
                                                            {s.pause_min ? ` (−${s.pause_min} min Pause)` : ""}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right" colSpan={2}></td>
                                                        <td className="px-3 py-1.5 text-right">{stundenText(dauer(s))}</td>
                                                    </tr>
                                                ))}
                                        </React.Fragment>
                                    ))}
                                    <tr className="border-t-2 font-semibold">
                                        <td className="px-3 py-2" colSpan={2}>
                                            Gesamt
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {zeilen.reduce((s, z) => s + z.liste.length, 0)}
                                        </td>
                                        <td className="px-3 py-2 text-right">{stundenText(gesamtWerktag)}</td>
                                        <td className="px-3 py-2 text-right">{gesamtSonntag > 0 ? stundenText(gesamtSonntag) : "—"}</td>
                                        <td className="px-3 py-2 text-right">{stundenText(gesamt)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p className="mt-3 text-xs text-gray-500">
                        Grundlage sind die geplanten Schichten. Kurzfristige Änderungen (Krankheit, Tausch), die nicht im
                        Wochenplan nachgetragen wurden, sind nicht berücksichtigt.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
