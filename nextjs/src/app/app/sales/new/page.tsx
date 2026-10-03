"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Lock } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter, EsskaCenterZeitraum, EsskaDailySale } from "@/lib/esska/types";
import { centToEuro, euroToCent, isoDatum, parseEuro, parseIsoDatum, zeitKurz } from "@/lib/esska/types";

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
    // Startbestand wird uebernommen, nicht eingetippt (Oktober 2026):
    // Endbestand der letzten Meldung minus Tresor. Der Server setzt denselben
    // Wert beim Speichern noch einmal fest - was hier steht, ist nur Anzeige.
    const [startbestand, setStartbestand] = useState("");
    const [startQuelle, setStartQuelle] = useState<
        { status: "warten" | "laden" | "fehlt" | "fehler" } | { status: "ok"; text: string }
    >({ status: "warten" });
    const [endbestand, setEndbestand] = useState("");
    const [ausgaben, setAusgaben] = useState("");
    const [einlagen, setEinlagen] = useState("");
    const [ausgabenOffen, setAusgabenOffen] = useState(false);
    const [abschoepfung, setAbschoepfung] = useState("");
    const [einnahmenBestaetigt, setEinnahmenBestaetigt] = useState(false);
    // Bestehende Eintraege fuer Center+Datum (mehrere Zeitfenster moeglich!)
    const [tagesEintraege, setTagesEintraege] = useState<EsskaDailySale[]>([]);
    const [modus, setModus] = useState<"neu" | "korrektur">("neu");
    const [korrekturVonId, setKorrekturVonId] = useState<string>("");
    const [korrekturGrund, setKorrekturGrund] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    // Welches Feld fehlt? Fuer rote Markierung am Feld selbst.
    const [fehlerFeld, setFehlerFeld] = useState<string | null>(null);
    const fehlerRef = useRef<HTMLDivElement | null>(null);

    // Fehler anzeigen UND sichtbar machen - auf dem Handy steht man beim
    // Klick ganz unten und wuerde eine Meldung sonst nicht sehen.
    const zeigeFehler = (text: string, feld?: string) => {
        setError(text);
        setFehlerFeld(feld ?? null);
        setTimeout(() => fehlerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    };

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

    // Startbestand ermitteln. Haengt am Zeitfenster, weil bei zwei Schichten
    // am Tag die spaetere von der frueheren uebernimmt. Nach dem Speichern
    // aendert sich tagesEintraege - dann wird fuer die naechste Meldung neu
    // gerechnet.
    useEffect(() => {
        const korrekturZiel =
            modus === "korrektur" ? tagesEintraege.find((e) => e.id === korrekturVonId) : undefined;
        if (modus === "korrektur" && !korrekturZiel) {
            setStartbestand("");
            setStartQuelle({ status: "warten" });
            return;
        }
        // Eine Korrektur betrifft dieselbe Schicht: gleicher Startbestand.
        if (korrekturZiel && korrekturZiel.startbestand_cent !== null) {
            setStartbestand(centToEuro(korrekturZiel.startbestand_cent));
            setStartQuelle({ status: "ok", text: "wie in der Meldung, die korrigiert wird" });
            return;
        }
        if (!centerId || !datum || !zeitVon) {
            setStartbestand("");
            setStartQuelle({ status: "warten" });
            return;
        }
        let abgebrochen = false;
        setStartQuelle({ status: "laden" });
        (async () => {
            try {
                const client = await getEsskaClient();
                const { data, error: rpcErr } = await client.rpc("kasse_vorgaenger", {
                    cid: centerId,
                    d: datum,
                    von: zeitVon,
                    ausser: korrekturZiel?.id ?? null,
                });
                if (abgebrochen) return;
                if (rpcErr) throw rpcErr;
                const zeile = (data as Array<{
                    betrag_cent: number;
                    quelle: string;
                    vom_datum: string | null;
                    vom_zeit: string | null;
                }> | null)?.[0];
                if (!zeile) {
                    setStartbestand("");
                    setStartQuelle({ status: "fehlt" });
                    return;
                }
                setStartbestand(centToEuro(zeile.betrag_cent));
                setStartQuelle({
                    status: "ok",
                    text:
                        zeile.quelle === "anfangsbestand" || !zeile.vom_datum
                            ? "Anfangsbestand des Centers"
                            : `aus der Meldung vom ${parseIsoDatum(zeile.vom_datum).toLocaleDateString("de-DE")}` +
                              (zeile.vom_zeit ? `, ${zeitKurz(zeile.vom_zeit)} Uhr` : ""),
                });
            } catch {
                if (!abgebrochen) {
                    setStartbestand("");
                    setStartQuelle({ status: "fehler" });
                }
            }
        })();
        return () => {
            abgebrochen = true;
        };
    }, [centerId, datum, zeitVon, modus, korrekturVonId, tagesEintraege]);

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

    // U-3: Kassenbericht-Rechnung der offenen Ladenkasse:
    //   Einnahmen = Endbestand - Startbestand + Ausgaben - Einlagen
    // Ausgaben mindern den Endbestand, ohne den Umsatz zu mindern -> addieren.
    // Einlagen (z. B. Wechselgeld aus dem Tresor) erhoehen den Endbestand,
    // ohne Umsatz zu sein -> abziehen.
    // Das Geld fuer den Tresor wird erst NACH dem Zaehlen entnommen und
    // veraendert die Rechnung deshalb nicht.
    const einnahmenCent = useMemo(() => {
        if (!startbestand || !endbestand) return null;
        try {
            const start = euroToCent(startbestand);
            const ende = euroToCent(endbestand);
            const aus = ausgaben ? euroToCent(ausgaben) : 0;
            const ein = einlagen ? euroToCent(einlagen) : 0;
            return ende - start + aus - ein;
        } catch {
            return null;
        }
    }, [startbestand, endbestand, ausgaben, einlagen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFehlerFeld(null);
        if (!centerId || !datum) {
            zeigeFehler("Bitte Center und Datum ausfüllen.", "center");
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
            zeigeFehler(
                "Bitte das Zeitfenster angeben: von wann bis wann warst du an der Kasse? (Feld weiter oben)",
                "zeit"
            );
            return;
        }
        if (zeitBis <= zeitVon) {
            zeigeFehler("Das Zeitfenster stimmt nicht: die „bis“-Zeit muss nach der „von“-Zeit liegen.", "zeit");
            return;
        }
        // Jeden eingegebenen Betrag einzeln pruefen, damit der Fehler das
        // konkrete Feld benennt (statt spaeter beim Speichern zu scheitern).
        if (startQuelle.status === "fehlt") {
            zeigeFehler(
                "Für dieses Center ist noch kein Anfangsbestand hinterlegt. Bitte wende dich an die Verwaltung.",
                "bestand"
            );
            return;
        }
        if (startQuelle.status !== "ok") {
            zeigeFehler(
                startQuelle.status === "fehler"
                    ? "Der Startbestand konnte nicht geladen werden. Bitte Seite neu laden und noch einmal versuchen."
                    : "Der Startbestand wird noch ermittelt – bitte einen Moment warten.",
                "bestand"
            );
            return;
        }
        const betragsFelder: Array<[string, string, string]> = [
            ["Endbestand", endbestand, "bestand"],
            ["Ausgaben", ausgaben, "bestand"],
            ["Einlagen", einlagen, "bestand"],
            ["In den Tresor gelegt", abschoepfung, "bestand"],
        ];
        for (const [label, wert, feld] of betragsFelder) {
            if (wert.trim() && parseEuro(wert) === null) {
                zeigeFehler(`„${wert}" ist bei „${label}" kein gültiger Betrag. Bitte nur Zahlen eingeben, z. B. 890,40`, feld);
                return;
            }
        }
        if (einnahmenCent === null) {
            zeigeFehler("Bitte den Endbestand eintragen – die Einnahmen berechnen sich daraus.", "bestand");
            return;
        }
        if (einnahmenCent < 0) {
            zeigeFehler(
                "Die berechneten Einnahmen wären negativ – das kann nicht stimmen. " +
                "Bitte Endbestand, Ausgaben und Einlagen noch einmal prüfen.",
                "bestand"
            );
            return;
        }
        if (!einnahmenBestaetigt) {
            zeigeFehler(
                "Bitte den Haken bei den berechneten Einnahmen setzen („Die berechneten Einnahmen stimmen“).",
                "bestaetigung"
            );
            return;
        }
        if (modus === "korrektur" && !korrekturVonId) {
            zeigeFehler("Bitte auswählen, welcher Eintrag korrigiert wird.", "korrektur");
            return;
        }
        if (modus === "korrektur" && !korrekturGrund.trim()) {
            zeigeFehler("Bitte den Grund der Korrektur angeben.", "korrektur");
            return;
        }

        setSaving(true);
        setSuccess(null);

        try {
            const client = await getEsskaClient();
            const { data: { user } } = await client.auth.getUser();
            if (!user) throw new Error("Nicht angemeldet");

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
                einlagen_cent: einlagen ? euroToCent(einlagen) : null,
                endbestand_cent: euroToCent(endbestand),
                abschoepfung_cent: abschoepfung ? euroToCent(abschoepfung) : null,
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
            setEinlagen("");
            setAusgabenOffen(false);
            setAbschoepfung("");
            setEinnahmenBestaetigt(false);
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
            zeigeFehler(friendlyError(err, { aktion: "Speichern fehlgeschlagen" }));
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
                            className={`w-full border rounded-md px-3 py-2 text-sm ${fehlerFeld === "center" ? "border-red-500 bg-red-50" : ""}`}
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
                            className={`border rounded-md px-3 py-2 text-sm ${fehlerFeld === "zeit" ? "border-red-500 bg-red-50" : ""}`}
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
                            className={`border rounded-md px-3 py-2 text-sm ${fehlerFeld === "zeit" ? "border-red-500 bg-red-50" : ""}`}
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
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={modus === "neu"}
                                    onChange={() => setModus("neu")}
                                    className="mt-0.5 flex-shrink-0"
                                />
                                {/* Text in EINEM Element: sonst macht flex aus jedem
                                    Textstueck eine eigene Spalte (auf dem Handy zerrissen). */}
                                <span>
                                    Neuer Eintrag für ein <strong>anderes Zeitfenster</strong> (z. B. Nachmittagsschicht)
                                </span>
                            </label>
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={modus === "korrektur"}
                                    onChange={() => setModus("korrektur")}
                                    className="mt-0.5 flex-shrink-0"
                                />
                                <span>
                                    <strong>Korrektur</strong> eines der Einträge oben (Fehler passiert)
                                </span>
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
                                1. Startbestand (€)
                            </label>
                            <p className="text-xs text-gray-500 mb-1.5">
                                Wird automatisch übernommen: Endbestand der letzten Meldung minus das, was in
                                den Tresor gelegt wurde. Kann nicht geändert werden.
                                <br />
                                <span className="italic">
                                    Taken over automatically: closing balance of the last report minus what went
                                    into the safe. Cannot be changed.
                                </span>
                            </p>
                            {startQuelle.status === "fehlt" ? (
                                <div className="w-full border border-red-300 bg-red-50 rounded-md px-3 py-2 text-sm text-red-800">
                                    Für dieses Center ist noch kein Anfangsbestand hinterlegt. Bitte wende dich an
                                    die Verwaltung.
                                    <br />
                                    <span className="italic text-xs">
                                        No opening balance has been set for this center yet. Please contact the office.
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 w-full border rounded-md px-3 py-2 text-sm bg-gray-50">
                                    <Lock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    {startQuelle.status === "ok" ? (
                                        <span>
                                            <span className="font-medium tabular-nums">{startbestand} €</span>
                                            <span className="text-xs text-gray-500"> · {startQuelle.text}</span>
                                        </span>
                                    ) : (
                                        <span className="text-gray-500">
                                            {startQuelle.status === "laden"
                                                ? "wird ermittelt …"
                                                : startQuelle.status === "fehler"
                                                  ? "konnte nicht geladen werden – bitte Seite neu laden"
                                                  : modus === "korrektur"
                                                    ? "erscheint, sobald der zu korrigierende Eintrag gewählt ist"
                                                    : "erscheint, sobald Center, Datum und Zeitfenster angegeben sind"}
                                        </span>
                                    )}
                                </div>
                            )}
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
                                placeholder="z. B. 890,40"
                                className={`w-full border rounded-md px-3 py-2 text-sm ${fehlerFeld === "bestand" ? "border-red-500 bg-red-50" : ""}`}
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
                                Geld aus der Kasse bezahlt oder Wechselgeld dazugelegt? (selten)
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

                                    <label className="block text-sm font-medium mb-1 mt-4">Einlagen (€)</label>
                                    <p className="text-xs text-gray-500 mb-1.5">
                                        Wurde während der Schicht Geld in die Kasse <strong>gelegt</strong>
                                        (z. B. Wechselgeld aus dem Tresor)? Das ist kein Umsatz und wird
                                        bei den Einnahmen wieder abgezogen.
                                        <br />
                                        <span className="italic">
                                            Was money <strong>added</strong> to the register during the shift
                                            (e.g. change from the safe)? This is not revenue and is deducted
                                            from the takings.
                                        </span>
                                    </p>
                                    <input
                                        value={einlagen}
                                        onChange={(e) => setEinlagen(e.target.value)}
                                        inputMode="decimal"
                                        placeholder="z. B. 100,00"
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
                                Endbestand − Startbestand{ausgaben ? " + Ausgaben" : ""}
                                {einlagen ? " − Einlagen" : ""}. Bitte prüfen, ob das zu deinem
                                Verkaufstag passt.
                                <br />
                                <span className="italic">
                                    End balance − start balance{ausgaben ? " + expenses" : ""}
                                    {einlagen ? " − cash added" : ""}. Please check that this matches
                                    your sales day.
                                </span>
                            </p>
                            <label className={`flex items-start gap-2 mt-2 cursor-pointer text-sm rounded p-1 ${fehlerFeld === "bestaetigung" ? "bg-red-50 ring-1 ring-red-400" : ""}`}>
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
                                4. In den Tresor gelegt (€)
                                <span className="font-normal text-gray-500"> – früher &bdquo;Abschöpfung&ldquo;</span>
                            </label>
                            <p className="text-xs text-gray-500 mb-1.5">
                                Wie viel Bargeld hast du nach dem Zählen aus der Kasse genommen und in den
                                Tresor gelegt? Falls nichts entnommen wurde, leer lassen.
                                <br />
                                <span className="italic">
                                    How much cash did you take out of the register after counting and put
                                    into the safe? Leave empty if nothing was removed.
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

                <div ref={fehlerRef}>
                    {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
                    {success && <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{success}</div>}
                </div>

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
