"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter, EsskaCenterZeitraum, EsskaProfile } from "@/lib/esska/types";
import { CENTER_STATUS_LABELS, berechneCenterStatus, formatDate, formatMoney } from "@/lib/esska/types";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";

const statusFarben: Record<EsskaCenter["status"], string> = {
    in_absprache: "bg-amber-100 text-amber-800",
    geplant: "bg-gray-100 text-gray-800",
    aktiv: "bg-green-100 text-green-800",
    abgeschlossen: "bg-blue-100 text-blue-800",
};

export default function CentersPage() {
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [zeitraeume, setZeitraeume] = useState<EsskaCenterZeitraum[]>([]);
    const [managerListe, setManagerListe] = useState<Pick<EsskaProfile, "id" | "vorname" | "nachname" | "email">[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterSaison, setFilterSaison] = useState<string>("");
    const [sortierung, setSortierung] = useState<"name" | "start" | "ende">("name");
    const [gruppierung, setGruppierung] = useState<"keine" | "status" | "manager">("keine");

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const [cRes, zRes, mRes] = await Promise.all([
                    client
                        .from("centers")
                        .select("*")
                        .order("saison", { ascending: false })
                        .order("name", { ascending: true }),
                    client.from("center_zeitraeume").select("*"),
                    client
                        .from("profiles")
                        .select("id, vorname, nachname, email")
                        .in("role", ["admin", "regionalmanager"]),
                ]);
                if (cRes.error) throw cRes.error;
                setCenters((cRes.data as EsskaCenter[]) ?? []);
                // Zeitraeume/Manager sind optional (fehlen z. B. solange die
                // Struktur-Migration nicht eingespielt ist) - kein harter Fehler
                setZeitraeume((zRes.data as EsskaCenterZeitraum[]) ?? []);
                setManagerListe((mRes.data as typeof managerListe) ?? []);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // C-5: Status aus den Zeitraeumen ableiten (nur Anzeige; gespeichert
    // wird der Status beim Speichern des Centers bzw. der Zeitraeume)
    const statusVon = (c: EsskaCenter) =>
        berechneCenterStatus(c.status, zeitraeume.filter((z) => z.center_id === c.id));

    const managerName = (id: string | null) => {
        if (!id) return null;
        const m = managerListe.find((x) => x.id === id);
        if (!m) return "?";
        return `${m.vorname ?? ""} ${m.nachname ?? ""}`.trim() || (m.email ?? "?");
    };

    const saisonOptions = Array.from(new Set(centers.map((c) => c.saison))).sort().reverse();
    const sichtbar = (filterSaison
        ? centers.filter((c) => c.saison === filterSaison)
        : centers
    ).slice().sort((a, b) => {
        if (sortierung === "start") return a.start_datum.localeCompare(b.start_datum);
        if (sortierung === "ende") return a.end_datum.localeCompare(b.end_datum);
        return 0; // Standard: Reihenfolge aus der Datenbank (Saison, Name)
    });

    // C-3/C-6: Gruppierte Darstellung
    const gruppen: Array<[string, EsskaCenter[]]> | null = (() => {
        if (gruppierung === "keine") return null;
        const map = new Map<string, EsskaCenter[]>();
        for (const c of sichtbar) {
            const schluessel =
                gruppierung === "status"
                    ? CENTER_STATUS_LABELS[statusVon(c)]
                    : managerName(c.manager_id) ?? "— Ohne Manager —";
            map.set(schluessel, [...(map.get(schluessel) ?? []), c]);
        }
        return [...map.entries()].sort(([a], [b]) => {
            if (a.startsWith("—")) return 1;
            if (b.startsWith("—")) return -1;
            return a.localeCompare(b, "de");
        });
    })();

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

            <div className="flex items-end gap-3 flex-wrap">
                {saisonOptions.length > 1 && (
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Saison</label>
                        <select
                            value={filterSaison}
                            onChange={(e) => setFilterSaison(e.target.value)}
                            className="border rounded-md px-3 py-1.5 text-sm"
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
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Sortieren nach</label>
                    <select
                        value={sortierung}
                        onChange={(e) => setSortierung(e.target.value as typeof sortierung)}
                        className="border rounded-md px-3 py-1.5 text-sm"
                    >
                        <option value="name">Name</option>
                        <option value="start">Startdatum</option>
                        <option value="ende">Enddatum</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Gruppieren nach</label>
                    <select
                        value={gruppierung}
                        onChange={(e) => setGruppierung(e.target.value as typeof gruppierung)}
                        className="border rounded-md px-3 py-1.5 text-sm"
                    >
                        <option value="keine">Keine Gruppierung</option>
                        <option value="status">Status</option>
                        <option value="manager">Manager</option>
                    </select>
                </div>
            </div>

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
                    {sichtbar.length > 0 && gruppen === null && (
                        <CenterTabelle rows={sichtbar} statusVon={statusVon} managerName={managerName} />
                    )}
                    {sichtbar.length > 0 && gruppen !== null && (
                        <div className="space-y-6">
                            {gruppen.map(([schluessel, rows]) => (
                                <div key={schluessel}>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                        {schluessel}{" "}
                                        <span className="font-normal text-gray-400">({rows.length})</span>
                                    </h3>
                                    <CenterTabelle rows={rows} statusVon={statusVon} managerName={managerName} />
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function CenterTabelle({
    rows,
    statusVon,
    managerName,
}: {
    rows: EsskaCenter[];
    statusVon: (c: EsskaCenter) => keyof typeof statusFarben;
    managerName: (id: string | null) => string | null;
}) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left">
                    <tr>
                        <Th>Saison</Th>
                        <Th>Kürzel</Th>
                        <Th>Center</Th>
                        <Th>Stadt</Th>
                        <Th>Kat.</Th>
                        <Th>Manager</Th>
                        <Th>Start</Th>
                        <Th>Ende</Th>
                        <Th className="text-right">Fläche</Th>
                        <Th className="text-right">Tage</Th>
                        <Th className="text-right">Miete</Th>
                        <Th>Status</Th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((c) => {
                        const status = statusVon(c);
                        return (
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
                                <Td>{managerName(c.manager_id) ?? "—"}</Td>
                                <Td>{formatDate(c.start_datum)}</Td>
                                <Td>{formatDate(c.end_datum)}</Td>
                                <Td className="text-right">
                                    {c.flaeche_qm ? `${c.flaeche_qm} m²` : "—"}
                                </Td>
                                <Td className="text-right">{c.mietdauer_tage ?? "—"}</Td>
                                <Td className="text-right">{formatMoney(c.miete_eur_cent)}</Td>
                                <Td>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusFarben[status]}`}>
                                        {CENTER_STATUS_LABELS[status]}
                                    </span>
                                </Td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <th className={`px-3 py-2 font-medium text-gray-700 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
