"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, CheckCircle2, Download, Image as ImageIcon, Plus, X } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter, EsskaDailySale } from "@/lib/esska/types";
import { isoDatum } from "@/lib/esska/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const BUCKET = "sales-receipts";

type CenterStatus = {
    center: EsskaCenter;
    sale: EsskaDailySale | null;
    fotoDa: boolean;
    umsatzzeitDa: boolean;
    arbeitszeitDa: boolean;
    komplett: boolean;
};

function plusTage(d: Date, t: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + t);
    return x;
}
function zeitKurz(t: string | null): string {
    return t ? t.slice(0, 5) : "—";
}

export default function SalesAdminPage() {
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [sales, setSales] = useState<EsskaDailySale[]>([]);
    const [datum, setDatum] = useState<string>(isoDatum(new Date()));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewSignedUrl, setPreviewSignedUrl] = useState<string | null>(null);
    const [previewLabel, setPreviewLabel] = useState<string>("");

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const [cRes, sRes] = await Promise.all([
                    client.from("centers").select("*").in("status", ["aktiv", "geplant"]).order("name"),
                    client.from("daily_sales").select("*").eq("datum", datum),
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
            const sale = sales.find((s) => s.center_id === c.id) ?? null;
            const fotoDa = !!sale?.beleg_foto_path;
            const umsatzzeitDa = !!(sale?.umsatz_start && sale?.umsatz_ende);
            const arbeitszeitDa = !!(sale?.arbeitszeit_start && sale?.arbeitszeit_ende);
            const komplett = fotoDa && umsatzzeitDa;
            return { center: c, sale, fotoDa, umsatzzeitDa, arbeitszeitDa, komplett };
        });
        // Sortierung: unvollstaendig zuerst, dann nach Center-Name
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

    const showPreview = async (path: string, label: string) => {
        try {
            const client = await getEsskaClient();
            const { data, error: e } = await client.storage
                .from(BUCKET)
                .createSignedUrl(path, 60);
            if (e) throw e;
            setPreviewSignedUrl(data.signedUrl);
            setPreviewLabel(label);
        } catch (err) {
            setError(friendlyError(err, { aktion: "Foto laden" }));
        }
    };

    const csvExport = () => {
        const header = ["Datum", "Center", "Stadt", "Saison", "Arbeitszeit_Start", "Arbeitszeit_Ende", "Umsatz_Start", "Umsatz_Ende", "Foto_vorhanden", "Notiz"];
        const rows = status.map((s) => [
            datum,
            s.center.name,
            s.center.stadt,
            s.center.saison,
            zeitKurz(s.sale?.arbeitszeit_start ?? null),
            zeitKurz(s.sale?.arbeitszeit_ende ?? null),
            zeitKurz(s.sale?.umsatz_start ?? null),
            zeitKurz(s.sale?.umsatz_ende ?? null),
            s.fotoDa ? "ja" : "nein",
            (s.sale?.notiz ?? "").replace(/"/g, '""'),
        ]);
        const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(";")).join("\n");
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Esska_Umsaetze_${datum}.csv`;
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
                        Übersicht aller Center-Verkaufslisten je Tag. Mitarbeiter laden Fotos und Zeiten hoch.
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
                    <CardDescription>{new Date(datum).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</CardDescription>
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

            {/* Center-Liste */}
            <div className="grid gap-4 md:grid-cols-3">
                <Kennzahl titel="Gesamt" wert={status.length.toString()} />
                <Kennzahl titel="Offen" wert={offen.length.toString()} farbe="text-amber-700" />
                <Kennzahl titel="Vollständig" wert={erledigt.length.toString()} farbe="text-green-700" />
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
                                <CardDescription>Hier fehlt Foto oder Umsatzzeit.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <CenterTable rows={offen} onShowFoto={showPreview} />
                            </CardContent>
                        </Card>
                    )}
                    {erledigt.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    Vollständig ({erledigt.length})
                                </CardTitle>
                                <CardDescription>Foto und Umsatzzeit liegen vor.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <CenterTable rows={erledigt} onShowFoto={showPreview} />
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {/* Foto-Vorschau-Modal */}
            {previewSignedUrl && (
                <div
                    onClick={() => setPreviewSignedUrl(null)}
                    className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
                >
                    <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg max-w-4xl w-full p-3 relative">
                        <button
                            onClick={() => setPreviewSignedUrl(null)}
                            className="absolute top-2 right-2 p-1 bg-white rounded-full border hover:bg-secondary-100"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <p className="text-sm font-medium mb-2">{previewLabel}</p>
                        <Image
                            src={previewSignedUrl}
                            alt={previewLabel}
                            width={1200}
                            height={900}
                            unoptimized
                            className="w-full rounded-md object-contain max-h-[80vh]"
                        />
                    </div>
                </div>
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
    onShowFoto,
}: {
    rows: CenterStatus[];
    onShowFoto: (path: string, label: string) => void;
}) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="bg-secondary-50 text-left">
                    <tr>
                        <th className="px-3 py-2 font-medium">Center</th>
                        <th className="px-3 py-2 font-medium">Stadt</th>
                        <th className="px-3 py-2 font-medium">Arbeitszeit</th>
                        <th className="px-3 py-2 font-medium">Umsatzzeit</th>
                        <th className="px-3 py-2 font-medium">Foto</th>
                        <th className="px-3 py-2 font-medium">Notiz</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.center.id} className="border-t">
                            <td className="px-3 py-2">
                                <strong>{r.center.name}</strong>{" "}
                                <span className="font-mono text-xs text-gray-500">({r.center.kuerzel})</span>
                            </td>
                            <td className="px-3 py-2">{r.center.stadt}</td>
                            <td className="px-3 py-2">
                                {r.arbeitszeitDa ? (
                                    <span>
                                        {zeitKurz(r.sale!.arbeitszeit_start)}–{zeitKurz(r.sale!.arbeitszeit_ende)}
                                    </span>
                                ) : (
                                    <span className="text-amber-600 text-xs">fehlt</span>
                                )}
                            </td>
                            <td className="px-3 py-2">
                                {r.umsatzzeitDa ? (
                                    <span>
                                        {zeitKurz(r.sale!.umsatz_start)}–{zeitKurz(r.sale!.umsatz_ende)}
                                    </span>
                                ) : (
                                    <span className="text-amber-600 text-xs">fehlt</span>
                                )}
                            </td>
                            <td className="px-3 py-2">
                                {r.fotoDa ? (
                                    <button
                                        onClick={() => onShowFoto(r.sale!.beleg_foto_path!, `${r.center.name} (${r.center.kuerzel})`)}
                                        className="inline-flex items-center text-primary-600 hover:underline"
                                    >
                                        <ImageIcon className="h-4 w-4 mr-1" />
                                        ansehen
                                    </button>
                                ) : (
                                    <span className="text-amber-600 text-xs">fehlt</span>
                                )}
                            </td>
                            <td className="px-3 py-2 text-gray-600">{r.sale?.notiz ?? ""}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
