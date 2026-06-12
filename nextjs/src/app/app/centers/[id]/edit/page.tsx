"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getEsskaClient } from "@/lib/esska/client";
import type { EsskaCenter } from "@/lib/esska/types";
import CenterForm from "../../CenterForm";

export default function EditCenterPage() {
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
                setError(err instanceof Error ? err.message : "Fehler beim Laden");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [params.id]);

    if (loading) return <div className="p-6 text-gray-500">Lädt…</div>;
    if (error || !center) {
        return (
            <div className="p-6">
                <Link href="/app/centers" className="text-sm text-primary-600 hover:underline">
                    ← Zurück
                </Link>
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                    {error ?? "Center nicht gefunden."}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div>
                <Link
                    href={`/app/centers/${center.id}`}
                    className="text-sm text-primary-600 hover:underline"
                >
                    ← Zurück zum Center
                </Link>
                <h1 className="text-2xl font-bold mt-2">Center bearbeiten</h1>
                <p className="text-gray-500">{center.name}</p>
            </div>
            <CenterForm center={center} />
        </div>
    );
}
