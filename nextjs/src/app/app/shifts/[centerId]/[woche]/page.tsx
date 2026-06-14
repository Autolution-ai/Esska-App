"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type {
    EsskaAvailabilityRow,
    EsskaCenter,
    EsskaProfile,
    EsskaShift,
    EsskaShiftWeek,
} from "@/lib/esska/types";
import {
    AVAILABILITY_LABELS,
    addTage,
    isoDatum,
    montagDerWoche,
    tagKurz,
} from "@/lib/esska/types";

type AssignedProfile = Pick<EsskaProfile, "id" | "vorname" | "nachname" | "email">;

export default function WocheEditorPage() {
    const params = useParams<{ centerId: string; woche: string }>();
    const wochenStart = useMemo(() => montagDerWoche(new Date(params.woche)), [params.woche]);
    const tage = useMemo(() => Array.from({ length: 7 }, (_, i) => addTage(wochenStart, i)), [wochenStart]);

    const [center, setCenter] = useState<EsskaCenter | null>(null);
    const [week, setWeek] = useState<EsskaShiftWeek | null>(null);
    const [shifts, setShifts] = useState<EsskaShift[]>([]);
    const [people, setPeople] = useState<AssignedProfile[]>([]);
    const [availability, setAvailability] = useState<EsskaAvailabilityRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Eingabezeilen je Tag
    const [neueZeile, setNeueZeile] = useState<Record<string, { profile_id: string; start: string; ende: string; pause: string; rolle: string }>>(
        {}
    );

    const reload = async () => {
        try {
            const client = await getEsskaClient();
            const von = isoDatum(wochenStart);
            const bis = isoDatum(addTage(wochenStart, 6));

            const [cRes, aRes] = await Promise.all([
                client.from("centers").select("*").eq("id", params.centerId).single(),
                client
                    .from("center_assignments")
                    .select("rolle_im_center, profiles(id, vorname, nachname, email)")
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
                    .order("start_zeit");
                if (sErr) throw sErr;
                setShifts((sData as EsskaShift[]) ?? []);
            } else {
                setShifts([]);
            }

            if (peeps.length > 0) {
                const ids = peeps.map((p) => p.id);
                const { data: aData } = await client
                    .from("availabilities")
                    .select("*")
                    .in("profile_id", ids)
                    .gte("datum", von)
                    .lte("datum", bis);
                setAvailability((aData as EsskaAvailabilityRow[]) ?? []);
            }
        } catch (err) {
            setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
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
            setError(friendlyError(err, { aktion: "Anlegen fehlgeschlagen" }));
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
            setError(friendlyError(err, { aktion: "Veröffentlichen fehlgeschlagen" }));
        } finally {
            setBusy(false);
        }
    };

    const schichtAnlegen = async (datum: string) => {
        if (!week) return;
        const z = neueZeile[datum];
        if (!z?.profile_id || !z.start || !z.ende) return;
        setBusy(true);
        try {
            const client = await getEsskaClient();
            const { data, error: e } = await client
                .from("shifts")
                .insert({
                    shift_week_id: week.id,
                    center_id: params.centerId,
                    profile_id: z.profile_id,
                    datum,
                    start_zeit: z.start,
                    end_zeit: z.ende,
                    pause_min: z.pause ? parseInt(z.pause, 10) || 0 : 0,
                    rolle: z.rolle?.trim() || null,
                })
                .select("*")
                .single();
            if (e) throw e;
            setShifts((prev) => [...prev, data as EsskaShift]);
            setNeueZeile((prev) => ({ ...prev, [datum]: { profile_id: "", start: "", ende: "", pause: "", rolle: "" } }));
        } catch (err) {
            setError(friendlyError(err, { aktion: "Schicht anlegen fehlgeschlagen" }));
        } finally {
            setBusy(false);
        }
    };

    const schichtLoeschen = async (id: string) => {
        if (!confirm("Schicht wirklich löschen?")) return;
        setBusy(true);
        try {
            const client = await getEsskaClient();
            const { error: e } = await client.from("shifts").delete().eq("id", id);
            if (e) throw e;
            setShifts((prev) => prev.filter((s) => s.id !== id));
        } catch (err) {
            setError(friendlyError(err, { aktion: "Löschen fehlgeschlagen" }));
        } finally {
            setBusy(false);
        }
    };

    const findePerson = (id: string) => people.find((p) => p.id === id);
    const verfuegbarkeitAn = (profileId: string, datum: string) =>
        availability.find((a) => a.profile_id === profileId && a.datum === datum)?.status;

    if (loading) return <div className="p-6 text-gray-500">Lädt…</div>;
    if (!center) return <div className="p-6 text-red-600 text-sm">Center nicht gefunden.</div>;

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div>
                <Link href="/app/shifts" className="text-sm text-primary-600 hover:underline">
                    ← Zurück zur Schichtplan-Übersicht
                </Link>
                <h1 className="text-2xl font-bold mt-2">
                    {center.name} <span className="font-mono text-base text-gray-500">({center.kuerzel})</span>
                </h1>
                <p className="text-gray-500">
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
                        <div className="space-y-4">
                            {tage.map((t) => {
                                const datum = isoDatum(t);
                                const tageschichten = shifts.filter((s) => s.datum === datum);
                                const z = neueZeile[datum] ?? { profile_id: "", start: "", ende: "", pause: "", rolle: "" };
                                return (
                                    <div key={datum} className="bg-white border rounded-lg p-4">
                                        <div className="flex items-baseline justify-between mb-2">
                                            <h3 className="font-semibold">
                                                {tagKurz(t)}, {t.toLocaleDateString("de-DE")}
                                            </h3>
                                            <span className="text-xs text-gray-500">
                                                {tageschichten.length} Schicht{tageschichten.length === 1 ? "" : "en"}
                                            </span>
                                        </div>

                                        {tageschichten.length > 0 && (
                                            <ul className="divide-y mb-3">
                                                {tageschichten.map((s) => {
                                                    const p = findePerson(s.profile_id);
                                                    return (
                                                        <li key={s.id} className="py-2 flex items-center justify-between text-sm">
                                                            <span>
                                                                <strong>
                                                                    {p ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email : "?"}
                                                                </strong>{" "}
                                                                · {s.start_zeit.slice(0, 5)} – {s.end_zeit.slice(0, 5)}
                                                                {s.pause_min > 0 && ` · ${s.pause_min} Min Pause`}
                                                                {s.rolle && ` · ${s.rolle}`}
                                                            </span>
                                                            <button
                                                                onClick={() => schichtLoeschen(s.id)}
                                                                disabled={busy}
                                                                className="text-red-600 hover:text-red-800"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs text-gray-500 mb-1">Mitarbeiter</label>
                                                <select
                                                    value={z.profile_id}
                                                    onChange={(e) =>
                                                        setNeueZeile((prev) => ({ ...prev, [datum]: { ...z, profile_id: e.target.value } }))
                                                    }
                                                    className="w-full border rounded-md px-2 py-1.5 text-sm"
                                                >
                                                    <option value="">– wählen –</option>
                                                    {people.map((p) => {
                                                        const vf = verfuegbarkeitAn(p.id, datum);
                                                        return (
                                                            <option key={p.id} value={p.id}>
                                                                {`${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email}
                                                                {vf ? ` · ${AVAILABILITY_LABELS[vf]}` : ""}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Start</label>
                                                <input
                                                    type="time"
                                                    value={z.start}
                                                    onChange={(e) =>
                                                        setNeueZeile((prev) => ({ ...prev, [datum]: { ...z, start: e.target.value } }))
                                                    }
                                                    className="w-full border rounded-md px-2 py-1.5 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Ende</label>
                                                <input
                                                    type="time"
                                                    value={z.ende}
                                                    onChange={(e) =>
                                                        setNeueZeile((prev) => ({ ...prev, [datum]: { ...z, ende: e.target.value } }))
                                                    }
                                                    className="w-full border rounded-md px-2 py-1.5 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Pause (Min)</label>
                                                <input
                                                    value={z.pause}
                                                    onChange={(e) =>
                                                        setNeueZeile((prev) => ({ ...prev, [datum]: { ...z, pause: e.target.value } }))
                                                    }
                                                    inputMode="numeric"
                                                    className="w-full border rounded-md px-2 py-1.5 text-sm"
                                                />
                                            </div>
                                            <div className="md:col-span-1 flex gap-2">
                                                <input
                                                    value={z.rolle}
                                                    onChange={(e) =>
                                                        setNeueZeile((prev) => ({ ...prev, [datum]: { ...z, rolle: e.target.value } }))
                                                    }
                                                    placeholder="Rolle"
                                                    className="flex-1 border rounded-md px-2 py-1.5 text-sm"
                                                />
                                                <button
                                                    onClick={() => schichtAnlegen(datum)}
                                                    disabled={busy || !z.profile_id || !z.start || !z.ende}
                                                    className="px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
