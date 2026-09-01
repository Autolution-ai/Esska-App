"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type {
    EsskaCenter,
    EsskaCenterOpeningHour,
    EsskaCenterZeitraum,
    EsskaProfile,
    EsskaZeitraumTyp,
} from "@/lib/esska/types";
import {
    CENTER_STATUS_LABELS,
    WOCHENTAG_LABELS,
    ZEITRAUM_TYP_LABELS,
    berechneCenterStatus,
    formatDate,
    formatMoney,
} from "@/lib/esska/types";
import { useGlobal } from "@/lib/context/GlobalContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type MiniProfil = Pick<EsskaProfile, "id" | "vorname" | "nachname" | "email" | "role">;

export default function CenterDetailPage() {
    const params = useParams<{ id: string }>();
    const { role } = useGlobal();
    const darfBearbeiten = role === "admin" || role === "regionalmanager";

    const [center, setCenter] = useState<EsskaCenter | null>(null);
    const [mitarbeiter, setMitarbeiter] = useState<MiniProfil[]>([]);
    const [managerProfil, setManagerProfil] = useState<MiniProfil | null>(null);
    const [zeitraeume, setZeitraeume] = useState<EsskaCenterZeitraum[]>([]);
    const [oeffnung, setOeffnung] = useState<EsskaCenterOpeningHour[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Neuer Zeitraum (C-9/C-10)
    const [neuTyp, setNeuTyp] = useState<EsskaZeitraumTyp>("verlaengerung");
    const [neuVon, setNeuVon] = useState("");
    const [neuBis, setNeuBis] = useState("");
    const [neuNotiz, setNeuNotiz] = useState("");
    const [busy, setBusy] = useState(false);

    const load = async () => {
        try {
            const client = await getEsskaClient();
            const [cRes, aRes, zRes, oRes] = await Promise.all([
                client.from("centers").select("*").eq("id", params.id).single(),
                client
                    .from("center_assignments")
                    .select("profiles(id, vorname, nachname, email, role)")
                    .eq("center_id", params.id),
                client.from("center_zeitraeume").select("*").eq("center_id", params.id).order("von"),
                client.from("center_opening_hours").select("*").eq("center_id", params.id).order("wochentag"),
            ]);
            if (cRes.error) throw cRes.error;
            const c = cRes.data as EsskaCenter;
            setCenter(c);
            setMitarbeiter(
                (((aRes.data as unknown) as Array<{ profiles: MiniProfil | null }>) ?? [])
                    .flatMap((r) => (r.profiles ? [r.profiles] : []))
                    .sort((x, y) => (x.nachname ?? "").localeCompare(y.nachname ?? "", "de"))
            );
            setZeitraeume((zRes.data as EsskaCenterZeitraum[]) ?? []);
            setOeffnung((oRes.data as EsskaCenterOpeningHour[]) ?? []);

            if (c.manager_id) {
                const { data: mData } = await client
                    .from("profiles")
                    .select("id, vorname, nachname, email, role")
                    .eq("id", c.manager_id)
                    .maybeSingle();
                setManagerProfil((mData as MiniProfil | null) ?? null);
            } else {
                setManagerProfil(null);
            }
        } catch (err) {
            setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id]);

    // Nach jeder Zeitraum-Aenderung den gespeicherten Status nachziehen
    // (C-5: Status ist aus den Zeitraeumen abgeleitet)
    const statusSynchronisieren = async (neueZeitraeume: EsskaCenterZeitraum[]) => {
        if (!center || center.status === "in_absprache") return;
        const neu = berechneCenterStatus(center.status, neueZeitraeume);
        if (neu !== center.status) {
            const client = await getEsskaClient();
            await client.from("centers").update({ status: neu }).eq("id", center.id);
            setCenter({ ...center, status: neu });
        }
    };

    const zeitraumAnlegen = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!neuVon) return;
        setBusy(true);
        setError(null);
        try {
            const client = await getEsskaClient();
            const { data, error: e2 } = await client
                .from("center_zeitraeume")
                .insert({
                    center_id: params.id,
                    typ: neuTyp,
                    von: neuVon,
                    bis: neuBis || null,
                    notiz: neuNotiz.trim() || null,
                })
                .select("*")
                .single();
            if (e2) throw e2;
            const neueListe = [...zeitraeume, data as EsskaCenterZeitraum].sort((a, b) => a.von.localeCompare(b.von));
            setZeitraeume(neueListe);
            await statusSynchronisieren(neueListe);
            setNeuVon("");
            setNeuBis("");
            setNeuNotiz("");
        } catch (err) {
            setError(friendlyError(err, { aktion: "Zeitraum anlegen" }));
        } finally {
            setBusy(false);
        }
    };

    const zeitraumLoeschen = async (z: EsskaCenterZeitraum) => {
        if (z.typ === "miete") return; // Mietzeitraum pflegt das Bearbeiten-Formular
        setBusy(true);
        setError(null);
        try {
            const client = await getEsskaClient();
            const { error: e2 } = await client.from("center_zeitraeume").delete().eq("id", z.id);
            if (e2) throw e2;
            const neueListe = zeitraeume.filter((x) => x.id !== z.id);
            setZeitraeume(neueListe);
            await statusSynchronisieren(neueListe);
        } catch (err) {
            setError(friendlyError(err, { aktion: "Zeitraum löschen" }));
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return <div className="p-6 text-gray-500">Lädt…</div>;
    }

    if (error && !center) {
        return (
            <div className="p-6">
                <Link href="/app/centers" className="text-sm text-primary-600 hover:underline">
                    ← Zurück zur Center-Liste
                </Link>
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                    {error}
                </div>
            </div>
        );
    }
    if (!center) return null;

    const status = berechneCenterStatus(center.status, zeitraeume);
    const managerText = managerProfil
        ? `${managerProfil.vorname ?? ""} ${managerProfil.nachname ?? ""}`.trim() || (managerProfil.email ?? "?")
        : "—";

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
                        {center.stadt} · Saison {center.saison} · Kategorie {center.kategorie} ·{" "}
                        {CENTER_STATUS_LABELS[status]}
                    </p>
                </div>
                {darfBearbeiten && (
                    <Link
                        href={`/app/centers/${center.id}/edit`}
                        className="inline-flex items-center px-4 py-2 border rounded-md hover:bg-gray-50"
                    >
                        <Pencil className="h-4 w-4 mr-2" />
                        Bearbeiten
                    </Link>
                )}
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

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
                        <CardTitle>Miete, Status & Manager</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DL
                            rows={[
                                ["Saisonmiete", formatMoney(center.miete_eur_cent)],
                                ["Status", CENTER_STATUS_LABELS[status]],
                                ["Regionalmanager", managerText],
                                ["Notiz", center.notiz ?? "—"],
                                ["Angelegt", formatDate(center.created_at)],
                                ["Geändert", formatDate(center.updated_at)],
                            ]}
                        />
                    </CardContent>
                </Card>
            </div>

            {/* C-9/C-10: Zeitraeume als Historie */}
            <Card>
                <CardHeader>
                    <CardTitle>Zeiträume</CardTitle>
                    <CardDescription>
                        Verlängerungen und der tatsächliche Betriebsbeginn werden hier als eigene
                        Einträge festgehalten – so bleibt über die Jahre nachvollziehbar, welches
                        Center wie oft und bis wann verlängert wurde. Der Status (Geplant/Aktiv/Beendet)
                        wird daraus automatisch berechnet.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <table className="min-w-full text-sm">
                        <thead className="bg-secondary-50 text-left">
                            <tr>
                                <th className="px-3 py-2 font-medium">Art</th>
                                <th className="px-3 py-2 font-medium">Von</th>
                                <th className="px-3 py-2 font-medium">Bis</th>
                                <th className="px-3 py-2 font-medium">Notiz</th>
                                <th className="px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {zeitraeume.map((z) => (
                                <tr key={z.id} className="border-t">
                                    <td className="px-3 py-2">{ZEITRAUM_TYP_LABELS[z.typ]}</td>
                                    <td className="px-3 py-2">{formatDate(z.von)}</td>
                                    <td className="px-3 py-2">{z.bis ? formatDate(z.bis) : "offen"}</td>
                                    <td className="px-3 py-2 text-gray-600">{z.notiz ?? ""}</td>
                                    <td className="px-3 py-2 text-right">
                                        {darfBearbeiten && z.typ !== "miete" && (
                                            <button
                                                onClick={() => zeitraumLoeschen(z)}
                                                disabled={busy}
                                                className="text-red-600 hover:text-red-800"
                                                title="Zeitraum löschen"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {zeitraeume.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-3 py-4 text-gray-500 text-center">
                                        Noch keine Zeiträume erfasst.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {darfBearbeiten && (
                        <form onSubmit={zeitraumAnlegen} className="flex flex-wrap items-end gap-3 border-t pt-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Art</label>
                                <select
                                    value={neuTyp}
                                    onChange={(e) => setNeuTyp(e.target.value as EsskaZeitraumTyp)}
                                    className="border rounded-md px-3 py-2 text-sm"
                                >
                                    <option value="verlaengerung">{ZEITRAUM_TYP_LABELS.verlaengerung}</option>
                                    <option value="betrieb">{ZEITRAUM_TYP_LABELS.betrieb}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Von</label>
                                <input
                                    type="date"
                                    value={neuVon}
                                    onChange={(e) => setNeuVon(e.target.value)}
                                    required
                                    className="border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Bis (optional)</label>
                                <input
                                    type="date"
                                    value={neuBis}
                                    onChange={(e) => setNeuBis(e.target.value)}
                                    className="border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                            <div className="flex-1 min-w-40">
                                <label className="block text-xs text-gray-500 mb-1">Notiz</label>
                                <input
                                    value={neuNotiz}
                                    onChange={(e) => setNeuNotiz(e.target.value)}
                                    placeholder="z. B. Start real am 18., Transport ausgefallen"
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={busy || !neuVon}
                                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Hinzufügen
                            </button>
                        </form>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                {/* C-7/C-8: Oeffnungszeiten */}
                <Card>
                    <CardHeader>
                        <CardTitle>Öffnungstage & -zeiten</CardTitle>
                        <CardDescription>Änderbar über &bdquo;Bearbeiten&ldquo;.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {oeffnung.length === 0 ? (
                            <p className="text-sm text-gray-500">
                                Noch nicht hinterlegt – es gelten die Standard-Slotzeiten an allen Tagen.
                            </p>
                        ) : (
                            <DL
                                rows={oeffnung.map((o) => [
                                    WOCHENTAG_LABELS[o.wochentag] ?? `Tag ${o.wochentag}`,
                                    o.geoeffnet
                                        ? o.oeffnet && o.schliesst
                                            ? `${o.oeffnet.slice(0, 5)} – ${o.schliesst.slice(0, 5)}`
                                            : "geöffnet (Standardzeiten)"
                                        : "geschlossen",
                                ])}
                            />
                        )}
                    </CardContent>
                </Card>

                {/* C-1: zugeordnete Mitarbeiter */}
                <Card>
                    <CardHeader>
                        <CardTitle>Mitarbeiter dieses Centers</CardTitle>
                        <CardDescription>
                            {mitarbeiter.length} Person{mitarbeiter.length === 1 ? "" : "en"} zugeordnet.
                            Die Zuordnung erfolgt über die Mitarbeiter-Detailseite.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {mitarbeiter.length === 0 ? (
                            <p className="text-sm text-gray-500">Noch niemand zugeordnet.</p>
                        ) : (
                            <ul className="divide-y">
                                {mitarbeiter.map((m) => (
                                    <li key={m.id} className="py-2 flex items-center justify-between gap-2">
                                        {role === "admin" ? (
                                            <Link
                                                href={`/app/employees/${m.id}`}
                                                className="text-primary-600 hover:underline text-sm"
                                            >
                                                {`${m.vorname ?? ""} ${m.nachname ?? ""}`.trim() || (m.email ?? "?")}
                                            </Link>
                                        ) : (
                                            <span className="text-sm">
                                                {`${m.vorname ?? ""} ${m.nachname ?? ""}`.trim() || (m.email ?? "?")}
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500">{m.email}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
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
