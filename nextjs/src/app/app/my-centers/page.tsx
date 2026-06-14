"use client";

import React, { useEffect, useState } from "react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter } from "@/lib/esska/types";
import { formatDate } from "@/lib/esska/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type Row = EsskaCenter & { rolle_im_center?: string | null };

export default function MyCentersPage() {
    const [centers, setCenters] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const { data: { user } } = await client.auth.getUser();
                if (!user) throw new Error("Nicht angemeldet");

                const { data, error: e } = await client
                    .from("center_assignments")
                    .select("rolle_im_center, centers(*)")
                    .eq("profile_id", user.id);
                if (e) throw e;

                const rows: Row[] = ((data as unknown) as Array<{ rolle_im_center: string | null; centers: EsskaCenter | null }> ?? []).flatMap((row) => {
                    if (!row.centers) return [];
                    return [{ ...row.centers, rolle_im_center: row.rolle_im_center }];
                });
                setCenters(rows);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    return (
        <div className="space-y-6 p-2 md:p-6">
            <h1 className="text-2xl font-bold">Meine Center</h1>
            {loading ? (
                <p className="text-gray-500">Lädt…</p>
            ) : error ? (
                <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
            ) : centers.length === 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Noch keine Zuordnung</CardTitle>
                        <CardDescription>
                            Sobald du einem Center zugeordnet wirst, erscheint es hier.
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {centers.map((c) => (
                        <Card key={c.id}>
                            <CardHeader>
                                <CardTitle>
                                    {c.name}{" "}
                                    <span className="font-mono text-sm text-gray-500">({c.kuerzel})</span>
                                </CardTitle>
                                <CardDescription>
                                    {c.stadt} · Saison {c.saison}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-700">
                                    {formatDate(c.start_datum)} – {formatDate(c.end_datum)}
                                </p>
                                {c.rolle_im_center && (
                                    <p className="text-sm text-gray-600 mt-2">
                                        Rolle: <span className="font-medium">{c.rolle_im_center}</span>
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
