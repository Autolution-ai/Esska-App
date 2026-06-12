"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getEsskaClient } from "@/lib/esska/client";
import type { EsskaCenter } from "@/lib/esska/types";
import { euroToCent, isoDatum } from "@/lib/esska/types";

export default function SalesEntryPage() {
    const router = useRouter();
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [centerId, setCenterId] = useState("");
    const [datum, setDatum] = useState(isoDatum(new Date()));
    const [betragEuro, setBetragEuro] = useState("");
    const [belege, setBelege] = useState("");
    const [notiz, setNotiz] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const { data: { user } } = await client.auth.getUser();
                if (!user) throw new Error("Nicht angemeldet");

                const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).single();
                const istAdmin = (profile as { role?: string } | null)?.role === "admin";

                if (istAdmin) {
                    const { data, error: e } = await client
                        .from("centers")
                        .select("*")
                        .in("status", ["aktiv", "geplant"])
                        .order("name");
                    if (e) throw e;
                    const cs = (data as EsskaCenter[]) ?? [];
                    setCenters(cs);
                    if (cs[0]) setCenterId(cs[0].id);
                } else {
                    const { data, error: e } = await client
                        .from("center_assignments")
                        .select("centers(*)")
                        .eq("profile_id", user.id);
                    if (e) throw e;
                    const cs = ((data as unknown) as Array<{ centers: EsskaCenter | null }> ?? [])
                        .flatMap((r) => (r.centers ? [r.centers] : []));
                    setCenters(cs);
                    if (cs[0]) setCenterId(cs[0].id);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Fehler beim Laden");
            }
        };
        load();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!centerId || !datum || !betragEuro) {
            setError("Center, Datum und Betrag sind Pflicht.");
            return;
        }
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const client = await getEsskaClient();
            const { data: { user } } = await client.auth.getUser();
            if (!user) throw new Error("Nicht angemeldet");
            const { error: e } = await client.from("daily_sales").upsert(
                {
                    center_id: centerId,
                    datum,
                    betrag_cent: euroToCent(betragEuro),
                    anzahl_belege: belege ? parseInt(belege, 10) || null : null,
                    notiz: notiz.trim() || null,
                    erfasst_von: user.id,
                },
                { onConflict: "center_id,datum" }
            );
            if (e) throw e;
            setSuccess("Umsatz gespeichert.");
            setBetragEuro("");
            setBelege("");
            setNotiz("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 p-2 md:p-6 max-w-xl">
            <Link href="/app/sales" className="text-sm text-primary-600 hover:underline">
                ← Zurück zur Übersicht
            </Link>
            <h1 className="text-2xl font-bold">Tagesumsatz erfassen</h1>
            <p className="text-gray-600 text-sm">
                Pro Center und Tag genau ein Eintrag. Ein erneuter Eintrag für denselben Tag überschreibt den vorherigen.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 bg-white border rounded-lg p-4">
                {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
                {success && <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{success}</div>}

                <div>
                    <label className="block text-sm font-medium mb-1">Center</label>
                    <select
                        value={centerId}
                        onChange={(e) => setCenterId(e.target.value)}
                        required
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                        <option value="">– wählen –</option>
                        {centers.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} ({c.kuerzel}) · {c.saison}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">Datum</label>
                        <input
                            type="date"
                            value={datum}
                            onChange={(e) => setDatum(e.target.value)}
                            required
                            max={isoDatum(new Date())}
                            className="w-full border rounded-md px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Betrag (€)</label>
                        <input
                            value={betragEuro}
                            onChange={(e) => setBetragEuro(e.target.value)}
                            inputMode="decimal"
                            required
                            placeholder="z. B. 1.245,80"
                            className="w-full border rounded-md px-3 py-2 text-sm"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Anzahl Belege (optional)</label>
                    <input
                        value={belege}
                        onChange={(e) => setBelege(e.target.value)}
                        inputMode="numeric"
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Notiz (optional)</label>
                    <textarea
                        value={notiz}
                        onChange={(e) => setNotiz(e.target.value)}
                        rows={3}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                        {saving ? "Speichern…" : "Speichern"}
                    </button>
                    <button type="button" onClick={() => router.push("/app/sales")} className="px-4 py-2 border rounded-md hover:bg-secondary-100">
                        Abbrechen
                    </button>
                </div>
            </form>
        </div>
    );
}
