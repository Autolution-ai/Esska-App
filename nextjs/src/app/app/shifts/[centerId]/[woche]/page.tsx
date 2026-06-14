"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type {
    EsskaAvailabilityRow,
    EsskaCenter,
    EsskaProfile,
    EsskaShift,
    EsskaShiftSlot,
    EsskaShiftWeek,
    EsskaWunsch,
} from "@/lib/esska/types";
import {
    SLOT_DEFAULT_ZEITEN,
    SLOT_LABELS,
    WUNSCH_ICON,
    addTage,
    isoDatum,
    montagDerWoche,
    nettoStunden,
    tagKurz,
} from "@/lib/esska/types";

const SLOTS: EsskaShiftSlot[] = ["vormittag", "nachmittag"];

type AssignedProfile = Pick<
    EsskaProfile,
    "id" | "vorname" | "nachname" | "email" | "arbeitszeit_modell" | "stunden_pro_woche" | "max_schichten_pro_woche"
>;

export default function WocheEditorPage() {
    const params = useParams<{ centerId: string; woche: string }>();
    const wochenStart = useMemo(() => montagDerWoche(new Date(params.woche)), [params.woche]);
    const tage = useMemo(() => Array.from({ length: 7 }, (_, i) => addTage(wochenStart, i)), [wochenStart]);

    const [center, setCenter] = useState<EsskaCenter | null>(null);
    const [week, setWeek] = useState<EsskaShiftWeek | null>(null);
    const [shifts, setShifts] = useState<EsskaShift[]>([]);
    // alle Schichten dieser Mitarbeiter ueber alle Center fuer Limit-Pruefung
    const [shiftsWeekAll, setShiftsWeekAll] = useState<EsskaShift[]>([]);
    const [people, setPeople] = useState<AssignedProfile[]>([]);
    const [availability, setAvailability] = useState<EsskaAvailabilityRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Inline-Zeit-Override pro Zelle (lokaler Zwischenzustand bis Save)
    const [zeitOverride, setZeitOverride] = useState<Record<string, { start: string; ende: string }>>({});

    const cellKey = (datum: string, slot: EsskaShiftSlot) => `${datum}::${slot}`;

    const reload = async () => {
        try {
            const client = await getEsskaClient();
            const von = isoDatum(wochenStart);
            const bis = isoDatum(addTage(wochenStart, 6));

            const [cRes, aRes] = await Promise.all([
                client.from("centers").select("*").eq("id", params.centerId).single(),
                client
                    .from("center_assignments")
                    .select(
                        "rolle_im_center, profiles(id, vorname, nachname, email, arbeitszeit_modell, stunden_pro_woche, max_schichten_pro_woche)"
                    )
                    .eq("center_id", params.centerId),
            ]);
            if (cRes.error) throw cRes.error;
            if (aRes.error) throw aRes.error;
            setCenter(cRes.data as EsskaCenter);
            const peeps = ((aRes.data as unknown) as Array<{ profiles: AssignedProfile | null }> ?? [])
                .flatMap((r) => (r.profiles ? [r.profiles] : []));
            setPeople(peeps);

            const { data: wkData, error: wkErr } = await client
                .from("shift_weeks")
                .select("*")
                .eq("center_id", params.centerId)
                .eq("woche_start", von)
                .maybeSingle();
            if (wkErr) throw wkErr;
            const wk = wkData as EsskaShiftWeek | null;
            setWeek(wk);

            if (wk) {
                const { data: sData, error: sErr } = await client
                    .from("shifts")
                    .select("*")
                    .eq("shift_week_id", wk.id)
                    .order("datum")
                    .order("slot");
                if (sErr) throw sErr;
                setShifts((sData as EsskaShift[]) ?? []);
            } else {
                setShifts([]);
            }

            if (peeps.length > 0) {
                const ids = peeps.map((p) => p.id);
                const [aData, allShifts] = await Promise.all([
                    client
                        .from("availabilities")
                        .select("*")
                        .in("profile_id", ids)
                        .gte("datum", von)
                        .lte("datum", bis),
                    client
                        .from("shifts")
                        .select("*")
                        .in("profile_id", ids)
                        .gte("datum", von)
                        .lte("datum", bis),
                ]);
                setAvailability((aData.data as EsskaAvailabilityRow[]) ?? []);
                setShiftsWeekAll((allShifts.data as EsskaShift[]) ?? []);
            }
        } catch (err) {
            setError(friendlyError(err, { aktion: "Laden" }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.centerId, params.woche]);

    const wocheAnlegen = async () => {
        setBusy(true);
        try {
            const client = await getEsskaClient();
            const { data, error: e } = await client
                .from("shift_weeks")
                .insert({ center_id: params.centerId, woche_start: isoDatum(wochenStart) })
                .select("*")
                .single();
            if (e) throw e;
            setWeek(data as EsskaShiftWeek);
        } catch (err) {
            setError(friendlyError(err, { aktion: "Woche anlegen" }));
        } finally {
            setBusy(false);
        }
    };

    const veroeffentlichen = async () => {
        if (!week) return;
        setBusy(true);
        try {
            const client = await getEsskaClient();
            const { data: { user } } = await client.auth.getUser();
            const payload = week.veroeffentlicht
                ? { veroeffentlicht: false, veroeffentlicht_am: null, veroeffentlicht_von: null }
                : { veroeffentlicht: true, veroeffentlicht_am: new Date().toISOString(), veroeffentlicht_von: user?.id ?? null };
            const { data, error: e } = await client
                .from("shift_weeks")
                .update(payload)
                .eq("id", week.id)
                .select("*")
                .single();
            if (e) throw e;
            setWeek(data as EsskaShiftWeek);
        } catch (err) {
            setError(friendlyError(err, { aktion: "Veroeffentlichen" }));
        } finally {
            setBusy(false);
        }
    };

    const wunschVon = (profileId: string, datum: string, slot: EsskaShiftSlot): EsskaWunsch => {
        return availability.find((a) => a.profile_id === profileId && a.datum === datum && a.slot === slot)?.wunsch
            ?? "koennte";
    };

    // Schichten + lokale (noch nicht gespeicherte) Override mitberechnet
    const schichtenZaehlerWoche = (profileId: string, ignoreCellKey?: string) => {
        const ist = shiftsWeekAll.filter((s) => s.profile_id === profileId);
        const aktuelleZellen = shifts.filter((s) => s.profile_id === profileId);
        // duplikate vermeiden: shiftsWeekAll enthaelt vielleicht auch shifts
        const uniqueIds = new Set([...ist.map((s) => s.id), ...aktuelleZellen.map((s) => s.id)]);
        const total = uniqueIds.size;
        // Wenn ignoreCellKey gesetzt, ziehe die Zelle nicht mit (Pruefung beim Zuweisen)
        if (!ignoreCellKey) return total;
        const cell = shifts.find((s) => cellKey(s.datum, s.slot) === ignoreCellKey && s.profile_id === profileId);
        return cell ? Math.max(0, total - 1) : total;
    };

    const stundenWoche = (profileId: string) => {
        const eigene = shiftsWeekAll.filter((s) => s.profile_id === profileId);
        return eigene.reduce(
            (sum, s) => sum + nettoStunden(s.start_zeit.slice(0, 5), s.end_zeit.slice(0, 5), s.pause_min ?? 0),
            0
        );
    };

    const limitInfo = (p: AssignedProfile, ignoreCellKey?: string) => {
        const schichtenIst = schichtenZaehlerWoche(p.id, ignoreCellKey);
        const stundenIst = stundenWoche(p.id);
        const schichtenLimit = p.max_schichten_pro_woche;
        const stundenLimit = p.stunden_pro_woche;
        const warnungen: string[] = [];
        if (schichtenLimit && schichtenIst + 1 > schichtenLimit) {
            warnungen.push(`würde ${schichtenIst + 1}/${schichtenLimit} Schichten überschreiten`);
        }
        if (stundenLimit && stundenIst >= stundenLimit) {
            warnungen.push(`Stundenlimit ${stundenLimit} h erreicht`);
        }
        return { schichtenIst, stundenIst, schichtenLimit, stundenLimit, warnungen };
    };

    const setSlotPerson = async (datum: string, slot: EsskaShiftSlot, profileId: string | null) => {
        if (!week) return;
        setBusy(true);
        try {
            const client = await getEsskaClient();
            const existing = shifts.find((s) => s.datum === datum && s.slot === slot);

            if (!profileId) {
                if (existing) {
                    const { error: e } = await client.from("shifts").delete().eq("id", existing.id);
                    if (e) throw e;
                    setShifts((prev) => prev.filter((s) => s.id !== existing.id));
                    setShiftsWeekAll((prev) => prev.filter((s) => s.id !== existing.id));
                }
                return;
            }

            const override = zeitOverride[cellKey(datum, slot)];
            const std = SLOT_DEFAULT_ZEITEN[slot];

            if (existing) {
                const { data, error: e } = await client
                    .from("shifts")
                    .update({
                        profile_id: profileId,
                        start_zeit: override?.start ?? existing.start_zeit,
                        end_zeit: override?.ende ?? existing.end_zeit,
                    })
                    .eq("id", existing.id)
                    .select("*")
                    .single();
                if (e) throw e;
                setShifts((prev) => prev.map((s) => (s.id === existing.id ? (data as EsskaShift) : s)));
                setShiftsWeekAll((prev) => prev.map((s) => (s.id === existing.id ? (data as EsskaShift) : s)));
            } else {
                const { data, error: e } = await client
                    .from("shifts")
                    .insert({
                        shift_week_id: week.id,
                        center_id: params.centerId,
                        profile_id: profileId,
                        datum,
                        slot,
                        start_zeit: override?.start ?? std.start,
                        end_zeit: override?.ende ?? std.ende,
                    })
                    .select("*")
                    .single();
                if (e) throw e;
                setShifts((prev) => [...prev, data as EsskaShift]);
                setShiftsWeekAll((prev) => [...prev, data as EsskaShift]);
            }
        } catch (err) {
            setError(friendlyError(err, { aktion: "Schicht setzen" }));
        } finally {
            setBusy(false);
        }
    };

    const updateZeit = async (shift: EsskaShift, start: string, ende: string) => {
        setBusy(true);
        try {
            const client = await getEsskaClient();
            const { data, error: e } = await client
                .from("shifts")
                .update({ start_zeit: start, end_zeit: ende })
                .eq("id", shift.id)
                .select("*")
                .single();
            if (e) throw e;
            setShifts((prev) => prev.map((s) => (s.id === shift.id ? (data as EsskaShift) : s)));
            setShiftsWeekAll((prev) => prev.map((s) => (s.id === shift.id ? (data as EsskaShift) : s)));
        } catch (err) {
            setError(friendlyError(err, { aktion: "Zeit aktualisieren" }));
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <div className="p-6 text-gray-500">Lädt…</div>;
    if (!center) return <div className="p-6 text-red-600 text-sm">Center nicht gefunden.</div>;

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div>
                <Link href="/app/shifts" className="text-sm text-primary-600 hover:underline">
                    ← Zurück zur Schichtplan-Übersicht
                </Link>
                <h1 className="text-3xl font-bold mt-2 text-center">
                    {center.name} <span className="font-mono text-base text-gray-500">({center.kuerzel})</span>
                </h1>
                <p className="text-center text-gray-500">
                    Woche {wochenStart.toLocaleDateString("de-DE")} – {addTage(wochenStart, 6).toLocaleDateString("de-DE")} · Saison {center.saison}
                </p>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

            {!week ? (
                <div className="bg-white border rounded-lg p-6 text-center">
                    <p className="text-gray-600 mb-3">Für diese Woche gibt es noch keinen Plan.</p>
                    <button
                        onClick={wocheAnlegen}
                        disabled={busy}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                        Wochenplan anlegen
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between flex-wrap gap-3 bg-white border rounded-lg p-3">
                        <div className="flex items-center gap-3">
                            <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                    week.veroeffentlicht ? "bg-green-100 text-green-800" : "bg-secondary-100 text-secondary-800"
                                }`}
                            >
                                {week.veroeffentlicht ? "veröffentlicht" : "Entwurf"}
                            </span>
                            {week.veroeffentlicht_am && (
                                <span className="text-xs text-gray-500">
                                    seit {new Date(week.veroeffentlicht_am).toLocaleString("de-DE")}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={veroeffentlichen}
                            disabled={busy}
                            className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm ${
                                week.veroeffentlicht
                                    ? "border border-gray-300 hover:bg-secondary-100"
                                    : "bg-primary-600 text-white hover:bg-primary-700"
                            }`}
                        >
                            {week.veroeffentlicht ? (
                                <>
                                    <EyeOff className="h-4 w-4 mr-2" />
                                    Veröffentlichung zurückziehen
                                </>
                            ) : (
                                <>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Veröffentlichen
                                </>
                            )}
                        </button>
                    </div>

                    {people.length === 0 ? (
                        <div className="p-3 bg-amber-50 text-amber-800 rounded-md text-sm">
                            Diesem Center sind noch keine Mitarbeiter zugeordnet.{" "}
                            <Link href={`/app/centers/${center.id}`} className="underline">
                                Center öffnen
                            </Link>{" "}
                            und Mitarbeiter über die Mitarbeiterliste zuordnen.
                        </div>
                    ) : (
                        <div className="overflow-x-auto bg-white border rounded-lg">
                            <table className="min-w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-secondary-100">
                                        <th className="px-3 py-2 text-left border w-24">Datum</th>
                                        <th className="px-3 py-2 text-left border w-28">Wochentag</th>
                                        {SLOTS.map((s) => (
                                            <th key={s} className="px-3 py-2 text-center border">
                                                <div className="font-semibold">{SLOT_LABELS[s]}</div>
                                                <div className="text-xs font-normal text-gray-500">
                                                    Standard {SLOT_DEFAULT_ZEITEN[s].start.slice(0, 5)}–{SLOT_DEFAULT_ZEITEN[s].ende.slice(0, 5)}
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
                                                    {t.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}.
                                                </td>
                                                <td className="px-3 py-2 border">{tagKurz(t)}</td>
                                                {SLOTS.map((s) => {
                                                    const current = shifts.find((sh) => sh.datum === datum && sh.slot === s);
                                                    const ckey = cellKey(datum, s);
                                                    return (
                                                        <SlotCell
                                                            key={s}
                                                            cellKey={ckey}
                                                            datum={datum}
                                                            slot={s}
                                                            shift={current}
                                                            people={people}
                                                            wunschVon={wunschVon}
                                                            limitInfo={limitInfo}
                                                            busy={busy}
                                                            override={zeitOverride[ckey]}
                                                            setOverride={(o) =>
                                                                setZeitOverride((prev) => ({ ...prev, [ckey]: o }))
                                                            }
                                                            onSetPerson={(pid) => setSlotPerson(datum, s, pid)}
                                                            onUpdateZeit={(start, ende) =>
                                                                current && updateZeit(current, start, ende)
                                                            }
                                                        />
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function SlotCell({
    datum,
    slot,
    cellKey,
    shift,
    people,
    wunschVon,
    limitInfo,
    busy,
    override,
    setOverride,
    onSetPerson,
    onUpdateZeit,
}: {
    datum: string;
    slot: EsskaShiftSlot;
    cellKey: string;
    shift: EsskaShift | undefined;
    people: AssignedProfile[];
    wunschVon: (id: string, datum: string, slot: EsskaShiftSlot) => EsskaWunsch;
    limitInfo: (p: AssignedProfile, ignoreCellKey?: string) => {
        schichtenIst: number;
        stundenIst: number;
        schichtenLimit: number | null;
        stundenLimit: number | null;
        warnungen: string[];
    };
    busy: boolean;
    override: { start: string; ende: string } | undefined;
    setOverride: (o: { start: string; ende: string }) => void;
    onSetPerson: (pid: string | null) => void;
    onUpdateZeit: (start: string, ende: string) => void;
}) {
    const std = SLOT_DEFAULT_ZEITEN[slot];
    const aktStart = (override?.start ?? shift?.start_zeit?.slice(0, 5)) ?? std.start;
    const aktEnde = (override?.ende ?? shift?.end_zeit?.slice(0, 5)) ?? std.ende;

    // Mitarbeiter sortieren: wünsche zuerst, dann könnte, dann kann_nicht
    const sortiert = [...people].sort((a, b) => {
        const wa = wunschVon(a.id, datum, slot);
        const wb = wunschVon(b.id, datum, slot);
        const score = (w: EsskaWunsch) => (w === "wuensche" ? 0 : w === "koennte" ? 1 : 2);
        return score(wa) - score(wb);
    });

    const aktivePerson = shift ? people.find((p) => p.id === shift.profile_id) : undefined;
    const aktivLimit = aktivePerson ? limitInfo(aktivePerson, cellKey) : null;

    return (
        <td className="px-2 py-2 border align-top">
            <div className="flex flex-col gap-1">
                <select
                    value={shift?.profile_id ?? ""}
                    onChange={(e) => onSetPerson(e.target.value || null)}
                    disabled={busy}
                    className="w-full border rounded-md px-2 py-1 text-sm"
                >
                    <option value="">– leer –</option>
                    {sortiert.map((p) => {
                        const wunsch = wunschVon(p.id, datum, slot);
                        const nichtWaehlbar = wunsch === "kann_nicht";
                        const info = limitInfo(p, cellKey);
                        const label = `${WUNSCH_ICON[wunsch]} ${p.vorname ?? ""} ${p.nachname ?? ""}`.trim()
                            || (p.email ?? "?");
                        const limitText = info.schichtenLimit
                            ? ` (${info.schichtenIst}/${info.schichtenLimit})`
                            : "";
                        return (
                            <option key={p.id} value={p.id} disabled={nichtWaehlbar}>
                                {label}
                                {limitText}
                                {nichtWaehlbar ? " — kann nicht" : ""}
                            </option>
                        );
                    })}
                </select>

                {shift && (
                    <>
                        <div className="flex gap-1 items-center">
                            <input
                                type="time"
                                value={aktStart}
                                onChange={(e) => setOverride({ start: e.target.value, ende: aktEnde })}
                                onBlur={() => onUpdateZeit(aktStart, aktEnde)}
                                disabled={busy}
                                className="w-20 border rounded px-1 py-0.5 text-xs"
                            />
                            <span className="text-xs">–</span>
                            <input
                                type="time"
                                value={aktEnde}
                                onChange={(e) => setOverride({ start: aktStart, ende: e.target.value })}
                                onBlur={() => onUpdateZeit(aktStart, aktEnde)}
                                disabled={busy}
                                className="w-20 border rounded px-1 py-0.5 text-xs"
                            />
                            <button
                                onClick={() => onSetPerson(null)}
                                disabled={busy}
                                className="ml-auto text-red-600 hover:text-red-800"
                                title="Schicht entfernen"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        {aktivLimit && aktivLimit.warnungen.length > 0 && (
                            <div className="text-xs text-amber-700 bg-amber-50 rounded px-1 py-0.5">
                                ⚠ {aktivLimit.warnungen.join(", ")}
                            </div>
                        )}
                    </>
                )}
            </div>
        </td>
    );
}
