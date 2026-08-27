"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Eye, Plus } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter, EsskaShiftWeek } from "@/lib/esska/types";
import { addTage, isoDatum, montagDerWoche, parseIsoDatum } from "@/lib/esska/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function ShiftsOverviewPage() {
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [weeks, setWeeks] = useState<EsskaShiftWeek[]>([]);
    const [centerId, setCenterId] = useState<string>("");
    const [wochenStart, setWochenStart] = useState<Date>(montagDerWoche(new Date()));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const [cRes, wRes] = await Promise.all([
                    client.from("centers").select("*").order("saison", { ascending: false }).order("name"),
                    client.from("shift_weeks").select("*").order("woche_start", { ascending: false }),
                ]);
                if (cRes.error) throw cRes.error;
                if (wRes.error) throw wRes.error;
                const cs = (cRes.data as EsskaCenter[]) ?? [];
                setCenters(cs);
                setWeeks((wRes.data as EsskaShiftWeek[]) ?? []);
                if (cs.length > 0 && !centerId) setCenterId(cs[0].id);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const aktuelleWoche = useMemo(
        () => weeks.find((w) => w.center_id === centerId && w.woche_start === isoDatum(wochenStart)),
        [weeks, centerId, wochenStart]
    );

    const kommendeWochen = useMemo(() => {
        return weeks
            .filter((w) => w.center_id === centerId)
            .slice(0, 12);
    }, [weeks, centerId]);

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div>
                <h1 className="text-2xl font-bold">Schichtplan</h1>
                <p className="text-gray-500">Wochenpläne je Center erstellen und veröffentlichen.</p>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Center</label>
                    <select
                        value={centerId}
                        onChange={(e) => setCenterId(e.target.value)}
                        className="border rounded-md px-3 py-2 text-sm"
                    >
                        {centers.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} ({c.kuerzel}) · {c.saison}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Woche (Montag)</label>
                    <input
                        type="date"
                        value={isoDatum(wochenStart)}
                        onChange={(e) => {
                            if (!e.target.value) return;
                            const d = parseIsoDatum(e.target.value);
                            if (!Number.isNaN(d.getTime())) setWochenStart(montagDerWoche(d));
                        }}
                        className="border rounded-md px-3 py-2 text-sm"
                    />
                </div>
                <div className="flex gap-2">
                    {[
                        { label: "Aktuelle Woche", offset: 0 },
                        { label: "Nächste Woche", offset: 7 },
                        { label: "Übernächste Woche", offset: 14 },
                    ].map((b) => {
                        const ziel = addTage(montagDerWoche(new Date()), b.offset);
                        const aktiv = isoDatum(ziel) === isoDatum(wochenStart);
                        return (
                            <button
                                key={b.offset}
                                onClick={() => setWochenStart(ziel)}
                                className={`px-3 py-2 text-sm border rounded-md ${
                                    aktiv
                                        ? "bg-primary-600 text-white border-primary-600"
                                        : "hover:bg-secondary-100"
                                }`}
                            >
                                {b.label}
                            </button>
                        );
                    })}
                </div>
                {centerId && (
                    <Link
                        href={`/app/shifts/${centerId}/${isoDatum(wochenStart)}`}
                        className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                        <CalendarDays className="h-4 w-4 mr-2" />
                        {aktuelleWoche ? "Woche öffnen" : "Woche anlegen"}
                    </Link>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Bestehende Wochen für dieses Center</CardTitle>
                    <CardDescription>
                        {loading ? "Lädt…" : `${kommendeWochen.length} Woche${kommendeWochen.length === 1 ? "" : "n"} angelegt`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {kommendeWochen.length === 0 ? (
                        <p className="text-sm text-gray-500">Noch keine Wochenpläne für dieses Center.</p>
                    ) : (
                        <ul className="divide-y">
                            {kommendeWochen.map((w) => (
                                <li key={w.id} className="py-2 flex items-center justify-between">
                                    <Link
                                        href={`/app/shifts/${w.center_id}/${w.woche_start}`}
                                        className="text-primary-600 hover:underline text-sm"
                                    >
                                        Woche {parseIsoDatum(w.woche_start).toLocaleDateString("de-DE")} –{" "}
                                        {addTage(parseIsoDatum(w.woche_start), 6).toLocaleDateString("de-DE")}
                                    </Link>
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full ${
                                            w.veroeffentlicht ? "bg-green-100 text-green-800" : "bg-secondary-100 text-secondary-800"
                                        }`}
                                    >
                                        {w.veroeffentlicht ? "veröffentlicht" : "Entwurf"}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Hinweis zum Workflow</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-600 space-y-2">
                    <p>
                        <Plus className="inline h-4 w-4 mr-1" />
                        Schichten anlegen: Woche auswählen oder anlegen, dann pro Tag Mitarbeiter und Zeit erfassen.
                    </p>
                    <p>
                        <Eye className="inline h-4 w-4 mr-1" />
                        Ver&ouml;ffentlichen: Solange &bdquo;Entwurf&ldquo;, sehen Mitarbeiter nichts. Erst durch Klick auf
                        &bdquo;Ver&ouml;ffentlichen&ldquo; werden die Schichten unter &bdquo;Meine Schichten&ldquo; sichtbar.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
