"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaShift } from "@/lib/esska/types";
import { parseEuro } from "@/lib/esska/types";
import { euroText, lohnAuswerten, stundenText, stundenlohnMap } from "@/lib/esska/lohn";

const MONATE = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** Personalakte: Stundenlohn eintragen und Lohn je Monat (aus den
 *  veroeffentlichten Wochenplaenen). Nur fuer Admins und zustaendige
 *  Regionalmanager - die Datenbank gibt Mitarbeitern diese Daten nicht. */
export default function LohnKarte({ profileId }: { profileId: string }) {
    const [lohn, setLohn] = useState<{ cent: number; quelle: "profil" | "vertrag" } | null>(null);
    const [eingabe, setEingabe] = useState("");
    const [shifts, setShifts] = useState<EsskaShift[]>([]);
    const [bonus, setBonus] = useState<Map<string, number>>(new Map());
    const [loading, setLoading] = useState(true);
    const [speichert, setSpeichert] = useState(false);
    const [fehler, setFehler] = useState<string | null>(null);
    const [erfolg, setErfolg] = useState<string | null>(null);

    const laden = useCallback(async () => {
        setFehler(null);
        try {
            const client = await getEsskaClient();
            const [lRes, vRes, sRes, zRes] = await Promise.all([
                client.from("mitarbeiter_lohn").select("profile_id, stundenlohn_cent").eq("profile_id", profileId),
                client.from("arbeitsvertraege").select("profile_id, stundenlohn_cent, erstellt_am").eq("profile_id", profileId),
                // nur veroeffentlichte Wochenplaene zaehlen fuer den Lohn
                client
                    .from("shifts")
                    .select("*, shift_weeks!inner(veroeffentlicht)")
                    .eq("profile_id", profileId)
                    .eq("shift_weeks.veroeffentlicht", true)
                    .order("datum"),
                client
                    .from("schicht_zulagen")
                    .select("shift_id, bonus_cent_pro_stunde, shifts!inner(profile_id)")
                    .eq("shifts.profile_id", profileId),
            ]);
            for (const r of [lRes, vRes, sRes, zRes]) if (r.error) throw r.error;
            const l = stundenlohnMap(
                (lRes.data as Array<{ profile_id: string; stundenlohn_cent: number }>) ?? [],
                (vRes.data as Array<{ profile_id: string; stundenlohn_cent: number | null; erstellt_am: string }>) ?? []
            ).get(profileId) ?? null;
            setLohn(l);
            setEingabe(l ? (l.cent / 100).toFixed(2).replace(".", ",") : "");
            setShifts((sRes.data as EsskaShift[]) ?? []);
            setBonus(
                new Map(
                    ((zRes.data as unknown as Array<{ shift_id: string; bonus_cent_pro_stunde: number }>) ?? []).map((z) => [
                        z.shift_id,
                        Number(z.bonus_cent_pro_stunde),
                    ])
                )
            );
        } catch (err) {
            setFehler(friendlyError(err, { aktion: "Lohn laden" }));
        } finally {
            setLoading(false);
        }
    }, [profileId]);

    useEffect(() => {
        laden();
    }, [laden]);

    const speichern = async () => {
        setFehler(null);
        setErfolg(null);
        const cent = parseEuro(eingabe);
        if (cent === null || cent <= 0) return setFehler("Bitte den Stundenlohn als Betrag eingeben, z. B. 14,00.");
        setSpeichert(true);
        try {
            const client = await getEsskaClient();
            const { error } = await client
                .from("mitarbeiter_lohn")
                .upsert({ profile_id: profileId, stundenlohn_cent: cent }, { onConflict: "profile_id" });
            if (error) throw error;
            setErfolg("Stundenlohn gespeichert.");
            await laden();
        } catch (err) {
            setFehler(friendlyError(err, { aktion: "Stundenlohn speichern" }));
        } finally {
            setSpeichert(false);
        }
    };

    const monate = useMemo(() => {
        const map = new Map<string, EsskaShift[]>();
        for (const s of shifts) {
            const k = s.datum.slice(0, 7);
            map.set(k, [...(map.get(k) ?? []), s]);
        }
        return [...map.entries()]
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([k, liste]) => ({ k, l: lohnAuswerten(liste, lohn?.cent ?? null, bonus) }));
    }, [shifts, lohn, bonus]);

    if (loading) return <div className="text-sm text-gray-500">Lädt…</div>;

    return (
        <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-end gap-2">
                <div>
                    <label htmlFor={`lohn-${profileId}`} className="block text-xs text-gray-500 mb-1">
                        Stundenlohn brutto (€)
                    </label>
                    <input
                        id={`lohn-${profileId}`}
                        value={eingabe}
                        onChange={(e) => setEingabe(e.target.value)}
                        inputMode="decimal"
                        placeholder="z. B. 14,00"
                        className="w-32 border rounded-md px-3 py-2"
                    />
                </div>
                <button
                    type="button"
                    onClick={speichern}
                    disabled={speichert}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                    {speichert ? "Speichert…" : "Speichern"}
                </button>
                <span className="text-xs text-gray-500">
                    {lohn?.quelle === "vertrag"
                        ? "Aktuell aus dem Arbeitsvertrag übernommen."
                        : lohn
                          ? "In der Personalakte hinterlegt."
                          : "Noch kein Stundenlohn hinterlegt."}
                </span>
            </div>

            {fehler && <div className="p-2 bg-red-50 text-red-700 rounded-md">{fehler}</div>}
            {erfolg && <div className="p-2 bg-green-50 text-green-700 rounded-md">{erfolg}</div>}

            {monate.length === 0 ? (
                <p className="text-gray-500">Noch keine Schichten in veröffentlichten Wochenplänen.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-secondary-50 text-left">
                            <tr>
                                <th className="px-3 py-2 font-medium">Monat</th>
                                <th className="px-3 py-2 font-medium text-right">Schichten</th>
                                <th className="px-3 py-2 font-medium text-right">Mo–Sa</th>
                                <th className="px-3 py-2 font-medium text-right">Sonntag</th>
                                <th className="px-3 py-2 font-medium text-right">Grundlohn</th>
                                <th className="px-3 py-2 font-medium text-right">So.-Zuschlag</th>
                                <th className="px-3 py-2 font-medium text-right">Bonus</th>
                                <th className="px-3 py-2 font-medium text-right">Gesamt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monate.map(({ k, l }) => (
                                <tr key={k} className="border-t">
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {MONATE[Number(k.slice(5, 7)) - 1]} {k.slice(0, 4)}
                                    </td>
                                    <td className="px-3 py-2 text-right">{l.schichten}</td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">{stundenText(l.stundenWerktag)}</td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                        {l.stundenSonntag > 0 ? stundenText(l.stundenSonntag) : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">{l.ohneLohn ? "—" : euroText(l.grundCent)}</td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                        {l.sonntagCent > 0 ? euroText(l.sonntagCent) : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                        {l.bonusCent > 0 ? euroText(l.bonusCent) : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                                        {l.ohneLohn ? "—" : euroText(l.gesamtCent)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="text-xs text-gray-500">
                Brutto laut veröffentlichten Wochenplänen: Sonntag +1,00 € je Stunde, Bonus-Schichten +1,00 € je
                Stunde, mindestens der gesetzliche Mindestlohn am Schichttag. Nur für Admins und Regionalmanager
                sichtbar.
            </p>
        </div>
    );
}
