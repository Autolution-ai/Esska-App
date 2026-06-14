"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter } from "@/lib/esska/types";
import { formatDate, formatMoney } from "@/lib/esska/types";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";

const statusFarben: Record<EsskaCenter["status"], string> = {
    geplant: "bg-gray-100 text-gray-800",
    aktiv: "bg-green-100 text-green-800",
    abgeschlossen: "bg-blue-100 text-blue-800",
};

export default function CentersPage() {
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterSaison, setFilterSaison] = useState<string>("");

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const { data, error: e } = await client
                    .from("centers")
                    .select("*")
                    .order("saison", { ascending: false })
                    .order("name", { ascending: true });
                if (e) throw e;
                setCenters((data as EsskaCenter[]) ?? []);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const saisonOptions = Array.from(new Set(centers.map((c) => c.saison))).sort().reverse();
    const sichtbar = filterSaison
        ? centers.filter((c) => c.saison === filterSaison)
        : centers;

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Center</h1>
                    <p className="text-gray-500">Standorte je Saison anlegen und verwalten.</p>
                </div>
                <Link
                    href="/app/centers/new"
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Center anlegen
                </Link>
            </div>

            {saisonOptions.length > 1 && (
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Saison:</label>
                    <select
                        value={filterSaison}
                        onChange={(e) => setFilterSaison(e.target.value)}
                        className="border rounded-md px-3 py-1 text-sm"
                    >
                        <option value="">alle</option>
                        {saisonOptions.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Übersicht</CardTitle>
                    <CardDescription>
                        {loading
                            ? "Lädt…"
                            : `${sichtbar.length} Center${
                                filterSaison ? ` in Saison ${filterSaison}` : ""
                            }`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm mb-3">
                            {error}
                        </div>
                    )}
                    {!loading && sichtbar.length === 0 && (
                        <div className="text-center py-10 text-gray-500">
                            Noch keine Center angelegt.
                            <div className="mt-2">
                                <Link href="/app/centers/new" className="text-primary-600 underline">
                                    Jetzt erstes Center anlegen
                                </Link>
                            </div>
                        </div>
                    )}
                    {sichtbar.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-left">
                                    <tr>
                                        <Th>Saison</Th>
                                        <Th>Kürzel</Th>
                                        <Th>Center</Th>
                                        <Th>Stadt</Th>
                                        <Th>Kat.</Th>
                                        <Th>Start</Th>
                                        <Th>Ende</Th>
                                        <Th className="text-right">Fläche</Th>
                                        <Th className="text-right">Tage</Th>
                                        <Th className="text-right">Miete</Th>
                                        <Th>Status</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sichtbar.map((c) => (
                                        <tr key={c.id} className="border-t hover:bg-gray-50">
                                            <Td>{c.saison}</Td>
                                            <Td className="font-mono">{c.kuerzel}</Td>
                                            <Td>
                                                <Link
                                                    href={`/app/centers/${c.id}`}
                                                    className="text-primary-600 hover:underline"
                                                >
                                                    {c.name}
                                                </Link>
                                            </Td>
                                            <Td>{c.stadt}</Td>
                                            <Td>{c.kategorie}</Td>
                                            <Td>{formatDate(c.start_datum)}</Td>
                                            <Td>{formatDate(c.end_datum)}</Td>
                                            <Td className="text-right">
                                                {c.flaeche_qm ? `${c.flaeche_qm} m²` : "—"}
                                            </Td>
                                            <Td className="text-right">{c.mietdauer_tage ?? "—"}</Td>
                                            <Td className="text-right">{formatMoney(c.miete_eur_cent)}</Td>
                                            <Td>
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-xs ${statusFarben[c.status]}`}
                                                >
                                                    {c.status}
                                                </span>
                                            </Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <th className={`px-3 py-2 font-medium text-gray-700 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
