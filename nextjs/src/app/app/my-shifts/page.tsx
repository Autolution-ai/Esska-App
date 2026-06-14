"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter, EsskaShift } from "@/lib/esska/types";
import { addTage, isoDatum, montagDerWoche, tagKurz } from "@/lib/esska/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type ShiftMitCenter = EsskaShift & { center?: EsskaCenter | null };

export default function MyShiftsPage() {
    const [wochenStart, setWochenStart] = useState<Date>(montagDerWoche(new Date()));
    const [shifts, setShifts] = useState<ShiftMitCenter[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const tage = useMemo(
        () => Array.from({ length: 7 }, (_, i) => addTage(wochenStart, i)),
        [wochenStart]
    );

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const client = await getEsskaClient();
                const { data: { user } } = await client.auth.getUser();
                if (!user) throw new Error("Nicht angemeldet");
                const von = isoDatum(wochenStart);
                const bis = isoDatum(addTage(wochenStart, 6));
                const { data, error: e } = await client
                    .from("shifts")
                    .select("*, centers(*)")
                    .eq("profile_id", user.id)
                    .gte("datum", von)
                    .lte("datum", bis)
                    .order("datum")
                    .order("start_zeit");
                if (e) throw e;
                const rows = ((data as unknown) as Array<EsskaShift & { centers: EsskaCenter | null }> ?? []).map((s) => ({
                    ...s,
                    center: s.centers,
                }));
                setShifts(rows);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [wochenStart.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

    const stundenTotal = shifts.reduce((sum, s) => {
        const [sh, sm] = s.start_zeit.split(":").map(Number);
        const [eh, em] = s.end_zeit.split(":").map(Number);
        const minuten = eh * 60 + em - (sh * 60 + sm) - (s.pause_min ?? 0);
        return sum + Math.max(0, minuten);
    }, 0) / 60;

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Meine Schichten</h1>
                    <p className="text-gray-500">Nur veröffentlichte Wochenpläne sind sichtbar.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setWochenStart(addTage(wochenStart, -7))} className="p-2 border rounded-md hover:bg-secondary-100">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium px-2">
                        {wochenStart.toLocaleDateString("de-DE")} – {addTage(wochenStart, 6).toLocaleDateString("de-DE")}
                    </span>
                    <button onClick={() => setWochenStart(addTage(wochenStart, 7))} className="p-2 border rounded-md hover:bg-secondary-100">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <button onClick={() => setWochenStart(montagDerWoche(new Date()))} className="px-3 py-1.5 text-sm border rounded-md hover:bg-secondary-100">
                        Diese Woche
                    </button>
                </div>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

            <Card>
                <CardHeader>
                    <CardTitle>
                        {loading ? "Lädt…" : `${shifts.length} Schicht${shifts.length === 1 ? "" : "en"} · ${stundenTotal.toFixed(2).replace(".", ",")} Std (Brutto-Pause)`}
                    </CardTitle>
                    <CardDescription>Alle veröffentlichten Schichten dieser Woche.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-sm text-gray-500">Lädt…</p>
                    ) : shifts.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            Diese Woche sind dir keine veröffentlichten Schichten zugewiesen.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {tage.map((t) => {
                                const datum = isoDatum(t);
                                const tageschichten = shifts.filter((s) => s.datum === datum);
                                if (tageschichten.length === 0) return null;
                                return (
                                    <div key={datum} className="border rounded-md p-3">
                                        <h3 className="font-semibold text-sm mb-2">
                                            {tagKurz(t)}, {t.toLocaleDateString("de-DE")}
                                        </h3>
                                        <ul className="space-y-1 text-sm">
                                            {tageschichten.map((s) => (
                                                <li key={s.id}>
                                                    <strong>{s.center?.name ?? "Center"}</strong>{" "}
                                                    <span className="font-mono text-xs text-gray-500">({s.center?.kuerzel ?? "—"})</span>
                                                    {" · "}
                                                    {s.start_zeit.slice(0, 5)} – {s.end_zeit.slice(0, 5)}
                                                    {s.pause_min > 0 && ` · ${s.pause_min} Min Pause`}
                                                    {s.rolle && ` · ${s.rolle}`}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
