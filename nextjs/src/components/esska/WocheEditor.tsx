"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import { useGlobal } from "@/lib/context/GlobalContext";
import type {
    EsskaAvailabilityRow,
    EsskaCenter,
    EsskaCenterOpeningHour,
    EsskaProfile,
    EsskaShift,
    EsskaShiftSlot,
    EsskaShiftWeek,
    EsskaSonderoeffnung,
    EsskaWunsch,
} from "@/lib/esska/types";
import {
    SLOT_LABELS,
    WUNSCH_ICON,
    addTage,
    centerTagStatus,
    isoDatum,
    montagDerWoche,
    nettoStunden,
    parseIsoDatum,
    slotZeitenFuerTag,
    sonderoeffnungLabel,
    tagKurz,
    zeitKurz,
} from "@/lib/esska/types";

const SLOTS: EsskaShiftSlot[] = ["vormittag", "nachmittag"];

// Zeitauswahl in 15-Minuten-Schritten (statt Freitext-Uhrzeit mit allen
// Minuten). Bereich 07:00–22:00 deckt alle realistischen Center-Zeiten ab.
const ZEIT_OPTIONEN: string[] = (() => {
    const arr: string[] = [];
    for (let h = 7; h <= 22; h++) {
        for (const m of [0, 15, 30, 45]) {
            if (h === 22 && m > 0) continue;
            arr.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
        }
    }
    return arr;
})();

function ZeitSelect({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
}) {
    // Falls ein alter Wert nicht im 15-Minuten-Raster liegt, trotzdem anzeigen
    const optionen = ZEIT_OPTIONEN.includes(value)
        ? ZEIT_OPTIONEN
        : [value, ...ZEIT_OPTIONEN].sort();
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="border rounded px-1 py-0.5 text-xs"
        >
            {optionen.map((z) => (
                <option key={z} value={z}>{z}</option>
            ))}
        </select>
    );
}

type AssignedProfile = Pick<
    EsskaProfile,
    "id" | "vorname" | "nachname" | "email" | "arbeitszeit_modell" | "stunden_pro_woche" | "max_schichten_pro_woche" | "aktiv"
>;

/** Wochenplan eines Centers bearbeiten. Eigene Seite (/app/shifts/[center]/[woche])
 *  oder eingebettet in die Schichtplan-Uebersicht. */
