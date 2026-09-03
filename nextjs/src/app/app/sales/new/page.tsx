"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter, EsskaCenterZeitraum, EsskaDailySale } from "@/lib/esska/types";
import { centToEuro, euroToCent, isoDatum, zeitKurz } from "@/lib/esska/types";

// Zeitauswahl in 15-Minuten-Schritten fuer das Arbeits-Zeitfenster (U-9)
const ZEIT_OPTIONEN: string[] = (() => {
    const arr: string[] = [];
    for (let h = 6; h <= 22; h++) {
        for (const m of [0, 15, 30, 45]) {
            if (h === 22 && m > 0) continue;
            arr.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
        }
    }
    return arr;
})();

const FOTO_MAX_BYTES = 20 * 1024 * 1024;
const FOTO_TYPEN = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
const FOTO_ENDUNGEN = ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"];

export default function SalesEntryPage() {
    const router = useRouter();
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [zeitraeume, setZeitraeume] = useState<EsskaCenterZeitraum[]>([]);
    const [centerId, setCenterId] = useState("");
    const [datum, setDatum] = useState(isoDatum(new Date()));
    const [istAdmin, setIstAdmin] = useState(false);
    const [notiz, setNotiz] = useState("");
    // U-9: Zeitfenster der Schicht
    const [zeitVon, setZeitVon] = useState("");
    const [zeitBis, setZeitBis] = useState("");
    // Bargeld (U-3: Einnahmen werden berechnet, nicht eingegeben)
    const [startbestand, setStartbestand] = useState("");
    const [endbestand, setEndbestand] = useState("");
    const [ausgaben, setAusgaben] = useState("");
    const [ausgabenOffen, setAusgabenOffen] = useState(false);
    const [abschoepfung, setAbschoepfung] = useState("");
    const [einnahmenBestaetigt, setEinnahmenBestaetigt] = useState(false);
    // U-7: Foto der Verkaufsliste
    const [foto, setFoto] = useState<File | null>(null);
    // Bestehende Eintraege fuer Center+Datum (mehrere Zeitfenster moeglich!)
    const [tagesEintraege, setTagesEintraege] = useState<EsskaDailySale[]>([]);
    const [modus, setModus] = useState<"neu" | "korrektur">("neu");
    const [korrekturVonId, setKorrekturVonId] = useState<string>("");
    const [korrekturGrund, setKorrekturGrund] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const { data: { user } } = await client.auth.getUser();
                if (!user) throw new Error("Nicht angemeldet");

                const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).single();
                const rolle = (profile as { role?: string } | null)?.role;
                setIstAdmin(rolle === "admin" || rolle === "regionalmanager");

                // RLS liefert jedem seine Center (U-1: bei Mitarbeitern damit
                // automatisch vorausgewaehlt)
                const [cRes, zRes] = await Promise.all([
                    client.from("centers").select("*").in("status", ["aktiv", "geplant"]).order("name"),
                    client.from("center_zeitraeume").select("*"),
                ]);
                if (cRes.error) throw cRes.error;
                const cs = (cRes.data as EsskaCenter[]) ?? [];
                setCenters(cs);
                setZeitraeume((zRes.data as EsskaCenterZeitraum[]) ?? []);
                if (cs[0]) setCenterId(cs[0].id);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            }
        };
        load();
    }, []);

    // Alle Eintraege des Tages laden. Mehrere Eintraege pro Tag sind normal
    // (Vormittags- und Nachmittagsschicht melden getrennt) - eine Korrektur
    // ist nur, was ausdruecklich als Korrektur gespeichert wird.
    useEffect(() => {
        if (!centerId || !datum) {
            setTagesEintraege([]);
            return;
        }
        const pruefe = async () => {
            try {
                const client = await getEsskaClient();
                const { data } = await client
                    .from("daily_sales")
                    .select("*")
                    .eq("center_id", centerId)
                    .eq("datum", datum)
                    .order("erfasst_am", { ascending: true });
                const liste = (data as EsskaDailySale[]) ?? [];
                setTagesEintraege(liste);
                setModus("neu");
                setKorrekturVonId("");
            } catch {
                setTagesEintraege([]);
            }
        };
        pruefe();
    }, [centerId, datum]);

    // UA-4: Liegt das Datum im Miet-/Verlaengerungszeitraum des Centers?
    const imZeitraum = (cid: string, tag: string) => {
        const relevant = zeitraeume.filter(
            (z) => z.center_id === cid && (z.typ === "miete" || z.typ === "verlaengerung")
        );
        if (relevant.length === 0) return true; // keine Daten -> nicht blockieren
        return relevant.some((z) => z.von <= tag && (!z.bis || z.bis >= tag));
    };

    // Durch Korrekturen ersetzte Eintraege ausblenden
    const ersetzteIds = useMemo(
        () => new Set(tagesEintraege.map((e) => e.korrigiert_eintrag_id).filter(Boolean) as string[]),
        [tagesEintraege]
    );
    const aktuelleEintraege = tagesEintraege.filter((e) => !ersetzteIds.has(e.id));

    // U-3: Einnahmen = Endbestand - Startbestand + Ausgaben.
    // (Die Abschoepfung passiert erst NACH dem Zaehlen des Endbestands und
    // veraendert die Rechnung deshalb nicht.)
    const einnahmenCent = useMemo(() => {
        if (!startbestand || !endbestand) return null;
        try {
            const start = euroToCent(startbestand);
            const ende = euroToCent(endbestand);
            const aus = ausgaben ? euroToCent(ausgaben) : 0;
            return ende - start + aus;
        } catch {
            return null;
        }
    }, [startbestand, endbestand, ausgaben]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!centerId || !datum) {
            setError("Center und Datum sind Pflicht.");
            return;
        }
        if (!imZeitraum(centerId, datum)) {
            // Kein harter Block: vor Saisonstart (Tests, Aufbautage) muss
            // das Speichern trotzdem moeglich sein - aber bewusst.
            const trotzdem = window.confirm(
                "Achtung: Dieses Datum liegt außerhalb des Mietzeitraums des Centers " +
                "(z. B. weil die Saison noch nicht begonnen hat). Trotzdem speichern?"
            );
            if (!trotzdem) return;
        }
        if (!zeitVon || !zeitBis) {
            setError("Bitte das Zeitfenster angeben (von wann bis wann du an der Kasse warst).");
            return;
        }
        if (zeitBis <= zeitVon) {
            setError("Das Zeitfenster stimmt nicht: „Bis“ muss nach „Von“ liegen.");
            return;
        }
        if (einnahmenCent === null) {
            setError("Bitte Startbestand und Endbestand eintragen – die Einnahmen berechnen sich daraus.");
            return;
        }
        if (einnahmenCent < 0) {
            setError(
                "Die berechneten Einnahmen wären negativ – das kann nicht stimmen. " +
                "Bitte Startbestand und Endbestand noch einmal prüfen."
            );
            return;
        }
        if (!einnahmenBestaetigt) {
            setError("Bitte die berechneten Einnahmen prüfen und per Haken bestätigen.");
            return;
        }
        if (modus === "korrektur" && !korrekturVonId) {
            setError("Bitte auswählen, welcher Eintrag korrigiert wird.");
            return;
        }
        if (modus === "korrektur" && !korrekturGrund.trim()) {
            setError("Bitte den Grund der Korrektur angeben.");
            return;
        }

        setSaving(true);
        setSuccess(null);

        try {
            const client = await getEsskaClient();
            const { data: { user } } = await client.auth.getUser();
            if (!user) throw new Error("Nicht angemeldet");

            // U-7: Foto der Verkaufsliste zuerst hochladen
            let fotoPath: string | null = null;
            if (foto) {
                const ext = (foto.name.split(".").pop() ?? "jpg").toLowerCase();
                fotoPath = `${centerId}/${datum}/${Date.now()}.${ext}`;
                const { error: upErr } = await client.storage
                    .from("sales-receipts")
                    .upload(fotoPath, foto, { cacheControl: "3600", upsert: false });
                if (upErr) throw upErr;
            }

            // Immer INSERT, nie UPDATE: Eintraege sind unveraenderbar (GoBD).
            const { error: insErr } = await client.from("daily_sales").insert({
                center_id: centerId,
                datum,
                notiz: notiz.trim() || null,
                umsatz_start: zeitVon,
                umsatz_ende: zeitBis,
                startbestand_cent: euroToCent(startbestand),
                einnahmen_cent: einnahmenCent,
                ausgaben_cent: ausgaben ? euroToCent(ausgaben) : null,
                endbestand_cent: euroToCent(endbestand),
                abschoepfung_cent: abschoepfung ? euroToCent(abschoepfung) : null,
                beleg_foto_path: fotoPath,
                korrigiert_eintrag_id: modus === "korrektur" ? korrekturVonId : null,
                korrektur_grund: modus === "korrektur" ? korrekturGrund.trim() : null,
                erfasst_von: user.id,
            });
            if (insErr) throw insErr;

            setSuccess(
                modus === "korrektur"
                    ? "Korrektur gespeichert. Der ursprüngliche Eintrag bleibt zur Nachvollziehbarkeit erhalten."
                    : "Eintrag gespeichert. Er kann nicht mehr verändert werden."
            );
            setNotiz("");
            setZeitVon("");
            setZeitBis("");
            setStartbestand("");
            setEndbestand("");
            setAusgaben("");
            setAusgabenOffen(false);
            setAbschoepfung("");
            setEinnahmenBestaetigt(false);
            setFoto(null);
            setKorrekturGrund("");
            setModus("neu");
            setKorrekturVonId("");
            // Tagesliste aktualisieren
            const { data } = await client
                .from("daily_sales")
                .select("*")
                .eq("center_id", centerId)
                .eq("datum", datum)
                .order("erfasst_am", { ascending: true });
            setTagesEintraege((data as EsskaDailySale[]) ?? []);
        } catch (err) {
            setError(friendlyError(err, { aktion: "Speichern fehlgeschlagen" }));
        } finally {
            setSaving(false);
        }
    };

    const heuteSetzen = () => setDatum(isoDatum(new Date()));
    const mehrereCenter = centers.length > 1;

    return (
        <div className="space-y-6 p-2 md:p-6 max-w-2xl">
            <Link href="/app/sales" className="text-sm text-primary-600 hover:underline">
                ← Zurück zur Übersicht
            </Link>
            <div>
                <h1 className="text-2xl font-bold">Umsatz melden</h1>
                <p className="text-gray-600 text-sm mt-1">
                    Trage den Bargeldbestand deiner Schicht ein. Pro Schicht (Zeitfenster) ein Eintrag.
                </p>
            </div>

            <div className="flex items-start gap-2 p-3 bg-secondary-50 border border-secondary-200 rounded-md text-xs text-gray-700">
                <Lock className="h-4 w-4 mt-0.5 shrink-0 text-secondary-600" />
                <div>
                    Gespeicherte Einträge sind aus steuerlichen Gründen <strong>unveränderbar</strong>.
                    Bitte vor dem Speichern prüfen. Eine Korrektur ist möglich, wird aber als
                    zusätzlicher Eintrag mit Begründung festgehalten.
                    <br />
                    <span className="italic">
                        Saved entries are <strong>final</strong> for tax reasons. Please check before
                        saving. Corrections are possible but recorded as an additional entry with a reason.
                    </span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 bg-white border rounded-lg p-4">
                {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
                {success && <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{success}</div>}

                <div>
                    <label className="block text-sm font-medium mb-1">Center</label>
                    {mehrereCenter || istAdmin ? (
                        <select
                            value={centerId}
                            onChange={(e) => setCenterId(e.target.value)}
                            required
                            className="w-full border rounded-md px-3 py-2 text-sm"
                        >
                            <option value="">– wählen –</option>
                            {centers.map((c) => {
                                const offen = imZeitraum(c.id, datum);
                                return (
                                    <option key={c.id} value={c.id}>
                                        {c.name} ({c.kuerzel}) · {c.saison}
                                        {!offen ? " — außerhalb Mietzeitraum" : ""}
                                    </option>
                                );
                            })}
                        </select>
                    ) : (
                        <div className="w-full border rounded-md px-3 py-2 text-sm bg-secondary-50">
                            {centers[0]
                                ? `${centers[0].name} (${centers[0].kuerzel}) · ${centers[0].saison}`
                                : "Keinem Center zugeordnet"}
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Datum</label>
                    <div className="flex gap-2">
                        <input
                            type="date"
                            value={datum}
                            onChange={(e) => setDatum(e.target.value)}
                            required
                            max={isoDatum(new Date())}
                            className="flex-1 border rounded-md px-3 py-2 text-sm"
                        />
                        <button
                            type="button"
                            onClick={heuteSetzen}
                            className="px-3 py-2 border rounded-md text-sm hover:bg-secondary-100"
                        >
                            Heute
                        </button>
                    </div>
                </div>

                {/* U-9: Zeitfenster */}
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Zeitfenster deiner Schicht <span className="text-red-600">*</span>
                    </label>
                    <p className="text-xs text-gray-500 mb-1.5">
                        Von wann bis wann warst du an der Kasse? Wichtig, wenn an einem Tag mehrere
                        Personen melden – oder eine Person den ganzen Tag übernommen hat.
                        <br />
                        <span className="italic">
                            From when to when were you at the register? Important when several people
                            report on the same day – or one person covered the whole day.
                        </span>
                    </p>
                    <div className="flex items-center gap-2">
                        <select
                            value={zeitVon}
                            onChange={(e) => setZeitVon(e.target.value)}
                            required
                            className="border rounded-md px-3 py-2 text-sm"
                        >
                            <option value="">von…</option>
                            {ZEIT_OPTIONEN.map((z) => (
                                <option key={z} value={z}>{z}</option>
                            ))}
                        </select>
                        <span className="text-sm">–</span>
                        <select
                            value={zeitBis}
                            onChange={(e) => setZeitBis(e.target.value)}
                            required
                            className="border rounded-md px-3 py-2 text-sm"
                        >
                            <option value="">bis…</option>
                            {ZEIT_OPTIONEN.map((z) => (
                                <option key={z} value={z}>{z}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Bereits gemeldete Eintraege des Tages */}
                {aktuelleEintraege.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm space-y-3">
                        <p className="font-medium text-amber-900">
                            Für diesen Tag wurde bereits gemeldet:
                        </p>
                        <ul className="list-disc pl-5 text-amber-900 text-xs space-y-0.5">
                            {aktuelleEintraege.map((e) => (
                                <li key={e.id}>
                                    {e.umsatz_start && e.umsatz_ende
                                        ? `${zeitKurz(e.umsatz_start)}–${zeitKurz(e.umsatz_ende)} Uhr`
                                        : "ohne Zeitfenster"}
                                    {" · Einnahmen "}
                                    {e.einnahmen_cent !== null ? `${centToEuro(e.einnahmen_cent)} €` : "—"}
                                </li>
                            ))}
                        </ul>
                        <div className="space-y-1 text-amber-900">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={modus === "neu"}
                                    onChange={() => setModus("neu")}
                                />
                                Neuer Eintrag für ein <strong>anderes Zeitfenster</strong> (z. B. Nachmittagsschicht)
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={modus === "korrektur"}
                                    onChange={() => setModus("korrektur")}
                                />
                                <strong>Korrektur</strong> eines der Einträge oben (Fehler passiert)
                            </label>
                        </div>
                        {modus === "korrektur" && (
                            <div className="space-y-2">
                                <select
                                    value={korrekturVonId}
                                    onChange={(e) => setKorrekturVonId(e.target.value)}
                                    className="w-full border border-amber-300 rounded-md px-3 py-2 text-sm"
                                >
                                    <option value="">– Welcher Eintrag wird korrigiert? –</option>
                                    {aktuelleEintraege.map((e) => (
                                        <option key={e.id} value={e.id}>
                                            {e.umsatz_start && e.umsatz_ende
                                                ? `${zeitKurz(e.umsatz_start)}–${zeitKurz(e.umsatz_ende)} Uhr`
                                                : "Eintrag ohne Zeitfenster"}
                                            {" · Einnahmen "}
                                            {e.einnahmen_cent !== null ? `${centToEuro(e.einnahmen_cent)} €` : "—"}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    value={korrekturGrund}
                                    onChange={(e) => setKorrekturGrund(e.target.value)}
                                    placeholder="Grund der Korrektur, z. B. Zahlendreher beim Endbestand"
                                    className="w-full border border-amber-300 rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Bargeld - Reihenfolge nach U-3 */}
                <div className="border-t pt-5">
                    <h2 className="text-base font-semibold">Bargeld / Cash</h2>
                    <p className="text-xs text-gray-600 mt-1 mb-4">
                        Hier geht es <strong>ausschließlich um Bargeld</strong>. Kartenzahlungen werden
                        separat erfasst – nicht von dir.
                        <br />
                        <span className="italic">
                            This section is about <strong>cash only</strong>. Card payments are recorded
                            separately – not by you.
                        </span>
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                1. Startbestand (€) <span className="text-red-600">*</span>
                            </label>
                            <p className="text-xs text-gray-500 mb-1.5">
                                Zähle zu Beginn deiner Schicht das gesamte Bargeld in der Kasse und trage es ein.
                                <br />
                                <span className="italic">
                                    Count all cash in the register at the start of your shift and enter it.
                                </span>
                            </p>
                            <input
                                value={startbestand}
                                onChange={(e) => setStartbestand(e.target.value)}
                                inputMode="decimal"
                                required
                                placeholder="z. B. 150,00"
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                2. Endbestand (€) <span className="text-red-600">*</span>
                            </label>
                            <p className="text-xs text-gray-500 mb-1.5">
                                Zähle am Ende deiner Schicht wieder das gesamte Bargeld – bevor etwas
                                entnommen wird. Nichts abziehen.
                                <br />
                                <span className="italic">
                                    Count all cash again at the end of your shift – before anything is
                                    removed. Do not subtract anything.
                                </span>
                            </p>
                            <input
                                value={endbestand}
                                onChange={(e) => setEndbestand(e.target.value)}
                                inputMode="decimal"
                                required
                                placeholder="z. B. 890,40"
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            />
                        </div>

                        {/* U-2: Ausgaben eingeklappt */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setAusgabenOffen((v) => !v)}
                                className="inline-flex items-center text-sm text-primary-600 hover:underline"
                            >
                                {ausgabenOffen ? (
                                    <ChevronUp className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 mr-1" />
                                )}
                                Es wurden Ausgaben aus der Kasse bezahlt (selten)
                            </button>
                            {ausgabenOffen && (
                                <div className="mt-2">
                                    <label className="block text-sm font-medium mb-1">Ausgaben (€)</label>
                                    <p className="text-xs text-gray-500 mb-1.5">
                                        Wurde während der Schicht Bargeld aus der Kasse ausgegeben
                                        (z. B. für Utensilien)? Der Betrag wird bei den Einnahmen berücksichtigt.
                                        <br />
                                        <span className="italic">
                                            Was any cash spent from the register during the shift
                                            (e.g. for supplies)? The amount is factored into the takings.
                                        </span>
                                    </p>
                                    <input
                                        value={ausgaben}
                                        onChange={(e) => setAusgaben(e.target.value)}
                                        inputMode="decimal"
                                        placeholder="z. B. 12,50"
                                        className="w-full border rounded-md px-3 py-2 text-sm"
                                    />
                                </div>
                            )}
                        </div>

                        {/* U-3: berechnete Einnahmen + Bestaetigung */}
                        <div className="p-3 bg-secondary-50 border border-secondary-200 rounded-md">
                            <p className="text-sm font-medium">
                                3. Berechnete Einnahmen:{" "}
                                <span className={einnahmenCent !== null && einnahmenCent < 0 ? "text-red-700" : "text-primary-700"}>
                                    {einnahmenCent !== null ? `${centToEuro(einnahmenCent)} €` : "– bitte oben ausfüllen –"}
                                </span>
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                                Endbestand − Startbestand{ausgaben ? " + Ausgaben" : ""}. Bitte prüfen,
                                ob das zu deinem Verkaufstag passt.
                                <br />
                                <span className="italic">
                                    End balance − start balance{ausgaben ? " + expenses" : ""}. Please check
                                    that this matches your sales day.
                                </span>
                            </p>
                            <label className="flex items-start gap-2 mt-2 cursor-pointer text-sm">
                                <input
                                    type="checkbox"
                                    checked={einnahmenBestaetigt}
                                    onChange={(e) => setEinnahmenBestaetigt(e.target.checked)}
                                    className="mt-0.5"
                                />
                                <span>
                                    Die berechneten Einnahmen stimmen. /{" "}
                                    <span className="italic">The calculated takings are correct.</span>
                                </span>
                            </label>
                        </div>

                        {/* U-4: Abschoepfung verstaendlich */}
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                4. In den Umschlag gelegt / Abschöpfung (€)
                            </label>
                            <p className="text-xs text-gray-500 mb-1.5">
                                Wie viel Bargeld hast du nach dem Zählen aus der Kasse genommen und in den
                                Umschlag gelegt? Falls nichts entnommen wurde, leer lassen.
                                <br />
                                <span className="italic">
                                    How much cash did you take out of the register after counting and put
                                    into the envelope? Leave empty if nothing was removed.
                                </span>
                            </p>
                            <input
                                value={abschoepfung}
                                onChange={(e) => setAbschoepfung(e.target.value)}
                                inputMode="decimal"
                                placeholder="z. B. 500,00"
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* U-7: Foto der Verkaufsliste */}
                <div className="border-t pt-5">
                    <h2 className="text-base font-semibold">Foto der Verkaufsliste / Photo of the sales list</h2>
                    <p className="text-xs text-gray-600 mt-1 mb-3">
                        Fotografiere die ausgefüllte Verkaufsliste gut lesbar ab – das ersetzt das
                        Schicken per WhatsApp. Das Bild bleibt sicher in der App gespeichert.
                        <br />
                        <span className="italic">
                            Take a clearly readable photo of the completed sales list – this replaces
                            sending it via WhatsApp. The picture is stored safely in the app.
                        </span>
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                        <label className="inline-flex items-center justify-center px-3 py-2 rounded-md cursor-pointer text-sm bg-primary-600 text-white hover:bg-primary-700">
                            <Camera className="h-4 w-4 mr-2" />
                            {foto ? "Anderes Foto wählen" : "Foto aufnehmen / auswählen"}
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0] ?? null;
                                    e.target.value = "";
                                    if (!f) return;
                                    if (f.size > FOTO_MAX_BYTES) {
                                        setError(`Das Foto ist zu groß (${(f.size / 1024 / 1024).toFixed(1)} MB, erlaubt sind 20 MB).`);
                                        return;
                                    }
                                    const endung = (f.name.split(".").pop() ?? "").toLowerCase();
                                    const ok = f.type ? FOTO_TYPEN.includes(f.type) : FOTO_ENDUNGEN.includes(endung);
                                    if (!ok) {
                                        setError("Nur Fotos (JPG, PNG, WebP, HEIC) oder PDF erlaubt.");
                                        return;
                                    }
                                    setError(null);
                                    setFoto(f);
                                }}
                            />
                        </label>
                        {foto && (
                            <span className="text-sm text-green-700">
                                ✓ {foto.name} ({(foto.size / 1024 / 1024).toFixed(1)} MB)
                            </span>
                        )}
                    </div>
                </div>

                {/* Notiz */}
                <div>
                    <label className="block text-sm font-medium mb-1">Notiz (optional)</label>
                    <textarea
                        value={notiz}
                        onChange={(e) => setNotiz(e.target.value)}
                        rows={2}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                </div>

                {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
                {success && <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{success}</div>}

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                        {saving ? "Speichern…" : modus === "korrektur" ? "Korrektur speichern" : "Verbindlich speichern"}
                    </button>
                    <button type="button" onClick={() => router.push("/app/sales")} className="px-4 py-2 border rounded-md hover:bg-secondary-100">
                        Abbrechen
                    </button>
                </div>
            </form>
        </div>
    );
}
