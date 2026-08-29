"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter, EsskaDailySale } from "@/lib/esska/types";
import { euroToCent, isoDatum } from "@/lib/esska/types";

export default function SalesEntryPage() {
    const router = useRouter();
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [centerId, setCenterId] = useState("");
    const [datum, setDatum] = useState(isoDatum(new Date()));
    const [istAdmin, setIstAdmin] = useState(false);
    const [notiz, setNotiz] = useState("");
    const [startbestand, setStartbestand] = useState("");
    const [einnahmen, setEinnahmen] = useState("");
    const [ausgaben, setAusgaben] = useState("");
    const [endbestand, setEndbestand] = useState("");
    const [abschoepfung, setAbschoepfung] = useState("");
    const [karteneinnahmen, setKarteneinnahmen] = useState("");
    // Bestehender Eintrag fuer Center+Datum – dann ist es eine Korrektur
    const [bestehend, setBestehend] = useState<EsskaDailySale | null>(null);
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
                const admin = (profile as { role?: string } | null)?.role === "admin";
                setIstAdmin(admin);

                if (admin) {
                    const { data, error: e } = await client
                        .from("centers")
                        .select("*")
                        .in("status", ["aktiv", "geplant"])
                        .order("name");
                    if (e) throw e;
                    const cs = (data as EsskaCenter[]) ?? [];
                    setCenters(cs);
                    if (cs[0]) setCenterId(cs[0].id);
                } else {
                    const { data, error: e } = await client
                        .from("center_assignments")
                        .select("centers(*)")
                        .eq("profile_id", user.id);
                    if (e) throw e;
                    const cs = ((data as unknown) as Array<{ centers: EsskaCenter | null }> ?? [])
                        .flatMap((r) => (r.centers ? [r.centers] : []));
                    setCenters(cs);
                    if (cs[0]) setCenterId(cs[0].id);
                }
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            }
        };
        load();
    }, []);

    // Pruefen, ob fuer Center + Datum bereits ein Eintrag existiert.
    // Falls ja, ist die neue Eingabe eine Korrektur des letzten Eintrags.
    useEffect(() => {
        if (!centerId || !datum) {
            setBestehend(null);
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
                    .order("erfasst_am", { ascending: false })
                    .limit(1);
                const liste = (data as EsskaDailySale[]) ?? [];
                setBestehend(liste[0] ?? null);
            } catch {
                setBestehend(null);
            }
        };
        pruefe();
    }, [centerId, datum]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!centerId || !datum) {
            setError("Center und Datum sind Pflicht.");
            return;
        }
        if (bestehend && !korrekturGrund.trim()) {
            setError("Für diesen Tag existiert bereits ein Eintrag. Bitte den Grund der Korrektur angeben.");
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const client = await getEsskaClient();
            const { data: { user } } = await client.auth.getUser();
            if (!user) throw new Error("Nicht angemeldet");

            // Immer INSERT, nie UPDATE: Eintraege sind unveraenderbar.
            // Eine Korrektur verweist auf den Eintrag, den sie ersetzt.
            const { error: e } = await client.from("daily_sales").insert({
                center_id: centerId,
                datum,
                notiz: notiz.trim() || null,
                startbestand_cent: startbestand ? euroToCent(startbestand) : null,
                einnahmen_cent: einnahmen ? euroToCent(einnahmen) : null,
                ausgaben_cent: ausgaben ? euroToCent(ausgaben) : null,
                endbestand_cent: endbestand ? euroToCent(endbestand) : null,
                abschoepfung_cent: abschoepfung ? euroToCent(abschoepfung) : null,
                karteneinnahmen_cent: karteneinnahmen ? euroToCent(karteneinnahmen) : null,
                korrigiert_eintrag_id: bestehend?.id ?? null,
                korrektur_grund: bestehend ? korrekturGrund.trim() : null,
                erfasst_von: user.id,
            });
            if (e) throw e;

            setSuccess(
                bestehend
                    ? "Korrektur gespeichert. Der ursprüngliche Eintrag bleibt zur Nachvollziehbarkeit erhalten."
                    : "Eintrag gespeichert. Er kann nicht mehr verändert werden."
            );
            setNotiz("");
            setStartbestand("");
            setEinnahmen("");
            setAusgaben("");
            setEndbestand("");
            setAbschoepfung("");
            setKarteneinnahmen("");
            setKorrekturGrund("");
            setBestehend(null);
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
                    Pro Center und Tag ein Eintrag. Trage den Bargeldbestand deiner Schicht ein.
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
                            {centers.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.kuerzel}) · {c.saison}
                                </option>
                            ))}
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

                {/* Hinweis, wenn fuer diesen Tag schon etwas erfasst wurde */}
                {bestehend && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                        <p className="font-medium text-amber-900 mb-1">
                            Für diesen Tag wurde bereits ein Eintrag erfasst.
                        </p>
                        <p className="text-amber-800 text-xs mb-3">
                            Der bestehende Eintrag bleibt unverändert erhalten. Deine Eingabe wird als
                            Korrektur gespeichert und ersetzt ihn in der Übersicht.
                        </p>
                        <label className="block text-xs font-medium text-amber-900 mb-1">
                            Grund der Korrektur <span className="text-red-600">*</span>
                        </label>
                        <input
                            value={korrekturGrund}
                            onChange={(e) => setKorrekturGrund(e.target.value)}
                            placeholder="z. B. Zahlendreher beim Endbestand"
                            className="w-full border border-amber-300 rounded-md px-3 py-2 text-sm"
                        />
                    </div>
                )}

                {/* Bargeld-Kassenbestand */}
                <div className="border-t pt-5">
                    <h2 className="text-base font-semibold">Bargeld / Cash</h2>
                    <p className="text-xs text-gray-600 mt-1 mb-4">
                        Hier geht es <strong>ausschließlich um Bargeld</strong>. Kartenzahlungen werden
                        weiter unten in einem eigenen Feld eingetragen.
                        <br />
                        <span className="italic">
                            This section is about <strong>cash only</strong>. Card payments are entered
                            in their own field further down.
                        </span>
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Startbestand (€)</label>
                            <p className="text-xs text-gray-500 mb-1.5">
                                Wie viel Bargeld befindet sich zu Beginn deiner Schicht in der Kasse?
                                <br />
                                <span className="italic">
                                    How much cash is in the register at the start of your shift?
                                </span>
                            </p>
                            <input
                                value={startbestand}
                                onChange={(e) => setStartbestand(e.target.value)}
                                inputMode="decimal"
                                placeholder="z. B. 150,00"
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Einnahmen (€)</label>
                            <p className="text-xs text-gray-500 mb-1.5">
                                Wie viel Bargeld ist während deiner Schicht durch Verkäufe eingenommen worden?
                                <br />
                                <span className="italic">
                                    How much cash was taken in through sales during your shift?
                                </span>
                            </p>
                            <input
                                value={einnahmen}
                                onChange={(e) => setEinnahmen(e.target.value)}
                                inputMode="decimal"
                                placeholder="z. B. 750,00"
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Eventuelle Ausgaben (€)</label>
                            <p className="text-xs text-gray-500 mb-1.5">
                                Wurde während der Schicht Bargeld aus der Kasse ausgegeben (z. B. für
                                Utensilien)? Sonst leer lassen.
                                <br />
                                <span className="italic">
                                    Was any cash taken from the register during the shift (e.g. for
                                    supplies)? Otherwise leave empty.
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

                        <div>
                            <label className="block text-sm font-medium mb-1">Endbestand (€)</label>
                            <p className="text-xs text-gray-500 mb-1.5">
                                Wie viel Bargeld ist am Ende deiner Schicht insgesamt in der Kasse?
                                Einfach den gesamten Bargeldbetrag zählen – nichts abziehen.
                                <br />
                                <span className="italic">
                                    How much cash is in the register in total at the end of your shift?
                                    Just count the full cash amount – do not subtract anything.
                                </span>
                            </p>
                            <input
                                value={endbestand}
                                onChange={(e) => setEndbestand(e.target.value)}
                                inputMode="decimal"
                                placeholder="z. B. 890,40"
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Abschöpfung (€)</label>
                            <p className="text-xs text-gray-500 mb-1.5">
                                Wurde Bargeld aus der Kasse entnommen und abgeführt? Sonst leer lassen.
                                <br />
                                <span className="italic">
                                    Was cash removed from the register and handed over? Otherwise leave empty.
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

                {/* Kartenzahlungen */}
                <div className="border-t pt-5">
                    <h2 className="text-base font-semibold">Kartenzahlungen / Card payments</h2>
                    <div className="mt-4">
                        <label className="block text-sm font-medium mb-1">Karteneinnahmen (€)</label>
                        <p className="text-xs text-gray-500 mb-1.5">
                            Mache am Ende der Schicht den Tagesabschluss am Kartenterminal und trage
                            die dort angezeigte Gesamtsumme der Kartenzahlungen ein.
                            <br />
                            <span className="italic">
                                Run the daily closing on the card terminal at the end of your shift and
                                enter the total card payment amount shown there.
                            </span>
                        </p>
                        <input
                            value={karteneinnahmen}
                            onChange={(e) => setKarteneinnahmen(e.target.value)}
                            inputMode="decimal"
                            placeholder="z. B. 420,00"
                            className="w-full border rounded-md px-3 py-2 text-sm"
                        />
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

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                        {saving ? "Speichern…" : bestehend ? "Korrektur speichern" : "Verbindlich speichern"}
                    </button>
                    <button type="button" onClick={() => router.push("/app/sales")} className="px-4 py-2 border rounded-md hover:bg-secondary-100">
                        Abbrechen
                    </button>
                </div>
            </form>
        </div>
    );
}