export default function WocheEditor({
    centerId,
    woche,
    eingebettet = false,
    onGeaendert,
}: {
    centerId: string;
    woche: string;
    /** In der Uebersicht: ohne Zurueck-Link und kleinere Ueberschrift */
    eingebettet?: boolean;
    /** Woche angelegt, (de)veroeffentlicht oder geloescht */
    onGeaendert?: () => void;
}) {
    const params = { centerId, woche };
    const { role: rolle } = useGlobal();
    const wochenStart = useMemo(() => montagDerWoche(parseIsoDatum(params.woche)), [params.woche]);
    const tage = useMemo(() => Array.from({ length: 7 }, (_, i) => addTage(wochenStart, i)), [wochenStart]);

    const [center, setCenter] = useState<EsskaCenter | null>(null);
    const [week, setWeek] = useState<EsskaShiftWeek | null>(null);
    const [shifts, setShifts] = useState<EsskaShift[]>([]);
    // alle Schichten dieser Mitarbeiter ueber alle Center fuer Limit-Pruefung
    const [shiftsWeekAll, setShiftsWeekAll] = useState<EsskaShift[]>([]);
    const [people, setPeople] = useState<AssignedProfile[]>([]);
    const [availability, setAvailability] = useState<EsskaAvailabilityRow[]>([]);
    // Oeffnungstage: geschlossene Tage ausgrauen, verkaufsoffene Sonntage markieren
    const [oeffnungen, setOeffnungen] = useState<EsskaCenterOpeningHour[]>([]);
    const [sonder, setSonder] = useState<EsskaSonderoeffnung[]>([]);
    // true, wenn die Schichten anderer Center nicht sichtbar sind
    const [limitUnvollstaendig, setLimitUnvollstaendig] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    // Inline-Zeit-Override pro Zelle (lokaler Zwischenzustand bis Save)
    // Bonus (+1 EUR je Stunde) je Schicht: shift_id -> Cent je Stunde.
    // Nur Admin/Regionalmanager sehen und setzen das (Datenbankregel).
    const [bonus, setBonus] = useState<Map<string, number>>(new Map());
    // Wochenplan loeschen: zweistufig mit Bestaetigung
    const [loeschenOffen, setLoeschenOffen] = useState(false);
    const [loeschenVerstanden, setLoeschenVerstanden] = useState(false);
    // Im Zaehler angeklickte Person: deren Verfuegbarkeit der Woche aufklappen
    const [detailPerson, setDetailPerson] = useState<string | null>(null);
    const [zeitOverride, setZeitOverride] = useState<Record<string, { start: string; ende: string }>>({});

    const cellKey = (datum: string, slot: EsskaShiftSlot) => `${datum}::${slot}`;

    // Schichtzeiten je Tag aus den Oeffnungszeiten des Centers (nicht mehr
    // fest 09:00-15:00 / 15:00-20:30).
    const zeitenFuer = (datum: string) => slotZeitenFuerTag(params.centerId, datum, oeffnungen, sonder);
    // Kopfzeile: Zeiten nur anzeigen, wenn sie an allen geoeffneten Tagen der
    // Woche gleich sind - sonst stehen sie je Zelle.
    const kopfZeiten = (slot: EsskaShiftSlot): string => {
        const offen = tage
            .map((t) => isoDatum(t))
            .filter((d) => centerTagStatus(params.centerId, d, oeffnungen, sonder).offen);
        const varianten = new Set(offen.map((d) => {
            const z = zeitenFuer(d)[slot];
            return `${z.start}–${z.ende}`;
        }));
        return varianten.size === 1 ? `${[...varianten][0]} Uhr` : "je nach Öffnungszeit";
    };

    const reload = async () => {
        try {
            const client = await getEsskaClient();
            const von = isoDatum(wochenStart);
            const bis = isoDatum(addTage(wochenStart, 6));

            // Profile kommen ueber planungsprofile(): Regionalmanager duerfen
            // die Profiltabelle nicht mehr direkt lesen (Steuer-ID etc.).
            const [cRes, aRes, ppRes, oRes, soRes] = await Promise.all([
                client.from("centers").select("*").eq("id", params.centerId).single(),
                client.from("center_assignments").select("profile_id").eq("center_id", params.centerId),
                client.rpc("planungsprofile"),
                client.from("center_opening_hours").select("*").eq("center_id", params.centerId),
                client
                    .from("center_sonderoeffnungen")
                    .select("*")
                    .eq("center_id", params.centerId)
                    .gte("datum", von)
                    .lte("datum", bis),
            ]);
            if (cRes.error) throw cRes.error;
            setOeffnungen((oRes.data as EsskaCenterOpeningHour[]) ?? []);
            setSonder((soRes.data as EsskaSonderoeffnung[]) ?? []);
            if (aRes.error) throw aRes.error;
            setCenter(cRes.data as EsskaCenter);
            if (ppRes.error) throw ppRes.error;
            const zugeordnet = new Set(((aRes.data as Array<{ profile_id: string }>) ?? []).map((r) => r.profile_id));
            // Der Regionalmanager des Centers kann sich selbst einplanen, wenn er
            // eine Schicht uebernimmt - er ist am Center als Manager eingetragen,
            // nicht als zugeordneter Mitarbeiter.
            const managerId = (cRes.data as EsskaCenter).manager_id;
            if (managerId) zugeordnet.add(managerId);
            const peeps = ((ppRes.data as AssignedProfile[]) ?? []).filter((p) => zugeordnet.has(p.id));
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
                const wochenSchichten = (sData as EsskaShift[]) ?? [];
                setShifts(wochenSchichten);
                if (wochenSchichten.length > 0) {
                    const { data: zData } = await client
                        .from("schicht_zulagen")
                        .select("shift_id, bonus_cent_pro_stunde")
                        .in("shift_id", wochenSchichten.map((x) => x.id));
                    setBonus(
                        new Map(
                            ((zData as Array<{ shift_id: string; bonus_cent_pro_stunde: number }>) ?? []).map((z) => [
                                z.shift_id,
                                Number(z.bonus_cent_pro_stunde),
                            ])
                        )
                    );
                } else {
                    setBonus(new Map());
                }
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
                // Die Limit-Pruefung zaehlt Schichten ueber ALLE Center. Als
                // Regionalmanager liefert die Datenbank aber nur die eigenen
                // Center - die Zaehlung waere dann unvollstaendig, ohne dass
                // man es sieht. Deshalb hier merken und im Plan anzeigen.
                setLimitUnvollstaendig(!!allShifts.error);
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
            onGeaendert?.();
        } catch (err) {
            setError(friendlyError(err, { aktion: "Woche anlegen" }));
        } finally {
            setBusy(false);
        }
    };

    const veroeffentlichen = async () => {
        if (!week) return;
        const wirdVeroeffentlicht = !week.veroeffentlicht;
        const eingeplant = new Set(shifts.map((s) => s.profile_id)).size;
        // Mails nur bei der ersten Veroeffentlichung, nie fuer vergangene
        // Wochen - und nur, wenn man es beim Veroeffentlichen bestaetigt.
        const ersteVeroeffentlichung = !week.benachrichtigt_am;
        const wocheVorbei = isoDatum(addTage(wochenStart, 6)) < isoDatum(new Date());
        const mailMoeglich = wirdVeroeffentlicht && ersteVeroeffentlichung && eingeplant > 0 && !wocheVorbei;
        const mailSenden =
            mailMoeglich &&
            window.confirm(
                `Sollen die ${eingeplant} eingeplanten ${eingeplant === 1 ? "Person ihre" : "Personen ihre"} Schichten per E-Mail bekommen?\n\n` +
                    "OK = veröffentlichen und E-Mails senden\nAbbrechen = nur veröffentlichen, keine E-Mails\n\n" +
                    "Danach werden für diese Woche keine E-Mails mehr verschickt."
            );
        setBusy(true);
        setInfo(null);
        setError(null);
        try {
            const client = await getEsskaClient();
            const { data: { user } } = await client.auth.getUser();
            const payload = week.veroeffentlicht
                ? { veroeffentlicht: false, veroeffentlicht_am: null, veroeffentlicht_von: null }
                : {
                      veroeffentlicht: true,
                      veroeffentlicht_am: new Date().toISOString(),
                      veroeffentlicht_von: user?.id ?? null,
                      // Ohne Mail veroeffentlicht: auch spaeter keine Mails mehr
                      ...(!mailSenden && !week.benachrichtigt_am ? { benachrichtigt_am: new Date().toISOString() } : {}),
                  };
            const { data, error: e } = await client
                .from("shift_weeks")
                .update(payload)
                .eq("id", week.id)
                .select("*")
                .single();
            if (e) throw e;
            setWeek(data as EsskaShiftWeek);
            onGeaendert?.();

            // Eingeplante per E-Mail informieren. Scheitert der Versand, bleibt
            // der Plan trotzdem veroeffentlicht - die Meldung sagt, was fehlt.
            if (wirdVeroeffentlicht && !mailSenden) {
                setInfo("Veröffentlicht. Es wurden keine E-Mails verschickt.");
            }
            if (mailSenden) {
                const res = await fetch("/api/shifts/benachrichtigen", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ wocheId: week.id }),
                });
                const ergebnis = await res.json().catch(() => ({}));
                if (!res.ok) {
                    setError(
                        `Veröffentlicht, aber die E-Mails konnten nicht verschickt werden: ${ergebnis.error ?? "unbekannter Fehler"}`
                    );
                } else {
                    setWeek((w) => (w ? { ...w, benachrichtigt_am: new Date().toISOString() } : w));
                    const teile = [`Veröffentlicht. ${ergebnis.verschickt} E-Mail${ergebnis.verschickt === 1 ? "" : "s"} verschickt.`];
                    if (ergebnis.ohneEmail > 0) teile.push(`${ergebnis.ohneEmail} ohne E-Mail-Adresse.`);
                    if (ergebnis.fehlgeschlagen?.length > 0) {
                        teile.push(`Nicht zugestellt: ${ergebnis.fehlgeschlagen.join(", ")}.`);
                    }
                    setInfo(teile.join(" "));
                }
            }
        } catch (err) {
            setError(friendlyError(err, { aktion: "Veroeffentlichen" }));
        } finally {
            setBusy(false);
        }
    };

    const bonusUmschalten = async (shift: EsskaShift) => {
        setBusy(true);
        setError(null);
        try {
            const client = await getEsskaClient();
            if (bonus.has(shift.id)) {
                const { error: e } = await client.from("schicht_zulagen").delete().eq("shift_id", shift.id);
                if (e) throw e;
                setBonus((alt) => {
                    const neu = new Map(alt);
                    neu.delete(shift.id);
                    return neu;
                });
            } else {
                const { data, error: e } = await client
                    .from("schicht_zulagen")
                    .insert({ shift_id: shift.id })
                    .select("shift_id, bonus_cent_pro_stunde")
                    .single();
                if (e) throw e;
                const z = data as { shift_id: string; bonus_cent_pro_stunde: number };
                setBonus((alt) => new Map(alt).set(z.shift_id, Number(z.bonus_cent_pro_stunde)));
            }
        } catch (err) {
            setError(friendlyError(err, { aktion: "Bonus setzen" }));
        } finally {
            setBusy(false);
        }
    };

    const wocheLoeschen = async () => {
        if (!week || !loeschenVerstanden) return;
        setBusy(true);
        setError(null);
        setInfo(null);
        try {
            const client = await getEsskaClient();
            const { error: e } = await client.from("shift_weeks").delete().eq("id", week.id);
            if (e) throw e;
            const ids = new Set(shifts.map((x) => x.id));
            setShiftsWeekAll((alt) => alt.filter((x) => !ids.has(x.id)));
            setShifts([]);
            setBonus(new Map());
            setWeek(null);
            onGeaendert?.();
            setLoeschenOffen(false);
            setLoeschenVerstanden(false);
            setInfo("Der Wochenplan wurde gelöscht.");
        } catch (err) {
            setError(friendlyError(err, { aktion: "Wochenplan löschen" }));
        } finally {
            setBusy(false);
        }
    };

    const availFor = (profileId: string, datum: string, slot: EsskaShiftSlot): EsskaAvailabilityRow | undefined => {
        return availability.find((a) => a.profile_id === profileId && a.datum === datum && a.slot === slot);
    };

    // Wer hat fuer diese Woche ueberhaupt schon Verfuegbarkeiten eingetragen?
    // Ohne Eintrag gilt zwar "koennte", das ist aber keine echte Zusage.
    const eingetragen = useMemo(() => new Set(availability.map((a) => a.profile_id)), [availability]);
    const hatEingetragen = (profileId: string) => eingetragen.has(profileId);

    const wunschVon = (profileId: string, datum: string, slot: EsskaShiftSlot): EsskaWunsch => {
        return availFor(profileId, datum, slot)?.wunsch ?? "koennte";
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
            const std = zeitenFuer(datum)[slot];

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
        <div className={eingebettet ? "space-y-6" : "space-y-6 p-2 md:p-6"}>
            <div>
                {!eingebettet && (
                    <Link href="/app/shifts" className="text-sm text-primary-600 hover:underline">
                        ← Zurück zur Schichtplan-Übersicht
                    </Link>
                )}
                <h1 className={eingebettet ? "text-xl font-bold text-center" : "text-3xl font-bold mt-2 text-center"}>
                    {center.name} <span className="font-mono text-base text-gray-500">({center.kuerzel})</span>
                </h1>
                <p className="text-center text-gray-500">
                    Woche {wochenStart.toLocaleDateString("de-DE")} – {addTage(wochenStart, 6).toLocaleDateString("de-DE")} · Saison {center.saison}
                </p>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
            {info && <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{info}</div>}

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
                            {week.veroeffentlicht && (
                                <span className="text-xs text-gray-500">
                                    · Änderungen möglich: alle Mitarbeiter auswählbar, auch bei „kann nicht“ · keine
                                    erneuten E-Mails
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

                    <div className="flex justify-end">
                        {!loeschenOffen ? (
                            <button
                                type="button"
                                onClick={() => setLoeschenOffen(true)}
                                disabled={busy}
                                className="inline-flex items-center text-sm text-red-700 hover:text-red-900"
                            >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Wochenplan löschen
                            </button>
                        ) : (
                            <div className="w-full p-4 bg-red-50 border border-red-300 rounded-lg text-sm space-y-3">
                                <p className="font-semibold text-red-900">Wochenplan wirklich löschen?</p>
                                <ul className="list-disc pl-5 text-red-900 space-y-1">
                                    <li>
                                        Alle {shifts.length} Schicht{shifts.length === 1 ? "" : "en"} dieser Woche
                                        {bonus.size > 0 ? ` (inkl. ${bonus.size} Bonus)` : ""} werden endgültig gelöscht.
                                    </li>
                                    <li>
                                        <strong>Achtung Lohn:</strong> Die Stunden und Löhne in der Monatsübersicht und
                                        in der Personalakte werden neu berechnet – auch für Monate, die schon
                                        abgerechnet sind.
                                    </li>
                                    {week.veroeffentlicht && (
                                        <li>
                                            Der Plan ist veröffentlicht – die Mitarbeiter haben ihre Schichten schon per
                                            E-Mail bekommen und werden nicht automatisch informiert.
                                        </li>
                                    )}
                                </ul>
                                <label className="flex items-start gap-2 cursor-pointer text-red-900">
                                    <input
                                        type="checkbox"
                                        checked={loeschenVerstanden}
                                        onChange={(e) => setLoeschenVerstanden(e.target.checked)}
                                        className="mt-1"
                                    />
                                    Ich habe geprüft, dass dieser Wochenplan gelöscht werden soll.
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={wocheLoeschen}
                                        disabled={busy || !loeschenVerstanden}
                                        className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800 disabled:opacity-50"
                                    >
                                        Endgültig löschen
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLoeschenOffen(false);
                                            setLoeschenVerstanden(false);
                                        }}
                                        className="px-4 py-2 border rounded-md hover:bg-white"
                                    >
                                        Abbrechen
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {(limitUnvollstaendig || rolle === "regionalmanager") && (
                        <div className="p-3 bg-secondary-50 border border-secondary-200 rounded-md text-sm text-gray-700">
                            <strong>Hinweis zur Stunden- und Schichtzählung:</strong> Die Zahlen in
                            Klammern hinter den Namen (z. B. 3/5) zählen nur Schichten, die du sehen
                            darfst. Ist jemand zusätzlich in einem Center einer anderen Region
                            eingeplant, taucht das hier nicht auf – das Wochenlimit kann also in
                            Summe höher liegen. Bei Mitarbeitern, die in mehreren Regionen arbeiten,
                            bitte kurz mit der Zentrale abstimmen.
                        </div>
                    )}

                    {people.length === 0 ? (
                        <div className="p-3 bg-amber-50 text-amber-800 rounded-md text-sm">
                            Diesem Center sind noch keine Mitarbeiter zugeordnet.{" "}
                            {rolle === "admin" ? (
                                <>
                                    <Link href={`/app/centers/${center.id}`} className="underline">
                                        Center öffnen
                                    </Link>{" "}
                                    und Mitarbeiter über die Mitarbeiterliste zuordnen.
                                </>
                            ) : (
                                "Die Zuordnung nimmt die Verwaltung vor."
                            )}
                        </div>
                    ) : (
                        <>
                        {/* Zaehler: Schichten je Person in dieser Woche + ob die
                            Verfuegbarkeit schon eingetragen ist */}
                        <div className="sticky top-0 z-10 bg-white border rounded-lg p-3 shadow-sm">
                            <div className="text-xs font-medium text-gray-500 mb-2">
                                Schichten diese Woche · Verfügbarkeit eingetragen? · Name antippen für Details
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {[...people]
                                    // Deaktivierte nur, wenn sie in dieser Woche noch Schichten haben
                                    .filter((p) => p.aktiv !== false || schichtenZaehlerWoche(p.id) > 0)
                                    .sort((a, b) =>
                                        `${a.vorname ?? ""} ${a.nachname ?? ""}`.localeCompare(`${b.vorname ?? ""} ${b.nachname ?? ""}`, "de")
                                    )
                                    .map((p) => {
                                        const anzahl = schichtenZaehlerWoche(p.id);
                                        const ok = hatEingetragen(p.id);
                                        const name = `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || (p.email ?? "?");
                                        const offen = detailPerson === p.id;
                                        return (
                                            <button
                                                type="button"
                                                key={p.id}
                                                onClick={() => setDetailPerson(offen ? null : p.id)}
                                                aria-expanded={offen}
                                                title="Verfügbarkeit dieser Woche anzeigen"
                                                className={`inline-flex items-center gap-1.5 text-xs rounded-full border px-2 py-0.5 hover:shadow-sm ${
                                                    ok ? "bg-white border-gray-200" : "bg-amber-50 border-amber-300 text-amber-900"
                                                } ${offen ? "ring-2 ring-primary-400" : ""}`}
                                            >
                                                <span>{ok ? "✓" : "?"}</span>
                                                <span>{name}</span>
                                                <span
                                                    className={`font-semibold rounded-full px-1.5 ${
                                                        anzahl > 0 ? "bg-primary-100 text-primary-800" : "bg-gray-100 text-gray-500"
                                                    }`}
                                                >
                                                    {anzahl}
                                                    {p.max_schichten_pro_woche ? `/${p.max_schichten_pro_woche}` : ""}
                                                </span>
                                            </button>
                                        );
                                    })}
                            </div>
                            {detailPerson && people.some((p) => p.id === detailPerson) && (() => {
                                const p = people.find((x) => x.id === detailPerson)!;
                                const name = `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || (p.email ?? "?");
                                const zelle = (datum: string, slot: EsskaShiftSlot) => {
                                    const a = availFor(p.id, datum, slot);
                                    if (!a) return <span className="text-gray-400">? offen</span>;
                                    if (a.wunsch === "kann_nicht") return <span className="text-red-700">✕ kann nicht</span>;
                                    if (a.wunsch === "wuensche") {
                                        const t =
                                            slot === "vormittag" && a.abweichung_bis
                                                ? `nur bis ${zeitKurz(a.abweichung_bis)}`
                                                : slot === "nachmittag" && a.abweichung_ab
                                                  ? `erst ab ${zeitKurz(a.abweichung_ab)}`
                                                  : "eingeschränkt";
                                        return <span className="text-amber-800">◐ {t}</span>;
                                    }
                                    return <span className="text-green-700">✓ kann</span>;
                                };
                                return (
                                    <div className="mt-3 border-t pt-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium">Verfügbarkeit von {name}</span>
                                            <button
                                                type="button"
                                                onClick={() => setDetailPerson(null)}
                                                className="text-xs text-gray-500 hover:text-gray-800"
                                            >
                                                schließen
                                            </button>
                                        </div>
                                        {!hatEingetragen(p.id) ? (
                                            <p className="text-xs text-amber-800">
                                                Hat für diese Woche noch keine Verfügbarkeit eingetragen.
                                            </p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="text-xs border-collapse">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-2 py-1 text-left font-medium text-gray-500"></th>
                                                            {tage.map((t) => (
                                                                <th key={isoDatum(t)} className="px-2 py-1 text-left font-medium text-gray-500 whitespace-nowrap">
                                                                    {tagKurz(t)} {t.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}.
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {SLOTS.map((sl) => (
                                                            <tr key={sl} className="border-t">
                                                                <td className="px-2 py-1 font-medium text-gray-600 whitespace-nowrap">{SLOT_LABELS[sl]}</td>
                                                                {tage.map((t) => {
                                                                    const d = isoDatum(t);
                                                                    const eingeplant = shiftsWeekAll.some(
                                                                        (sh) => sh.profile_id === p.id && sh.datum === d && sh.slot === sl
                                                                    );
                                                                    return (
                                                                        <td key={d} className="px-2 py-1 whitespace-nowrap">
                                                                            {zelle(d, sl)}
                                                                            {eingeplant && (
                                                                                <span className="ml-1 rounded bg-primary-100 text-primary-800 px-1">eingeplant</span>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            {people.some((p) => p.aktiv !== false && !hatEingetragen(p.id)) && (
                                <p className="text-xs text-amber-800 mt-2">
                                    „?“ = noch keine Verfügbarkeit für diese Woche eingetragen. Diese Personen stehen im
                                    Auswahlfeld unten mit „noch nichts eingetragen“ – sie haben nicht zugesagt, dass sie
                                    können.
                                </p>
                            )}
                        </div>
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
                                                    {kopfZeiten(s)}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tage.map((t) => {
                                        const datum = isoDatum(t);
                                        const tag = centerTagStatus(params.centerId, datum, oeffnungen, sonder);
                                        return (
                                            <tr key={datum} className={`border-t ${tag.offen ? "" : "bg-secondary-50/60"}`}>
                                                <td className="px-3 py-2 border font-medium">
                                                    {t.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}.
                                                </td>
                                                <td className="px-3 py-2 border">
                                                    {tagKurz(t)}
                                                    {tag.sonder && (
                                                        <div className="text-xs font-medium text-primary-700 mt-0.5">
                                                            {sonderoeffnungLabel(datum)}
                                                            {tag.sonder.oeffnet && tag.sonder.schliesst && (
                                                                <span className="block font-normal text-gray-500">
                                                                    {zeitKurz(tag.sonder.oeffnet)}–{zeitKurz(tag.sonder.schliesst)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {!tag.offen && (
                                                        <div className="text-xs text-gray-500 mt-0.5">geschlossen</div>
                                                    )}
                                                </td>
                                                {SLOTS.map((s) => {
                                                    const current = shifts.find((sh) => sh.datum === datum && sh.slot === s);
                                                    const ckey = cellKey(datum, s);
                                                    // Geschlossene Tage nicht planbar - es sei denn, dort
                                                    // steht schon eine Schicht; die wird nicht versteckt.
                                                    if (!tag.offen && !current) {
                                                        return (
                                                            <td key={s} className="px-2 py-2 border text-center text-xs text-gray-400">
                                                                geschlossen
                                                            </td>
                                                        );
                                                    }
                                                    return (
                                                        <SlotCell
                                                            key={s}
                                                            standard={zeitenFuer(datum)[s]}
                                                            cellKey={ckey}
                                                            datum={datum}
                                                            slot={s}
                                                            shift={current}
                                                            people={people}
                                                            wunschVon={wunschVon}
                                                            hatEingetragen={hatEingetragen}
                                                            availFor={availFor}
                                                            limitInfo={limitInfo}
                                                            busy={busy}
                                                            override={zeitOverride[ckey]}
                                                            setOverride={(o) =>
                                                                setZeitOverride((prev) => ({ ...prev, [ckey]: o }))
                                                            }
                                                            onSetPerson={(pid) => setSlotPerson(datum, s, pid)}
                                                            alleWaehlbar={week.veroeffentlicht}
                                                            onUpdateZeit={(start, ende) =>
                                                                current && updateZeit(current, start, ende)
                                                            }
                                                            bonus={current ? bonus.has(current.id) : false}
                                                            onBonus={() => current && bonusUmschalten(current)}
                                                        />
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function SlotCell({
    standard,
    datum,
    slot,
    cellKey,
    shift,
    people,
    wunschVon,
    hatEingetragen,
    availFor,
    limitInfo,
    busy,
    override,
    setOverride,
    onSetPerson,
    onUpdateZeit,
    bonus,
    onBonus,
    alleWaehlbar,
}: {
    /** Schichtzeit dieses Tages laut Oeffnungszeiten des Centers */
    standard: { start: string; ende: string };
    datum: string;
    slot: EsskaShiftSlot;
    cellKey: string;
    shift: EsskaShift | undefined;
    people: AssignedProfile[];
    wunschVon: (id: string, datum: string, slot: EsskaShiftSlot) => EsskaWunsch;
    hatEingetragen: (id: string) => boolean;
    availFor: (id: string, datum: string, slot: EsskaShiftSlot) => EsskaAvailabilityRow | undefined;
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
    /** Bonus +1 EUR je Stunde auf diese Schicht (nur Admin/Regionalmanager) */
    bonus: boolean;
    onBonus: () => void;
    /** Veroeffentlichter Plan: spontane Aenderungen - auch wer "kann nicht"
     *  eingetragen hat, ist auswaehlbar (mit Hinweis). */
    alleWaehlbar: boolean;
}) {
    const std = standard;
    const aktStart = (override?.start ?? shift?.start_zeit?.slice(0, 5)) ?? std.start;
    const aktEnde = (override?.ende ?? shift?.end_zeit?.slice(0, 5)) ?? std.ende;

    // Mitarbeiter sortieren: Abweichung, könnte, noch nichts eingetragen, kann nicht
    const score = (id: string) => {
        if (!hatEingetragen(id)) return 2;
        const w = wunschVon(id, datum, slot);
        return w === "wuensche" ? 0 : w === "koennte" ? 1 : 3;
    };
    const sortiert = [...people].sort((a, b) => score(a.id) - score(b.id));

    const aktivePerson = shift ? people.find((p) => p.id === shift.profile_id) : undefined;
    const aktivLimit = aktivePerson ? limitInfo(aktivePerson, cellKey) : null;

    // Abweichungs-Pruefung: Hat die eingeteilte Person angegeben, dass sie an
    // diesem Slot nur eingeschraenkt kann, entsteht eine Luecke im Plan.
    const aktivAvail = aktivePerson ? availFor(aktivePerson.id, datum, slot) : undefined;
    let zeitWarnung: string | null = null;
    let zeitWarnungRot = false;
    if (aktivAvail) {
        if (aktivAvail.wunsch === "kann_nicht") {
            zeitWarnungRot = true;
            zeitWarnung = "Hat für diesen Slot „Kann nicht“ angegeben – bitte Besetzung prüfen.";
        } else if (aktivAvail.wunsch === "wuensche") {
            const bis = aktivAvail.abweichung_bis ? zeitKurz(aktivAvail.abweichung_bis) : null;
            const ab = aktivAvail.abweichung_ab ? zeitKurz(aktivAvail.abweichung_ab) : null;
            if (slot === "vormittag" && bis && bis < aktEnde) {
                zeitWarnung = `Nur bis ${bis} verfügbar – Lücke ${bis}–${aktEnde}: für diese Zeit wird eine weitere Person gebraucht.`;
            } else if (slot === "nachmittag" && ab && ab > aktStart) {
                zeitWarnung = `Erst ab ${ab} verfügbar – Lücke ${aktStart}–${ab}: für diese Zeit wird eine weitere Person gebraucht.`;
            }
        }
    }

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
                    {sortiert
                        // Deaktivierte Mitarbeiter nicht mehr einplanbar - nur die
                        // bereits eingetragene Person bleibt sichtbar (Vergangenheit).
                        .filter((p) => p.aktiv !== false || p.id === shift?.profile_id)
                        .map((p) => {
                        const avail = availFor(p.id, datum, slot);
                        const wunsch = avail?.wunsch ?? "koennte";
                        const nichtWaehlbar = wunsch === "kann_nicht" && !alleWaehlbar;
                        const info = limitInfo(p, cellKey);
                        const offen = !hatEingetragen(p.id);
                        const label = `${offen ? "?" : WUNSCH_ICON[wunsch]} ${p.vorname ?? ""} ${p.nachname ?? ""}`.trim()
                            || (p.email ?? "?");
                        const limitText = info.schichtenLimit
                            ? ` (${info.schichtenIst}/${info.schichtenLimit})`
                            : "";
                        // Abweichungszeit direkt im Dropdown sichtbar machen
                        let abwText = "";
                        if (wunsch === "wuensche") {
                            if (slot === "vormittag" && avail?.abweichung_bis) {
                                abwText = ` — nur bis ${zeitKurz(avail.abweichung_bis)}`;
                            } else if (slot === "nachmittag" && avail?.abweichung_ab) {
                                abwText = ` — erst ab ${zeitKurz(avail.abweichung_ab)}`;
                            }
                        }
                        return (
                            <option key={p.id} value={p.id} disabled={nichtWaehlbar}>
                                {label}
                                {limitText}
                                {abwText}
                                {wunsch === "kann_nicht" ? " — kann nicht" : ""}
                                {p.aktiv === false ? " — deaktiviert" : ""}
                                {offen ? " — noch nichts eingetragen" : ""}
                            </option>
                        );
                    })}
                </select>

                {shift && (
                    <>
                        <div className="flex gap-1 items-center">
                            <ZeitSelect
                                value={aktStart}
                                onChange={(v) => {
                                    setOverride({ start: v, ende: aktEnde });
                                    onUpdateZeit(v, aktEnde);
                                }}
                                disabled={busy}
                            />
                            <span className="text-xs">–</span>
                            <ZeitSelect
                                value={aktEnde}
                                onChange={(v) => {
                                    setOverride({ start: aktStart, ende: v });
                                    onUpdateZeit(aktStart, v);
                                }}
                                disabled={busy}
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
                        <label
                            className={`inline-flex items-center gap-1.5 text-xs cursor-pointer rounded px-1.5 py-0.5 w-fit ${
                                bonus ? "bg-green-100 text-green-800" : "text-gray-500 hover:bg-gray-50"
                            }`}
                            title="Bonus: +1,00 € je Stunde auf diese Schicht (nur für Admins/Regionalmanager sichtbar)"
                        >
                            <input type="checkbox" checked={bonus} onChange={onBonus} disabled={busy} />
                            Bonus +1 €/h
                        </label>
                        {zeitWarnung && (
                            <div
                                className={`text-xs rounded px-1.5 py-1 ${
                                    zeitWarnungRot
                                        ? "text-red-700 bg-red-50 border border-red-200"
                                        : "text-amber-800 bg-amber-50 border border-amber-300"
                                }`}
                            >
                                ⚠ {zeitWarnung}
                            </div>
                        )}
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
