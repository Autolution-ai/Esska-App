"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaAvailability, EsskaAvailabilityRow } from "@/lib/esska/types";
import {
    AVAILABILITY_LABELS,
    addTage,
    isoDatum,
    montagDerWoche,
    tagKurz,
} from "@/lib/esska/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const STATUS_REIHENFOLGE: EsskaAvailability[] = [
    "verfuegbar",
    "nur_vormittag",
    "nur_nachmittag",
    "nicht_verfuegbar",
];

const STATUS_FARBE: Record<EsskaAvailability, string> = {
    verfuegbar: "bg-green-100 text-green-800 border-green-300",
    nur_vormittag: "bg-amber-100 text-amber-800 border-amber-300",
    nur_nachmittag: "bg-amber-100 text-amber-800 border-amber-300",
    nicht_verfuegbar: "bg-red-100 text-red-800 border-red-300",
};

type WocheState = Record<string, { status: EsskaAvailability; notiz: string }>;

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
                setError(friendlyError(err, { aktion: "Fehler" }));
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
                    const key = isoDatum(t);
                    const vorhanden = (data as EsskaAvailabilityRow[] | null)?.find((a) => a.datum === key);
                    next[key] = {
                        status: vorhanden?.status ?? "verfuegbar",
                        notiz: vorhanden?.notiz ?? "",
                    };
                }
                setState(next);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [profileId, wochenStart.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

    const setzeStatus = (datum: string, status: EsskaAvailability) => {
        setState((prev) => ({ ...prev, [datum]: { ...(prev[datum] ?? { notiz: "" }), status } }));
    };

    const setzeNotiz = (datum: string, notiz: string) => {
        setState((prev) => ({ ...prev, [datum]: { ...(prev[datum] ?? { status: "verfuegbar" }), notiz } }));
    };

    const speichern = async () => {
        if (!profileId) return;
        setSaving(true);
        setInfo(null);
        setError(null);
        try {
            const client = await getEsskaClient();
            const payload = Object.entries(state).map(([datum, v]) => ({
                profile_id: profileId,
                datum,
                status: v.status,
                notiz: v.notiz?.trim() ? v.notiz.trim() : null,
            }));
            const { error: e } = await client
                .from("availabilities")
                .upsert(payload, { onConflict: "profile_id,datum" });
            if (e) throw e;
            setInfo("Verfügbarkeit für diese Woche gespeichert.");
        } catch (err) {
            setError(friendlyError(err, { aktion: "Speichern fehlgeschlagen" }));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Verfügbarkeit</h1>
                    <p className="text-gray-500">
                        Wann kannst du arbeiten? Standardeinstellung pro Tag ist &bdquo;Verf&uuml;gbar&ldquo;.
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
                        Woche {wochenStart.toLocaleDateString("de-DE")} – {addTage(wochenStart, 6).toLocaleDateString("de-DE")}
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
                    <CardTitle>Wochenkalender</CardTitle>
                    <CardDescription>Pro Tag den passenden Status wählen, optional eine Notiz.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-gray-500">Lädt…</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                            {tage.map((t) => {
                                const key = isoDatum(t);
                                const s = state[key];
                                return (
                                    <div key={key} className="border rounded-lg p-3 bg-white">
                                        <div className="text-center mb-2">
                                            <div className="text-xs uppercase text-gray-500">{tagKurz(t)}</div>
                                            <div className="text-lg font-semibold">{t.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</div>
                                        </div>
                                        <div className="space-y-1">
                                            {STATUS_REIHENFOLGE.map((status) => (
                                                <button
                                                    key={status}
                                                    onClick={() => setzeStatus(key, status)}
                                                    className={`w-full text-xs py-1 px-2 rounded border ${
                                                        s?.status === status
                                                            ? STATUS_FARBE[status]
                                                            : "bg-white text-gray-600 border-gray-200 hover:bg-secondary-50"
                                                    }`}
                                                >
                                                    {AVAILABILITY_LABELS[status]}
                                                </button>
                                            ))}
                                        </div>
                                        <input
                                            value={s?.notiz ?? ""}
                                            onChange={(e) => setzeNotiz(key, e.target.value)}
                                            placeholder="Notiz (optional)"
                                            className="mt-2 w-full text-xs border rounded px-2 py-1"
                                        />
                                    </div>
                                );
                            })}
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
