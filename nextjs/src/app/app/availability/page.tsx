"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaAvailabilityRow, EsskaCenterOpeningHour, EsskaShiftSlot, EsskaWunsch } from "@/lib/esska/types";
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
import { feiertagFuer, istSonntag } from "@/lib/esska/feiertage";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const SLOTS: EsskaShiftSlot[] = ["vormittag", "nachmittag"];

// Reihenfolge der Buttons je Zelle (links nach rechts)
const WUENSCHE: EsskaWunsch[] = ["wuensche", "koennte", "kann_nicht"];

const FARBE: Record<EsskaWunsch, string> = {
    wuensche: "bg-amber-100 text-amber-800 border-amber-400",
    koennte: "bg-green-100 text-green-800 border-green-400",
    kann_nicht: "bg-red-100 text-red-800 border-red-400",
};

// 15-Min-Schritte fuer Abweichungs-Zeit (nur 00, 15, 30, 45)
// Vormittag: bis HH:MM, sinnvoll 09:15 .. 14:45
// Nachmittag: ab HH:MM, sinnvoll 15:15 .. 20:15
const VORMITTAG_BIS_OPTIONEN: string[] = (() => {
    const arr: string[] = [];
    for (let h = 9; h <= 14; h++) {
        for (const m of [0, 15, 30, 45]) {
            if (h === 9 && m === 0) continue; // unter Start
            arr.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
        }
    }
    return arr;
})();
const NACHMITTAG_AB_OPTIONEN: string[] = (() => {
    const arr: string[] = [];
    for (let h = 15; h <= 20; h++) {
        for (const m of [0, 15, 30, 45]) {
            if (h === 15 && m === 0) continue; // mindestens 15:15
            if (h === 20 && m > 15) continue; // bis 20:15, danach kaum Slot uebrig
            arr.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
        }
    }
    return arr;
})();

type ZellenWert = {
    wunsch: EsskaWunsch;
    abweichungBis: string | null;   // nur Vormittag
    abweichungAb: string | null;    // nur Nachmittag
    notiz: string;
};

type WocheState = Record<string, ZellenWert>;

const key = (datum: string, slot: EsskaShiftSlot) => `${datum}::${slot}`;

