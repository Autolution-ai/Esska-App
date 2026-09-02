"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCardRevenue, EsskaCenter, EsskaCenterZeitraum } from "@/lib/esska/types";
import { centToEuro, euroToCent, isoDatum, parseIsoDatum } from "@/lib/esska/types";
import { useGlobal } from "@/lib/context/GlobalContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

// UA-2: Karteneinnahmen erfasst der Admin selbst - Center waehlen,
// darunter die Tage des Monats untereinander zur Eingabe (U-5: die
// Mitarbeiter tragen Kartenumsaetze nicht mehr ein).
export default function CardRevenuesPage() {
    const router = useRouter();
    const { role, loading: globalLoading } = useGlobal();

    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [zeitraeume, setZeitraeume] = useState<EsskaCenterZeitraum[]>([]);
    const [centerId, setCenterId] = useState("");
    const [monat, setMonat] = useState<string>(isoDatum(new Date()).slice(0, 7)); // YYYY-MM
    const [werte, setWerte] = useState<Record<string, string>>({}); // datum -> Euro-String
    const [gespeichert, setGespeichert] = useState<Record<string, EsskaCardRevenue>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    // Karteneinnahmen darf nur der Admin erfassen (Manager sehen sie in
    // der Umsatz-Uebersicht ihrer Center)
    useEffect(() => {
        if (!globalLoading && role !== null && role !== "admin") {
            router.replace("/app/sales");
        }
    }, [globalLoading, role, router]);

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const [cRes, zRes] = await Promise.all([
                    client.from("centers").select("*").in("status", ["aktiv", "geplant", "abgeschlossen"]).order("name"),
                    client.from("center_zeitraeume").select("*"),
                ]);
                if (cRes.error) throw cRes.error;
                const cs = (cRes.data as EsskaCenter[]) ?? [];
                setCenters(cs);
                setZeitraeume((zRes.data as EsskaCenterZeitraum[]) ?? []);
                if (cs[0]) setCenterId(cs[0].id);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Tage des gewaehlten Monats (nur Vergangenheit/heute, nur Betriebstage)
    const tage = useMemo(() => {
        if (!centerId || !monat) return [] as string[];
        const [jahr, mon] = monat.split("-").map((x) => parseInt(x, 10));
        const anzahl = new Date(jahr, mon, 0).getDate();
        const heute = isoDatum(new Date());
        const relevant = zeitraeume.filter(
            (z) => z.center_id === centerId && (z.typ === "miete" || z.typ === "verlaengerung")
        );
        const imZeitraum = (tag: string) =>
            relevant.length === 0 || relevant.some((z) => z.von <= tag && (!z.bis || z.bis >= tag));
        const liste: string[] = [];
        for (let t = 1; t <= anzahl; t++) {
            const tag = `${jahr}-${mon.toString().padStart(2, "0")}-${t.toString().padStart(2, "0")}`;
            if (tag > heute) continue;
            if (!imZeitraum(tag)) continue;
            liste.push(tag);
        }
        return liste;
    }, [centerId, monat, zeitraeume]);

    // Gespeicherte Werte fuer Center+Monat laden
    useEffect(() => {
        if (!centerId || !monat) return;
        const load = async () => {
            setInfo(null);
            try {
                const client = await getEsskaClient();
                const von = `${monat}-01`;
                const [jahr, mon] = monat.split("-").map((x) => parseInt(x, 10));
                const bis = `${monat}-${new Date(jahr, mon, 0).getDate().toString().padStart(2, "0")}`;
                const { data, error: e } = await client
                    .from("card_revenues")
                    .select("*")
                    .eq("center_id", centerId)
                    .gte("datum", von)
                    .lte("datum", bis);
                if (e) throw e;
                const map: Record<string, EsskaCardRevenue> = {};
                const w: Record<string, string> = {};
                for (const r of (data as EsskaCardRevenue[]) ?? []) {
                    map[r.datum] = r;
                    w[r.datum] = centToEuro(r.betrag_cent);
                }
                setGespeichert(map);
                setWerte(w);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Karteneinnahmen laden" }));
            }
        };
        load();
    }, [centerId, monat]);

    const speichern = async () => {
        setSaving(true);
        setError(null);
        setInfo(null);
        try {
            const client = await getEsskaClient();
            const { data: { user } } = await client.auth.getUser();
            let anzahl = 0;
            for (const tag of tage) {
                const eingabe = (werte[tag] ?? "").trim();
                const vorhanden = gespeichert[tag];
                if (!eingabe) {
                    // Leeres Feld: vorhandenen Eintrag loeschen (Fehleingabe entfernen)
                    if (vorhanden) {
                        const { error: e } = await client.from("card_revenues").delete().eq("id", vorhanden.id);
                        if (e) throw e;
                        anzahl++;
                    }
                    continue;
                }
                const cent = euroToCent(eingabe);
                if (vorhanden && vorhanden.betrag_cent === cent) continue; // unveraendert
                const { error: e } = await client.from("card_revenues").upsert(
                    {
                        center_id: centerId,
                        datum: tag,
                        betrag_cent: cent,
                        erfasst_von: user?.id ?? null,
                    },
                    { onConflict: "center_id,datum" }
                );
                if (e) throw e;
                anzahl++;
            }
            setInfo(anzahl === 0 ? "Keine Änderungen." : `${anzahl} Tag${anzahl === 1 ? "" : "e"} gespeichert.`);
            // neu laden
            const von = `${monat}-01`;
            const [jahr, mon] = monat.split("-").map((x) => parseInt(x, 10));
            const bis = `${monat}-${new Date(jahr, mon, 0).getDate().toString().padStart(2, "0")}`;
            const { data } = await client
                .from("card_revenues")
                .select("*")
                .eq("center_id", centerId)
                .gte("datum", von)
                .lte("datum", bis);
            const map: Record<string, EsskaCardRevenue> = {};
            for (const r of (data as EsskaCardRevenue[]) ?? []) map[r.datum] = r;
            setGespeichert(map);
        } catch (err) {
            setError(friendlyError(err, { aktion: "Speichern" }));
        } finally {
            setSaving(false);
        }
    };

    if (!globalLoading && role !== null && role !== "admin") return null;

    const summe = tage.reduce((sum, tag) => {
        const w = (werte[tag] ?? "").trim();
        if (!w) return sum;
        try { return sum + euroToCent(w); } catch { return sum; }
    }, 0);

    return (
        <div className="space-y-6 p-2 md:p-6 max-w-2xl">
            <Link href="/app/sales" className="text-sm text-primary-600 hover:underline">
                ← Zurück zur Umsatz-Übersicht
            </Link>
            <div>
                <h1 className="text-2xl font-bold">Karteneinnahmen erfassen</h1>
                <p className="text-gray-500 text-sm">
                    Ein Betrag je Center und Tag – aus der Abrechnung des Kartenterminal-Anbieters.
                    Werte sind änderbar, bis sie an den Steuerberater gehen.
                </p>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
            {info && <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{info}</div>}

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
                    <label className="block text-xs text-gray-500 mb-1">Monat</label>
                    <input
                        type="month"
                        value={monat}
                        onChange={(e) => setMonat(e.target.value)}
                        max={isoDatum(new Date()).slice(0, 7)}
                        className="border rounded-md px-3 py-2 text-sm"
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Tage im {monat ? parseIsoDatum(`${monat}-01`).toLocaleDateString("de-DE", { month: "long", year: "numeric" }) : "Monat"}</CardTitle>
                    <CardDescription>
                        {loading
                            ? "Lädt…"
                            : tage.length === 0
                                ? "Keine Betriebstage in diesem Monat (außerhalb des Mietzeitraums)."
                                : `${tage.length} Betriebstage · Summe bisher: ${centToEuro(summe)} €`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {tage.length > 0 && (
                        <>
                            <div className="space-y-1.5">
                                {tage.map((tag) => (
                                    <div key={tag} className="flex items-center gap-3">
                                        <span className="w-36 text-sm">
                                            {parseIsoDatum(tag).toLocaleDateString("de-DE", {
                                                weekday: "short",
                                                day: "2-digit",
                                                month: "2-digit",
                                            })}
                                        </span>
                                        <input
                                            value={werte[tag] ?? ""}
                                            onChange={(e) =>
                                                setWerte((prev) => ({ ...prev, [tag]: e.target.value }))
                                            }
                                            inputMode="decimal"
                                            placeholder="0,00"
                                            className="w-32 border rounded-md px-3 py-1.5 text-sm text-right"
                                        />
                                        <span className="text-xs text-gray-400">€</span>
                                        {gespeichert[tag] && (
                                            <span className="text-xs text-green-700">✓ gespeichert</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={speichern}
                                    disabled={saving}
                                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    {saving ? "Speichern…" : "Alle Änderungen speichern"}
                                </button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
