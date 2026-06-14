"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Download } from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Legend,
    CartesianGrid,
} from "recharts";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter, EsskaDailySale } from "@/lib/esska/types";
import { centToEuro, formatDate, formatMoney, isoDatum } from "@/lib/esska/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type Zeitraum = "7d" | "30d" | "saison";

export default function SalesAdminPage() {
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [sales, setSales] = useState<EsskaDailySale[]>([]);
    const [zeitraum, setZeitraum] = useState<Zeitraum>("30d");
    const [centerFilter, setCenterFilter] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const [cRes, sRes] = await Promise.all([
                    client.from("centers").select("*").order("saison", { ascending: false }).order("name"),
                    client.from("daily_sales").select("*").order("datum", { ascending: false }),
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
    }, []);

    const zeitraumStart = useMemo(() => {
        const now = new Date();
        if (zeitraum === "7d") {
            const d = new Date(now);
            d.setDate(d.getDate() - 7);
            return d;
        }
        if (zeitraum === "30d") {
            const d = new Date(now);
            d.setDate(d.getDate() - 30);
            return d;
        }
        const d = new Date(now);
        d.setMonth(d.getMonth() - 6);
        return d;
    }, [zeitraum]);

    const gefiltert = useMemo(() => {
        return sales.filter((s) => {
            if (centerFilter && s.center_id !== centerFilter) return false;
            if (new Date(s.datum) < zeitraumStart) return false;
            return true;
        });
    }, [sales, centerFilter, zeitraumStart]);

    const summe = gefiltert.reduce((acc, s) => acc + s.betrag_cent, 0);
    const tageMitUmsatz = new Set(gefiltert.map((s) => s.datum)).size;
    const durchschnitt = tageMitUmsatz > 0 ? Math.round(summe / tageMitUmsatz) : 0;

    // Tagesreihe fuer Linien-Diagramm
    const tagesReihe = useMemo(() => {
        const map = new Map<string, number>();
        gefiltert.forEach((s) => {
            map.set(s.datum, (map.get(s.datum) ?? 0) + s.betrag_cent);
        });
        return Array.from(map.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([datum, cent]) => ({
                datum: new Date(datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
                Umsatz: cent / 100,
            }));
    }, [gefiltert]);

    // Vergleich je Center (Balken)
    const centerVergleich = useMemo(() => {
        const map = new Map<string, number>();
        gefiltert.forEach((s) => map.set(s.center_id, (map.get(s.center_id) ?? 0) + s.betrag_cent));
        return Array.from(map.entries())
            .map(([cid, cent]) => {
                const c = centers.find((x) => x.id === cid);
                return {
                    name: c ? c.kuerzel : "—",
                    fullName: c?.name ?? "—",
                    Umsatz: cent / 100,
                };
            })
            .sort((a, b) => b.Umsatz - a.Umsatz);
    }, [gefiltert, centers]);

    const csvExport = () => {
        const header = ["Datum", "Center", "Stadt", "Saison", "Betrag_EUR", "Anzahl_Belege", "Notiz"];
        const rows = gefiltert.map((s) => {
            const c = centers.find((x) => x.id === s.center_id);
            return [
                s.datum,
                c?.name ?? "",
                c?.stadt ?? "",
                c?.saison ?? "",
                (s.betrag_cent / 100).toFixed(2).replace(".", ","),
                s.anzahl_belege?.toString() ?? "",
                (s.notiz ?? "").replace(/"/g, '""'),
            ];
        });
        const csv = [header, ...rows]
            .map((r) => r.map((v) => `"${v}"`).join(";"))
            .join("\n");
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Esska_Umsaetze_${isoDatum(new Date())}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Umsätze</h1>
                    <p className="text-gray-500">Tagesumsätze erfassen und auswerten.</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/app/sales/new"
                        className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Umsatz erfassen
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

            <div className="flex flex-wrap gap-3 items-end">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Zeitraum</label>
                    <select
                        value={zeitraum}
                        onChange={(e) => setZeitraum(e.target.value as Zeitraum)}
                        className="border rounded-md px-3 py-2 text-sm"
                    >
                        <option value="7d">Letzte 7 Tage</option>
                        <option value="30d">Letzte 30 Tage</option>
                        <option value="saison">Letzte 6 Monate</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Center</label>
                    <select
                        value={centerFilter}
                        onChange={(e) => setCenterFilter(e.target.value)}
                        className="border rounded-md px-3 py-2 text-sm"
                    >
                        <option value="">Alle Center</option>
                        {centers.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} ({c.kuerzel}) · {c.saison}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Kennzahl titel="Gesamtumsatz" wert={formatMoney(summe)} />
                <Kennzahl titel="Tage mit Umsatz" wert={tageMitUmsatz.toString()} />
                <Kennzahl titel="∅ pro Tag" wert={formatMoney(durchschnitt)} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Umsatzverlauf</CardTitle>
                    <CardDescription>Tagesumsatz im gewählten Zeitraum (€)</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                    {tagesReihe.length === 0 ? (
                        <p className="text-sm text-gray-500">Keine Daten im Zeitraum.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={tagesReihe}>
                                <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                                <XAxis dataKey="datum" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    formatter={(v: number) => `${v.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="Umsatz" stroke="#9e2a2b" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Vergleich je Center</CardTitle>
                    <CardDescription>Summe im gewählten Zeitraum (€)</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                    {centerVergleich.length === 0 ? (
                        <p className="text-sm text-gray-500">Keine Daten im Zeitraum.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={centerVergleich}>
                                <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    labelFormatter={(_l, payload) => payload?.[0]?.payload?.fullName ?? ""}
                                    formatter={(v: number) => `${v.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`}
                                />
                                <Bar dataKey="Umsatz" fill="#9e2a2b" />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Einzeleinträge</CardTitle>
                    <CardDescription>{loading ? "Lädt…" : `${gefiltert.length} Einträge`}</CardDescription>
                </CardHeader>
                <CardContent>
                    {gefiltert.length === 0 ? (
                        <p className="text-sm text-gray-500">Keine Einträge im Zeitraum.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-secondary-50 text-left">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Datum</th>
                                        <th className="px-3 py-2 font-medium">Center</th>
                                        <th className="px-3 py-2 font-medium text-right">Betrag</th>
                                        <th className="px-3 py-2 font-medium text-right">Belege</th>
                                        <th className="px-3 py-2 font-medium">Notiz</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gefiltert.map((s) => {
                                        const c = centers.find((x) => x.id === s.center_id);
                                        return (
                                            <tr key={s.id} className="border-t">
                                                <td className="px-3 py-2">{formatDate(s.datum)}</td>
                                                <td className="px-3 py-2">
                                                    {c?.name ?? "—"}{" "}
                                                    <span className="font-mono text-xs text-gray-500">({c?.kuerzel ?? "—"})</span>
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium">{centToEuro(s.betrag_cent)} €</td>
                                                <td className="px-3 py-2 text-right">{s.anzahl_belege ?? "—"}</td>
                                                <td className="px-3 py-2 text-gray-600">{s.notiz ?? ""}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function Kennzahl({ titel, wert }: { titel: string; wert: string }) {
    return (
        <div className="bg-white border rounded-lg p-4">
            <p className="text-xs uppercase text-gray-500">{titel}</p>
            <p className="text-2xl font-bold text-primary-700 mt-1">{wert}</p>
        </div>
    );
}
