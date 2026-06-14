"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaAvailabilityRow, EsskaShiftSlot, EsskaWunsch } from "@/lib/esska/types";
import {
    SLOT_DEFAULT_ZEITEN,
    SLOT_LABELS,
    WUNSCH_ICON,
    WUNSCH_LABELS,
    addTage,
    isoDatum,
    montagDerWoche,
    tagKurz,
    zeitKurz,
} from "@/lib/esska/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const SLOTS: EsskaShiftSlot[] = ["vormittag", "nachmittag"];
const WUENSCHE: EsskaWunsch[] = ["wuensche", "koennte", "kann_nicht"];

const FARBE: Record<EsskaWunsch, string> = {
    wuensche: "bg-green-100 text-green-800 border-green-400",
    koennte: "bg-secondary-100 text-secondary-800 border-secondary-300",
    kann_nicht: "bg-red-100 text-red-800 border-red-400",
};

// Schluessel: "YYYY-MM-DD::slot"
type WocheState = Record<string, { wunsch: EsskaWunsch; notiz: string }>;

const key = (datum: string, slot: EsskaShiftSlot) => `${datum}::${slot}`;

export default function AvailabilityPage() {
    const [profileId, setProfileId] = useState<string | null>(null);
    const [wochenStart, setWochenStart] = useState<Date>(montagDerWoche(new Date()));
    const [state, setState] = useState<WocheState>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [info, setInfo] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const tage = useMemo(
        () => Array.from({ length: 7 }, (_, i) => addTage(wochenStart, i)),
        [wochenStart]
    );

    useEffect(() => {
        const init = async () => {
            try {
                const client = await getEsskaClient();
                const { data: { user } } = await client.auth.getUser();
                if (!user) throw new Error("Nicht angemeldet");
                setProfileId(user.id);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Anmeldung pruefen" }));
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (!profileId) return;
        const load = async () => {
            setLoading(true);
            setInfo(null);
            try {
                const client = await getEsskaClient();
                const von = isoDatum(wochenStart);
                const bis = isoDatum(addTage(wochenStart, 6));
                const { data, error: e } = await client
                    .from("availabilities")
                    .select("*")
                    .eq("profile_id", profileId)
                    .gte("datum", von)
                    .lte("datum", bis);
                if (e) throw e;

                const next: WocheState = {};
                for (const t of tage) {
                    for (const slot of SLOTS) {
                        const k = key(isoDatum(t), slot);
                        const vorhanden = (data as EsskaAvailabilityRow[] | null)?.find(
                            (a) => a.datum === isoDatum(t) && a.slot === slot
                        );
                        next[k] = {
                            wunsch: vorhanden?.wunsch ?? "koennte",
                            notiz: vorhanden?.notiz ?? "",
                        };
                    }
                }
                setState(next);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Verfuegbarkeit laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [profileId, wochenStart.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

    const setzeWunsch = (datum: string, slot: EsskaShiftSlot, w: EsskaWunsch) => {
        const k = key(datum, slot);
        setState((prev) => ({ ...prev, [k]: { ...(prev[k] ?? { notiz: "" }), wunsch: w } }));
    };

    const speichern = async () => {
        if (!profileId) return;
        setSaving(true);
        setInfo(null);
        setError(null);
        try {
            const client = await getEsskaClient();
            const payload = Object.entries(state).map(([k, v]) => {
                const [datum, slot] = k.split("::");
                return {
                    profile_id: profileId,
                    datum,
                    slot: slot as EsskaShiftSlot,
                    wunsch: v.wunsch,
                    notiz: v.notiz?.trim() ? v.notiz.trim() : null,
                };
            });
            const { error: e } = await client
                .from("availabilities")
                .upsert(payload, { onConflict: "profile_id,datum,slot" });
            if (e) throw e;
            setInfo("Wochenwünsche gespeichert.");
        } catch (err) {
            setError(friendlyError(err, { aktion: "Speichern" }));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Wochenwünsche</h1>
                    <p className="text-gray-500 text-sm">
                        Trage pro Vormittag/Nachmittag ein, ob du an dem Slot arbeiten möchtest. Der Admin sieht
                        das beim Planen und kann nur Mitarbeiter einplanen, die das nicht ausgeschlossen haben.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setWochenStart(addTage(wochenStart, -7))}
                        className="p-2 border rounded-md hover:bg-secondary-100"
                        title="Vorige Woche"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium px-2">
                        {wochenStart.toLocaleDateString("de-DE")} – {addTage(wochenStart, 6).toLocaleDateString("de-DE")}
                    </span>
                    <button
                        onClick={() => setWochenStart(addTage(wochenStart, 7))}
                        className="p-2 border rounded-md hover:bg-secondary-100"
                        title="Nächste Woche"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setWochenStart(montagDerWoche(new Date()))}
                        className="px-3 py-1.5 text-sm border rounded-md hover:bg-secondary-100"
                    >
                        Diese Woche
                    </button>
                </div>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
            {info && <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{info}</div>}

            <Card>
                <CardHeader>
                    <CardTitle>Wochenplan</CardTitle>
                    <CardDescription>
                        ✕ = Kann nicht · · = Könnte · ★ = Wünsche zu arbeiten
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-gray-500">Lädt…</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-secondary-50">
                                        <th className="px-3 py-2 text-left border">Datum</th>
                                        <th className="px-3 py-2 text-left border">Wochentag</th>
                                        {SLOTS.map((s) => (
                                            <th key={s} className="px-3 py-2 text-center border">
                                                {SLOT_LABELS[s]}
                                                <div className="text-xs font-normal text-gray-500">
                                                    {zeitKurz(SLOT_DEFAULT_ZEITEN[s].start)}–{zeitKurz(SLOT_DEFAULT_ZEITEN[s].ende)}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tage.map((t) => {
                                        const datum = isoDatum(t);
                                        return (
                                            <tr key={datum} className="border-t">
                                                <td className="px-3 py-2 border font-medium">
                                                    {t.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                                                </td>
                                                <td className="px-3 py-2 border">{tagKurz(t)}</td>
                                                {SLOTS.map((s) => {
                                                    const k = key(datum, s);
                                                    const aktuell = state[k]?.wunsch ?? "koennte";
                                                    return (
                                                        <td key={s} className="px-2 py-2 border">
                                                            <div className="flex gap-1 justify-center">
                                                                {WUENSCHE.map((w) => (
                                                                    <button
                                                                        key={w}
                                                                        onClick={() => setzeWunsch(datum, s, w)}
                                                                        className={`px-2 py-1 text-xs rounded border ${
                                                                            aktuell === w
                                                                                ? FARBE[w]
                                                                                : "bg-white text-gray-500 border-gray-200 hover:bg-secondary-50"
                                                                        }`}
                                                                        title={WUNSCH_LABELS[w]}
                                                                    >
                                                                        {WUNSCH_ICON[w]} {WUNSCH_LABELS[w]}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={speichern}
                            disabled={saving || loading}
                            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? "Speichern…" : "Woche speichern"}
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
