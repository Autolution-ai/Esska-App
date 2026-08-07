"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Download, History, Plus } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter, EsskaDailySale } from "@/lib/esska/types";
import { isoDatum } from "@/lib/esska/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type CenterStatus = {
    center: EsskaCenter;
    /** Der aktuell gueltige (neueste) Eintrag fuer diesen Tag. */
    sale: EsskaDailySale | null;
    /** Aeltere, durch Korrektur ersetzte Eintraege – bleiben dauerhaft erhalten. */
    historie: EsskaDailySale[];
    /** Start- und Endbestand liegen vor – der Eintrag gilt damit als erledigt. */
    komplett: boolean;
};

function plusTage(d: Date, t: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + t);
    return x;
}

/** Bargeld-Betrag als deutsch formatierter Euro-Wert, oder Strich wenn nicht erfasst. */
function bargeld(cent: number | null | undefined): string {
    if (cent === null || cent === undefined) return "—";
    return (cent / 100).toLocaleString("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function SalesAdminPage() {
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [sales, setSales] = useState<EsskaDailySale[]>([]);
    const [datum, setDatum] = useState<string>(isoDatum(new Date()));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [historieOffen, setHistorieOffen] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const [cRes, sRes] = await Promise.all([
                    client.from("centers").select("*").in("status", ["aktiv", "geplant"]).order("name"),
                    client
                        .from("daily_sales")
                        .select("*")
                        .eq("datum", datum)
                        .order("erfasst_am", { ascending: false }),
                ]);
                if (cRes.error) throw cRes.error;
                if (sRes.error) throw sRes.error;
                setCenters((cRes.data as EsskaCenter[]) ?? []);
                setSales((sRes.data as EsskaDailySale[]) ?? []);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [datum]);

    const status: CenterStatus[] = useMemo(() => {
        const list = centers.map((c) => {
            // sales ist bereits nach erfasst_am absteigend sortiert:
            // der erste Treffer ist der aktuell gueltige Eintrag.
            const alle = sales.filter((s) => s.center_id === c.id);
            const sale = alle[0] ?? null;
            const historie = alle.slice(1);
            const komplett =
                sale?.startbestand_cent !== null &&
                sale?.startbestand_cent !== undefined &&
                sale?.endbestand_cent !== null &&
                sale?.endbestand_cent !== undefined;
            return { center: c, sale, historie, komplett };
        });
        return list.sort((a, b) => {
            if (a.komplett !== b.komplett) return a.komplett ? 1 : -1;
            return a.center.name.localeCompare(b.center.name, "de");
        });
    }, [centers, sales]);

    const offen = status.filter((s) => !s.komplett);
    const erledigt = status.filter((s) => s.komplett);

    const setQuickDate = (offset: number) => {
        setDatum(isoDatum(plusTage(new Date(), offset)));
    };

    const csvExport = () => {
        const header = [
            "Datum", "Center", "Stadt", "Saison",
            "Startbestand", "Einnahmen", "Ausgaben", "Endbestand", "Abschoepfung",
            "Erfasst_am", "Korrektur", "Korrektur_Grund", "Notiz",
        ];
        // Export enthaelt bewusst ALLE Eintraege inkl. Korrekturhistorie,
        // damit die Aufzeichnung fuer die Buchhaltung vollstaendig ist.
        const rows = status.flatMap((s) =>
            [s.sale, ...s.historie].filter(Boolean).map((e) => [
                datum,
                s.center.name,
                s.center.stadt,
                s.center.saison,
                bargeld(e!.startbestand_cent),
                bargeld(e!.einnahmen_cent),
                bargeld(e!.ausgaben_cent),
                bargeld(e!.endbestand_cent),
                bargeld(e!.abschoepfung_cent),
                new Date(e!.erfasst_am).toLocaleString("de-DE"),
                e!.korrigiert_eintrag_id ? "ja" : "nein",
                (e!.korrektur_grund ?? "").replace(/"/g, '""'),
                (e!.notiz ?? "").replace(/"/g, '""'),
            ])
        );
        const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(";")).join("\n");
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Esska_Kassenbericht_${datum}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const datumAlsText = (() => {
        const today = isoDatum(new Date());
        if (datum === today) return "Heute";
        if (datum === isoDatum(plusTage(new Date(), -1))) return "Gestern";
        if (datum === isoDatum(plusTage(new Date(), -2))) return "Vorgestern";
        return new Date(datum).toLocaleDateString("de-DE");
    })();

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Umsätze</h1>
                    <p className="text-gray-500 text-sm">
                        Übersicht des Bargeldbestands aller Center je Tag.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/app/sales/new"
                        className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Eintrag erfassen
                    </Link>
                    <button
                        onClick={csvExport}
                        className="inline-flex items-center px-4 py-2 border rounded-md hover:bg-secondary-100"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        CSV
                    </button>
                </div>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

            {/* Datums-Quickwahl */}
            <Card>
                <CardHeader>
                    <CardTitle>{datumAlsText}</CardTitle>
                    <CardDescription>
                        {new Date(datum).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setQuickDate(0)} className={chip(datum === isoDatum(new Date()))}>Heute</button>
                        <button onClick={() => setQuickDate(-1)} className={chip(datum === isoDatum(plusTage(new Date(), -1)))}>Gestern</button>
                        <button onClick={() => setQuickDate(-2)} className={chip(datum === isoDatum(plusTage(new Date(), -2)))}>Vorgestern</button>
                        <input
                            type="date"
                            value={datum}
                            onChange={(e) => setDatum(e.target.value)}
                            max={isoDatum(new Date())}
                            className="border rounded-md px-3 py-1.5 text-sm"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Kennzahlen */}
            <div className="grid gap-4 md:grid-cols-3">
                <Kennzahl titel="Gesamt" wert={status.length.toString()} />
                <Kennzahl titel="Offen" wert={offen.length.toString()} farbe="text-amber-700" />
                <Kennzahl titel="Erfasst" wert={erledigt.length.toString()} farbe="text-green-700" />
            </div>

            {loading ? (
                <p className="text-gray-500">Lädt…</p>
            ) : status.length === 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Keine aktiven Center</CardTitle>
                        <CardDescription>Lege zuerst Center an, dann erscheinen sie hier.</CardDescription>
                    </CardHeader>
                </Card>
            ) : (
                <>
                    {offen.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-amber-600" />
                                    Noch offen ({offen.length})
                                </CardTitle>
                                <CardDescription>Hier fehlt der Bargeldbestand.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <CenterTable
                                    rows={offen}
                                    historieOffen={historieOffen}
                                    setHistorieOffen={setHistorieOffen}
                                />
                            </CardContent>
                        </Card>
                    )}
                    {erledigt.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    Erfasst ({erledigt.length})
                                </CardTitle>
                                <CardDescription>Start- und Endbestand liegen vor.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <CenterTable
                                    rows={erledigt}
                                    historieOffen={historieOffen}
                                    setHistorieOffen={setHistorieOffen}
                                />
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}

function chip(active: boolean) {
    return `px-3 py-1.5 text-sm rounded-md border ${
        active ? "bg-primary-600 text-white border-primary-600" : "hover:bg-secondary-100"
    }`;
}

function Kennzahl({ titel, wert, farbe = "text-primary-700" }: { titel: string; wert: string; farbe?: string }) {
    return (
        <div className="bg-white border rounded-lg p-4">
            <p className="text-xs uppercase text-gray-500">{titel}</p>
            <p className={`text-2xl font-bold mt-1 ${farbe}`}>{wert}</p>
        </div>
    );
}

function CenterTable({
    rows,
    historieOffen,
    setHistorieOffen,
}: {
    rows: CenterStatus[];
    historieOffen: string | null;
    setHistorieOffen: (id: string | null) => void;
}) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="bg-secondary-50 text-left">
                    <tr>
                        <th className="px-3 py-2 font-medium">Center</th>
                        <th className="px-3 py-2 font-medium text-right">Startbestand</th>
                        <th className="px-3 py-2 font-medium text-right">Einnahmen</th>
                        <th className="px-3 py-2 font-medium text-right">Ausgaben</th>
                        <th className="px-3 py-2 font-medium text-right">Endbestand</th>
                        <th className="px-3 py-2 font-medium text-right">Abschöpfung</th>
                        <th className="px-3 py-2 font-medium">Notiz</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <React.Fragment key={r.center.id}>
                            <tr className="border-t">
                                <td className="px-3 py-2">
                                    <strong>{r.center.name}</strong>{" "}
                                    <span className="font-mono text-xs text-gray-500">({r.center.kuerzel})</span>
                                    <div className="text-xs text-gray-500">{r.center.stadt}</div>
                                    {r.historie.length > 0 && (
                                        <button
                                            onClick={() =>
                                                setHistorieOffen(historieOffen === r.center.id ? null : r.center.id)
                                            }
                                            className="mt-1 inline-flex items-center text-xs text-amber-700 hover:underline"
                                        >
                                            <History className="h-3 w-3 mr-1" />
                                            {r.historie.length} frühere Fassung
                                            {r.historie.length === 1 ? "" : "en"}
                                        </button>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-right">{bargeld(r.sale?.startbestand_cent)}</td>
                                <td className="px-3 py-2 text-right">{bargeld(r.sale?.einnahmen_cent)}</td>
                                <td className="px-3 py-2 text-right">{bargeld(r.sale?.ausgaben_cent)}</td>
                                <td className="px-3 py-2 text-right font-medium">{bargeld(r.sale?.endbestand_cent)}</td>
                                <td className="px-3 py-2 text-right">{bargeld(r.sale?.abschoepfung_cent)}</td>
                                <td className="px-3 py-2 text-gray-600">{r.sale?.notiz ?? ""}</td>
                            </tr>
                            {historieOffen === r.center.id &&
                                r.historie.map((h) => (
                                    <tr key={h.id} className="bg-amber-50/40 text-xs text-gray-600">
                                        <td className="px-3 py-1.5 pl-6">
                                            ersetzt · erfasst {new Date(h.erfasst_am).toLocaleString("de-DE")}
                                            {r.sale?.korrektur_grund && (
                                                <div className="italic">Grund: {r.sale.korrektur_grund}</div>
                                            )}
                                        </td>
                                        <td className="px-3 py-1.5 text-right">{bargeld(h.startbestand_cent)}</td>
                                        <td className="px-3 py-1.5 text-right">{bargeld(h.einnahmen_cent)}</td>
                                        <td className="px-3 py-1.5 text-right">{bargeld(h.ausgaben_cent)}</td>
                                        <td className="px-3 py-1.5 text-right">{bargeld(h.endbestand_cent)}</td>
                                        <td className="px-3 py-1.5 text-right">{bargeld(h.abschoepfung_cent)}</td>
                                        <td className="px-3 py-1.5">{h.notiz ?? ""}</td>
                                    </tr>
                                ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
