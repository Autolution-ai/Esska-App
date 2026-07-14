"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter } from "@/lib/esska/types";
import CenterForm from "../../CenterForm";

export default function EditCenterPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const [center, setCenter] = useState<EsskaCenter | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
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

    const handleDelete = async () => {
        if (!center) return;
        const bestaetigt = confirm(
            `Center "${center.name}" (${center.kuerzel}) wirklich löschen?\n\n` +
            `Damit werden auch alle zugehörigen Daten unwiderruflich entfernt:\n` +
            `– Mitarbeiter-Zuordnungen\n` +
            `– Wochenpläne und Schichten\n` +
            `– Umsatz-Einträge und Verkaufslisten-Fotos\n\n` +
            `Dieser Schritt kann nicht rückgängig gemacht werden.`
        );
        if (!bestaetigt) return;
        setDeleting(true);
        setError(null);
        try {
            const client = await getEsskaClient();
            const { error: e } = await client.from("centers").delete().eq("id", center.id);
            if (e) throw e;
            router.push("/app/centers");
        } catch (err) {
            setError(friendlyError(err, { aktion: "Löschen fehlgeschlagen" }));
            setDeleting(false);
        }
    };

    if (loading) return <div className="p-6 text-gray-500">Lädt…</div>;
    if (error && !center) {
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
    if (!center) {
        return (
            <div className="p-6">
                <Link href="/app/centers" className="text-sm text-primary-600 hover:underline">
                    ← Zurück
                </Link>
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                    Center nicht gefunden.
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
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
                <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center px-3 py-2 border border-red-300 text-red-700 rounded-md text-sm hover:bg-red-50 disabled:opacity-50"
                    title="Center und alle zugehörigen Daten löschen"
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleting ? "Lösche…" : "Center löschen"}
                </button>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

            <CenterForm center={center} />
        </div>
    );
}