export default function AvailabilityPage() {
    const [profileId, setProfileId] = useState<string | null>(null);
    // V-2: Oeffnungstage der zugeordneten Center - an Tagen, an denen ALLE
    // eigenen Center geschlossen sind, ist keine Eingabe noetig/moeglich.
    const [oeffnungen, setOeffnungen] = useState<EsskaCenterOpeningHour[]>([]);
    const [eigeneCenterIds, setEigeneCenterIds] = useState<string[]>([]);
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

                const { data: aData } = await client
                    .from("center_assignments")
                    .select("center_id")
                    .eq("profile_id", user.id);
                const ids = ((aData as Array<{ center_id: string }>) ?? []).map((a) => a.center_id);
                setEigeneCenterIds(ids);
                if (ids.length > 0) {
                    const { data: oData } = await client
                        .from("center_opening_hours")
                        .select("*")
                        .in("center_id", ids);
                    setOeffnungen((oData as EsskaCenterOpeningHour[]) ?? []);
                }
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
                            abweichungBis: vorhanden?.abweichung_bis ? vorhanden.abweichung_bis.slice(0, 5) : null,
                            abweichungAb: vorhanden?.abweichung_ab ? vorhanden.abweichung_ab.slice(0, 5) : null,
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

    // V-2: geschlossen, wenn fuer JEDES zugeordnete Center ein Eintrag
    // "geoeffnet = false" fuer diesen Wochentag existiert. Ohne Center oder
    // ohne Eintraege bleibt der Tag offen.
    const tagGeschlossen = (wochentag: number): boolean => {
        if (eigeneCenterIds.length === 0) return false;
        return eigeneCenterIds.every((cid) =>
            oeffnungen.some((o) => o.center_id === cid && o.wochentag === wochentag && !o.geoeffnet)
        );
    };

    const setzeWunsch = (datum: string, slot: EsskaShiftSlot, w: EsskaWunsch) => {
        const k = key(datum, slot);
        setState((prev) => {
            const aktuell = prev[k] ?? { wunsch: "koennte", abweichungBis: null, abweichungAb: null, notiz: "" };
            // Wenn man Abweichung auswaehlt und noch keine Zeit gesetzt ist, einen sinnvollen Default vorschlagen
            let abwBis = aktuell.abweichungBis;
            let abwAb = aktuell.abweichungAb;
            if (w === "wuensche") {
                if (slot === "vormittag" && !abwBis) abwBis = "12:00";
                if (slot === "nachmittag" && !abwAb) abwAb = "17:00";
            } else {
                abwBis = null;
                abwAb = null;
            }
            return { ...prev, [k]: { ...aktuell, wunsch: w, abweichungBis: abwBis, abweichungAb: abwAb } };
        });
    };

    const setzeAbweichungBis = (datum: string, zeit: string) => {
        const k = key(datum, "vormittag");
        setState((prev) => ({ ...prev, [k]: { ...prev[k], abweichungBis: zeit } }));
    };

    const setzeAbweichungAb = (datum: string, zeit: string) => {
        const k = key(datum, "nachmittag");
        setState((prev) => ({ ...prev, [k]: { ...prev[k], abweichungAb: zeit } }));
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
                    abweichung_bis: v.wunsch === "wuensche" && slot === "vormittag" ? v.abweichungBis : null,
                    abweichung_ab: v.wunsch === "wuensche" && slot === "nachmittag" ? v.abweichungAb : null,
                    notiz: v.notiz?.trim() ? v.notiz.trim() : null,
                };
            });
            const { error: e } = await client
                .from("availabilities")
                .upsert(payload, { onConflict: "profile_id,datum,slot" });
            if (e) throw e;
            setInfo("Wochenplan gespeichert.");
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
                    <h1 className="text-2xl font-bold">Wochenplan</h1>
                    <p className="text-gray-500 text-sm">
                        Trage pro Vormittag/Nachmittag ein, ob du an dem Slot arbeiten kannst. Der Admin sieht das
                        beim Planen und kann nur Mitarbeiter einplanen, die das nicht ausgeschlossen haben.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
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
                    <button
                        onClick={() => setWochenStart(addTage(montagDerWoche(new Date()), 7))}
                        className="px-3 py-1.5 text-sm border rounded-md hover:bg-secondary-100"
                    >
                        Nächste Woche
                    </button>
                    <button
                        onClick={() => setWochenStart(addTage(montagDerWoche(new Date()), 14))}
                        className="px-3 py-1.5 text-sm border rounded-md hover:bg-secondary-100"
                    >
                        Übernächste Woche
                    </button>
                </div>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
            {info && <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{info}</div>}

            <Card>
                <CardHeader>
                    <CardTitle>Wochenplan</CardTitle>
                    <CardDescription>
                        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-medium text-green-700">✓ Könnte</span>
                            <span className="font-medium text-amber-600">Abweichung</span>
                            <span className="font-medium text-red-700">✕ Kann nicht</span>
                            <span className="text-gray-700">bis/ab = Zeit angeben</span>
                        </span>
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
                                        const feiertag = feiertagFuer(datum);
                                        const sonntag = istSonntag(datum);
                                        const geschlossen = tagGeschlossen((t.getDay() + 6) % 7);
                                        const istFreierTag = !!feiertag || sonntag || geschlossen;
                                        return (
                                            <tr
                                                key={datum}
                                                className={`border-t ${istFreierTag ? "bg-secondary-50/60" : ""}`}
                                            >
                                                <td className="px-3 py-2 border font-medium">
                                                    {t.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                                                </td>
                                                <td className="px-3 py-2 border">
                                                    {tagKurz(t)}
                                                    {feiertag && (
                                                        <div className="text-xs text-amber-700 mt-0.5">{feiertag}</div>
                                                    )}
                                                    {!feiertag && sonntag && (
                                                        <div className="text-xs text-gray-500 mt-0.5">Sonntag</div>
                                                    )}
                                                    {geschlossen && (
                                                        <div className="text-xs text-gray-500 mt-0.5">Center geschlossen</div>
                                                    )}
                                                </td>
                                                {SLOTS.map((s) => {
                                                    const k = key(datum, s);
                                                    const wert = state[k];
                                                    const aktuell = wert?.wunsch ?? "koennte";
                                                    if (geschlossen) {
                                                        return (
                                                            <td key={s} className="px-2 py-2 border text-center text-xs text-gray-400">
                                                                geschlossen
                                                            </td>
                                                        );
                                                    }
                                                    return (
                                                        <td key={s} className="px-2 py-2 border">
                                                            <div className="flex flex-wrap gap-1 justify-center items-center">
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
                                                                        {WUNSCH_ICON[w] && (
                                                                            <span className="mr-1">{WUNSCH_ICON[w]}</span>
                                                                        )}
                                                                        {WUNSCH_LABELS[w]}
                                                                    </button>
                                                                ))}
                                                                {aktuell === "wuensche" && s === "vormittag" && (
                                                                    <div className="flex items-center gap-1 text-xs ml-1">
                                                                        <span>bis</span>
                                                                        <select
                                                                            value={wert?.abweichungBis ?? ""}
                                                                            onChange={(e) =>
                                                                                setzeAbweichungBis(datum, e.target.value)
                                                                            }
                                                                            className="border rounded px-1 py-0.5 text-xs"
                                                                        >
                                                                            {VORMITTAG_BIS_OPTIONEN.map((z) => (
                                                                                <option key={z} value={z}>{z}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                )}
                                                                {aktuell === "wuensche" && s === "nachmittag" && (
                                                                    <div className="flex items-center gap-1 text-xs ml-1">
                                                                        <span>ab</span>
                                                                        <select
                                                                            value={wert?.abweichungAb ?? ""}
                                                                            onChange={(e) =>
                                                                                setzeAbweichungAb(datum, e.target.value)
                                                                            }
                                                                            className="border rounded px-1 py-0.5 text-xs"
                                                                        >
                                                                            {NACHMITTAG_AB_OPTIONEN.map((z) => (
                                                                                <option key={z} value={z}>{z}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                )}
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
