"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PackageOpen, Send, ShoppingCart } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type {
    EsskaBestellArtikel,
    EsskaBestellung,
    EsskaBestellungPosition,
    EsskaCenter,
    EsskaProfile,
} from "@/lib/esska/types";
import { BESTELL_STATUS_LABELS } from "@/lib/esska/types";
import { useGlobal } from "@/lib/context/GlobalContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type BestellungMitDetails = EsskaBestellung & {
    positionen: (EsskaBestellungPosition & { artikel: EsskaBestellArtikel | null })[];
    center: EsskaCenter | null;
    besteller: Pick<EsskaProfile, "id" | "vorname" | "nachname" | "email"> | null;
};

const STATUS_FARBEN: Record<string, string> = {
    offen: "bg-amber-100 text-amber-800",
    weitergeleitet: "bg-blue-100 text-blue-800",
    erledigt: "bg-green-100 text-green-800",
};

export default function OrdersPage() {
    const { role } = useGlobal();
    const darfWeiterleiten = role === "admin" || role === "regionalmanager";

    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [artikel, setArtikel] = useState<EsskaBestellArtikel[]>([]);
    const [bestellungen, setBestellungen] = useState<BestellungMitDetails[]>([]);
    const [centerId, setCenterId] = useState("");
    // Mengen ohne Farbe: artikelId -> Anzahl; mit Farbe: artikelId::farbe -> Anzahl
    const [mengen, setMengen] = useState<Record<string, string>>({});
    const [notiz, setNotiz] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    const ladeBestellungen = async () => {
        const client = await getEsskaClient();
        const { data } = await client
            .from("bestellungen")
            .select("*, bestellung_positionen(*, bestell_artikel(*)), centers(*), profiles(id, vorname, nachname, email)")
            .order("erstellt_am", { ascending: false })
            .limit(50);
        const rows = (((data as unknown) as Array<
            EsskaBestellung & {
                bestellung_positionen: (EsskaBestellungPosition & { bestell_artikel: EsskaBestellArtikel | null })[];
                centers: EsskaCenter | null;
                profiles: BestellungMitDetails["besteller"];
            }
        >) ?? []).map((b) => ({
            ...b,
            positionen: (b.bestellung_positionen ?? []).map((p) => ({ ...p, artikel: p.bestell_artikel })),
            center: b.centers,
            besteller: b.profiles,
        }));
        setBestellungen(rows);
    };

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const [cRes, aRes] = await Promise.all([
                    client.from("centers").select("*").in("status", ["aktiv", "geplant"]).order("name"),
                    client
                        .from("bestell_artikel")
                        .select("*")
                        .eq("aktiv", true)
                        .order("sortierung"),
                ]);
                if (cRes.error) throw cRes.error;
                if (aRes.error) throw aRes.error;
                const cs = (cRes.data as EsskaCenter[]) ?? [];
                setCenters(cs);
                setArtikel((aRes.data as EsskaBestellArtikel[]) ?? []);
                if (cs[0]) setCenterId(cs[0].id);
                await ladeBestellungen();
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const kategorien = useMemo(() => {
        const map = new Map<string, EsskaBestellArtikel[]>();
        for (const a of artikel) {
            const k = a.kategorie ?? "Sonstiges";
            map.set(k, [...(map.get(k) ?? []), a]);
        }
        return [...map.entries()];
    }, [artikel]);

    const positionenAusEingabe = () => {
        const positionen: { artikel_id: string; farbe: string | null; menge: number }[] = [];
        for (const a of artikel) {
            if (a.farben.length === 0) {
                const wert = parseInt((mengen[a.id] ?? "").trim(), 10);
                if (wert > 0) positionen.push({ artikel_id: a.id, farbe: null, menge: wert });
            } else {
                for (const farbe of a.farben) {
                    const wert = parseInt((mengen[`${a.id}::${farbe}`] ?? "").trim(), 10);
                    if (wert > 0) positionen.push({ artikel_id: a.id, farbe, menge: wert });
                }
            }
        }
        return positionen;
    };

    const bestellen = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setInfo(null);
        const positionen = positionenAusEingabe();
        if (!centerId) {
            setError("Bitte ein Center auswählen.");
            return;
        }
        if (positionen.length === 0) {
            setError("Bitte mindestens einen Artikel mit Anzahl eintragen.");
            return;
        }
        setSaving(true);
        try {
            const client = await getEsskaClient();
            const { data: { user } } = await client.auth.getUser();
            if (!user) throw new Error("Nicht angemeldet");

            const { data: b, error: bErr } = await client
                .from("bestellungen")
                .insert({ center_id: centerId, besteller_id: user.id, notiz: notiz.trim() || null })
                .select("*")
                .single();
            if (bErr) throw bErr;
            const bestellungId = (b as EsskaBestellung).id;

            const { error: pErr } = await client
                .from("bestellung_positionen")
                .insert(positionen.map((p) => ({ ...p, bestellung_id: bestellungId })));
            if (pErr) throw pErr;

            // B-3: Mail an den Regionalmanager des Centers
            let mailHinweis = "";
            try {
                const res = await fetch("/api/orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bestellungId, aktion: "melden" }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                mailHinweis = json.hinweis ?? `Per E-Mail gemeldet an ${json.empfaenger}.`;
            } catch (mailErr) {
                mailHinweis = `Gespeichert, aber die E-Mail-Benachrichtigung schlug fehl: ${
                    mailErr instanceof Error ? mailErr.message : "unbekannter Fehler"
                }`;
            }

            setInfo(`Bestellung gespeichert. ${mailHinweis}`);
            setMengen({});
            setNotiz("");
            await ladeBestellungen();
        } catch (err) {
            setError(friendlyError(err, { aktion: "Bestellung speichern" }));
        } finally {
            setSaving(false);
        }
    };

    const weiterleiten = async (b: BestellungMitDetails) => {
        setBusyId(b.id);
        setError(null);
        setInfo(null);
        try {
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bestellungId: b.id, aktion: "weiterleiten" }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setInfo(`Bestellung an das Lager weitergeleitet (${json.empfaenger}).`);
            await ladeBestellungen();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Weiterleiten fehlgeschlagen.");
        } finally {
            setBusyId(null);
        }
    };

    const mehrereCenter = centers.length > 1;

    return (
        <div className="space-y-6 p-2 md:p-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold">Ware bestellen</h1>
                <p className="text-gray-500 text-sm">
                    Anzahl in Einheiten eintragen (z. B. 2 × 12er-Pack). Die Bestellung geht
                    automatisch per E-Mail an die zuständige Regionalleitung.
                </p>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
            {info && <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{info}</div>}

            <form onSubmit={bestellen} className="space-y-5 bg-white border rounded-lg p-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Center</label>
                    {mehrereCenter ? (
                        <select
                            value={centerId}
                            onChange={(e) => setCenterId(e.target.value)}
                            required
                            className="w-full border rounded-md px-3 py-2 text-sm"
                        >
                            {centers.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.kuerzel}) · {c.stadt}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className="w-full border rounded-md px-3 py-2 text-sm bg-secondary-50">
                            {centers[0]
                                ? `${centers[0].name} (${centers[0].kuerzel}) · ${centers[0].stadt}`
                                : "Keinem Center zugeordnet"}
                        </div>
                    )}
                </div>

                {loading ? (
                    <p className="text-sm text-gray-500">Lädt…</p>
                ) : (
                    kategorien.map(([kategorie, liste]) => (
                        <div key={kategorie} className="border-t pt-4">
                            <h2 className="text-base font-semibold mb-2">{kategorie}</h2>
                            <div className="space-y-3">
                                {liste.map((a) => (
                                    <div key={a.id}>
                                        {a.farben.length === 0 ? (
                                            <div className="flex items-center gap-3">
                                                <input
                                                    value={mengen[a.id] ?? ""}
                                                    onChange={(e) =>
                                                        setMengen((prev) => ({ ...prev, [a.id]: e.target.value }))
                                                    }
                                                    inputMode="numeric"
                                                    placeholder="0"
                                                    className="w-16 border rounded-md px-2 py-1.5 text-sm text-right"
                                                />
                                                <span className="text-sm">
                                                    × {a.einheit_label} <strong>{a.name}</strong>
                                                </span>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-sm mb-1.5">
                                                    <strong>{a.name}</strong>{" "}
                                                    <span className="text-gray-500">(je {a.einheit_label})</span>
                                                </p>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {a.farben.map((farbe) => (
                                                        <div key={farbe} className="flex items-center gap-2">
                                                            <input
                                                                value={mengen[`${a.id}::${farbe}`] ?? ""}
                                                                onChange={(e) =>
                                                                    setMengen((prev) => ({
                                                                        ...prev,
                                                                        [`${a.id}::${farbe}`]: e.target.value,
                                                                    }))
                                                                }
                                                                inputMode="numeric"
                                                                placeholder="0"
                                                                className="w-14 border rounded-md px-2 py-1 text-sm text-right"
                                                            />
                                                            <span className="text-sm">{farbe}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}

                <div>
                    <label className="block text-sm font-medium mb-1">Notiz (optional)</label>
                    <textarea
                        value={notiz}
                        onChange={(e) => setNotiz(e.target.value)}
                        rows={2}
                        placeholder="z. B. dringend, Bestand fast leer"
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                </div>

                {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

                <button
                    type="submit"
                    disabled={saving || loading}
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {saving ? "Wird gesendet…" : "Bestellung absenden"}
                </button>
            </form>

            <Card>
                <CardHeader>
                    <CardTitle>
                        {darfWeiterleiten ? "Bestellungen" : "Meine Bestellungen"}
                    </CardTitle>
                    <CardDescription>
                        {darfWeiterleiten
                            ? "Bestellzeitpunkt und Besteller je Center. Offene Bestellungen können an das Lager weitergeleitet werden."
                            : "Deine bisherigen Bestellungen und ihr Status."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {bestellungen.length === 0 ? (
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                            <PackageOpen className="h-4 w-4" />
                            Noch keine Bestellungen.
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {bestellungen.map((b) => (
                                <li key={b.id} className="border rounded-md p-3 text-sm">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div>
                                            <strong>
                                                {b.center ? `${b.center.name} (${b.center.kuerzel})` : "?"}
                                            </strong>{" "}
                                            <span className="text-gray-500">
                                                · {new Date(b.erstellt_am).toLocaleString("de-DE")}
                                                {b.besteller && (
                                                    <>
                                                        {" · "}
                                                        {`${b.besteller.vorname ?? ""} ${b.besteller.nachname ?? ""}`.trim() ||
                                                            b.besteller.email}
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-xs ${STATUS_FARBEN[b.status] ?? "bg-gray-100 text-gray-800"}`}
                                            >
                                                {BESTELL_STATUS_LABELS[b.status]}
                                                {b.weitergeleitet_am &&
                                                    ` am ${new Date(b.weitergeleitet_am).toLocaleDateString("de-DE")}`}
                                            </span>
                                            {darfWeiterleiten && b.status === "offen" && (
                                                <button
                                                    onClick={() => weiterleiten(b)}
                                                    disabled={busyId === b.id}
                                                    className="inline-flex items-center px-2.5 py-1 border rounded-md text-xs hover:bg-secondary-100 disabled:opacity-50"
                                                >
                                                    <Send className="h-3 w-3 mr-1" />
                                                    {busyId === b.id ? "Sendet…" : "Ans Lager weiterleiten"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <ul className="mt-2 text-xs text-gray-600 list-disc pl-5">
                                        {b.positionen.map((p) => (
                                            <li key={p.id}>
                                                {p.menge} × {p.artikel?.einheit_label ?? "?"} {p.artikel?.name ?? "?"}
                                                {p.farbe ? ` (${p.farbe})` : ""}
                                            </li>
                                        ))}
                                    </ul>
                                    {b.notiz && <p className="mt-1 text-xs text-gray-500 italic">Notiz: {b.notiz}</p>}
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
