"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter } from "@/lib/esska/types";
import { formatDate, formatMoney } from "@/lib/esska/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function CenterDetailPage() {
    const params = useParams<{ id: string }>();
    const [center, setCenter] = useState<EsskaCenter | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const { data, error: e } = await client
                    .from("centers")
                    .select("*")
                    .eq("id", params.id)
                    .single();
                if (e) throw e;
                setCenter(data as EsskaCenter);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [params.id]);

    if (loading) {
        return <div className="p-6 text-gray-500">Lädt…</div>;
    }

    if (error || !center) {
        return (
            <div className="p-6">
                <Link href="/app/centers" className="text-sm text-primary-600 hover:underline">
                    ← Zurück zur Center-Liste
                </Link>
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                    {error ?? "Center nicht gefunden."}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <Link href="/app/centers" className="text-sm text-primary-600 hover:underline">
                        ← Zurück zur Center-Liste
                    </Link>
                    <h1 className="text-2xl font-bold mt-2">
                        {center.name}{" "}
                        <span className="font-mono text-base text-gray-500">({center.kuerzel})</span>
                    </h1>
                    <p className="text-gray-500">
                        {center.stadt} · Saison {center.saison} · Kategorie {center.kategorie}
                    </p>
                </div>
                <Link
                    href={`/app/centers/${center.id}/edit`}
                    className="inline-flex items-center px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                    <Pencil className="h-4 w-4 mr-2" />
                    Bearbeiten
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Zeitraum & Fläche</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DL
                            rows={[
                                ["Start", formatDate(center.start_datum)],
                                ["Ende", formatDate(center.end_datum)],
                                ["Mietdauer", center.mietdauer_tage ? `${center.mietdauer_tage} Tage` : "—"],
                                ["Position", center.flaeche_position ?? "—"],
                                ["Länge × Breite", center.laenge_m && center.breite_m ? `${center.laenge_m} m × ${center.breite_m} m` : "—"],
                                ["Fläche", center.flaeche_qm ? `${center.flaeche_qm} m²` : "—"],
                            ]}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Miete & Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DL
                            rows={[
                                ["Saisonmiete", formatMoney(center.miete_eur_cent)],
                                ["Status", center.status],
                                ["Notiz", center.notiz ?? "—"],
                                ["Angelegt", formatDate(center.created_at)],
                                ["Geändert", formatDate(center.updated_at)],
                            ]}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function DL({ rows }: { rows: [string, React.ReactNode][] }) {
    return (
        <dl className="space-y-2">
            {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b last:border-0 py-1.5">
                    <dt className="text-sm text-gray-500">{label}</dt>
                    <dd className="text-sm font-medium text-gray-900 text-right">{value}</dd>
                </div>
            ))}
        </dl>
    );
}
