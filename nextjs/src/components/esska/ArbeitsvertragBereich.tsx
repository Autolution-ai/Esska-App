"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, FileText, PenLine } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaArbeitsvertrag, EsskaArbeitszeitModell } from "@/lib/esska/types";
import { ARBEITSZEIT_MODELL_LABELS, BEFRISTETE_ARTEN, VERTRAGS_ARTEN } from "@/lib/esska/types";
import { ladeAktuellenVertrag, unterschreibbar } from "@/lib/esska/vertragstatus";
import ArbeitsvertragBox from "@/components/esska/ArbeitsvertragBox";
import Unterschriftsfeld from "@/components/esska/Unterschriftsfeld";
import VertragKonditionen, {
    type Konditionen,
    LEERE_KONDITIONEN,
    konditionenPruefen,
} from "@/components/esska/VertragKonditionen";

type Person = {
    vorname: string | null;
    nachname: string | null;
    anschrift_strasse: string | null;
    anschrift_plz: string | null;
    anschrift_ort: string | null;
    geburtsdatum: string | null;
};
type Center = { name: string; stadt: string };
type CenterOption = Center & { id: string };

type Zustand =
    | { art: "laden" }
    | { art: "einfach"; vertrag: EsskaArbeitsvertrag | null } // kein (ausfuellbarer) Vertrag
    | { art: "vertrag"; vertrag: EsskaArbeitsvertrag; person: Person | null; center: Center | null };

type Props = {
    profileId: string;
    modell: EsskaArbeitszeitModell | null;
    /** selbst: die Person unterschreibt · lesen: nur ansehen ·
     *  verwalten: Admin/Regionalmanager pflegt die Konditionen */
    modus: "selbst" | "lesen" | "verwalten";
    /** Admin darf beim Minijob mehr als MINIJOB_MAX_STUNDEN eintragen */
    istAdmin?: boolean;
    onStatus?: (erledigt: boolean) => void;
};

const datum = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE") : "—");
const euro = (cent: number | null) =>
    cent === null ? "—" : `${(cent / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
const zahl = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

function heuteIso(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

function minderjaehrig(geburtsdatum: string | null): boolean {
    if (!geburtsdatum) return false;
    const [gy, gm, gd] = geburtsdatum.split("-").map(Number);
    const [sy, sm, sd] = heuteIso().split("-").map(Number);
    let alter = sy - gy;
    if (sm < gm || (sm === gm && sd < gd)) alter--;
    return alter < 18;
}

function konditionenAus(v: EsskaArbeitsvertrag | null, modell: EsskaArbeitszeitModell | null): Konditionen {
    if (!v || v.unterschrieben_am) {
        const vorschlag = v?.art ?? modell;
        return { ...LEERE_KONDITIONEN, art: vorschlag && VERTRAGS_ARTEN.includes(vorschlag) ? vorschlag : LEERE_KONDITIONEN.art };
    }
    return {
        art: v.art,
        beginn: v.beginn,
        befristet_bis: v.befristet_bis ?? "",
        stunden: zahl(v.stunden_pro_woche),
        stundenlohn: v.stundenlohn_cent === null ? "" : zahl(v.stundenlohn_cent / 100),
    };
}

/** Arbeitsvertrag: mit hinterlegter, einmessener Vorlage wird er mit den
 *  Konditionen und Stammdaten ausgefuellt und mit dem Finger unterschrieben.
 *  Ohne das laeuft der einfache Weg (Vorlage ansehen + Haken). */
export default function ArbeitsvertragBereich({ profileId, modell, modus, istAdmin = false, onStatus }: Props) {
    const [zustand, setZustand] = useState<Zustand>({ art: "laden" });
    // Den eigenen Vertrag weist immer ein Admin zu (nicht man selbst)
    const [eigeneId, setEigeneId] = useState<string | null>(null);
    const [fehler, setFehler] = useState<string | null>(null);
    const [erfolg, setErfolg] = useState<string | null>(null);

    // Unterschreiben
    const [geprueft, setGeprueft] = useState(false);
    const [unterschrift, setUnterschrift] = useState<string | null>(null);
    const [vertreter, setVertreter] = useState<string | null>(null);
    const [sendet, setSendet] = useState(false);

    // Konditionen pflegen
    const [bearbeiten, setBearbeiten] = useState(false);
    const [konditionen, setKonditionen] = useState<Konditionen>(LEERE_KONDITIONEN);
    const [centerId, setCenterId] = useState("");
    const [centerOptionen, setCenterOptionen] = useState<CenterOption[]>([]);
    const [speichert, setSpeichert] = useState(false);

    const laden = useCallback(async () => {
        setFehler(null);
        try {
            const client = await getEsskaClient();
            const { data: { user } } = await client.auth.getUser();
            setEigeneId(user?.id ?? null);
            const vertrag = await ladeAktuellenVertrag(client, profileId);
            setKonditionen(konditionenAus(vertrag, modell));
            if (modus === "verwalten") {
                // Center, die als Arbeitsort in Frage kommen: die zugeordneten
                const { data: zu } = await client
                    .from("center_assignments")
                    .select("centers(id, name, stadt)")
                    .eq("profile_id", profileId);
                const optionen = ((zu as unknown as { centers: CenterOption | null }[]) ?? [])
                    .map((z) => z.centers)
                    .filter((c): c is CenterOption => !!c);
                setCenterOptionen(optionen);
                setCenterId(vertrag && !vertrag.unterschrieben_am && vertrag.center_id ? vertrag.center_id : optionen[0]?.id ?? "");
            }
            if (!vertrag || !(await unterschreibbar(client, vertrag))) {
                setZustand({ art: "einfach", vertrag });
                // Noch kein Vertrag: blockiert nichts. Sonst meldet die ArbeitsvertragBox.
                if (!vertrag) onStatus?.(true);
                return;
            }
            const [{ data: p }, centerRes] = await Promise.all([
                client
                    .from("profiles")
                    .select("vorname, nachname, anschrift_strasse, anschrift_plz, anschrift_ort, geburtsdatum")
                    .eq("id", profileId)
                    .maybeSingle(),
                vertrag.center_id
                    ? client.from("centers").select("name, stadt").eq("id", vertrag.center_id).maybeSingle()
                    : client
                          .from("center_assignments")
                          .select("centers(name, stadt)")
                          .eq("profile_id", profileId)
                          .limit(1)
                          .maybeSingle(),
            ]);
            const rohCenter = centerRes.data as (Center & { centers?: undefined }) | { centers: Center | null } | null;
            const center = rohCenter && "centers" in rohCenter ? rohCenter.centers ?? null : (rohCenter as Center | null);
            setZustand({ art: "vertrag", vertrag, person: p as Person | null, center });
            onStatus?.(!!vertrag.unterschrieben_am);
        } catch (err) {
            setFehler(friendlyError(err, { aktion: "Arbeitsvertrag laden" }));
        }
        // onStatus bewusst nicht in den Abhaengigkeiten (neue Funktion je Render)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileId, modell]);

    useEffect(() => {
        laden();
    }, [laden]);

    const unterschreiben = async () => {
        if (zustand.art !== "vertrag") return;
        setFehler(null);
        if (!geprueft) return setFehler("Bitte bestätige zuerst, dass du die Angaben geprüft hast.");
        if (!unterschrift) return setFehler("Bitte unterschreibe im Feld.");
        const mitVertretung = minderjaehrig(zustand.person?.geburtsdatum ?? null);
        if (mitVertretung && !vertreter) return setFehler("Bitte lass auch deine Eltern / gesetzliche Vertretung unterschreiben.");
        setSendet(true);
        try {
            const res = await fetch(`/api/vertrag/${zustand.vertrag.id}/unterschreiben`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ geprueft: true, unterschrift, vertreter: mitVertretung ? vertreter : null }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || "Unterschreiben fehlgeschlagen");
            setErfolg("Danke! Dein Arbeitsvertrag ist unterschrieben.");
            await laden();
        } catch (err) {
            setFehler(err instanceof Error ? err.message : "Unterschreiben fehlgeschlagen");
        } finally {
            setSendet(false);
        }
    };

    const konditionenSpeichern = async () => {
        setFehler(null);
        setErfolg(null);
        const geprueftK = konditionenPruefen(konditionen, { minijobBegrenzt: !istAdmin });
        if ("fehler" in geprueftK) return setFehler(geprueftK.fehler);
        if (!geprueftK.werte) return setFehler("Bitte mindestens den Vertragsbeginn angeben.");
        const w = geprueftK.werte;
        setSpeichert(true);
        try {
            const res = await fetch("/api/vertrag", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...w, profile_id: profileId, center_id: centerId || null }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || "Speichern fehlgeschlagen");
            setBearbeiten(false);
            setErfolg(
                json.neu
                    ? `Arbeitsvertrag zugewiesen.${json.hinweis ? ` ${json.hinweis}` : ""}`
                    : "Vertragskonditionen gespeichert."
            );
            await laden();
        } catch (err) {
            setFehler(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
        } finally {
            setSpeichert(false);
        }
    };
    if (zustand.art === "laden") {
        return <div className="text-sm text-gray-500">{fehler ?? "Arbeitsvertrag wird geladen…"}</div>;
    }

    const vertrag = zustand.vertrag;
    const offen = vertrag && !vertrag.unterschrieben_am ? vertrag : null;

    // Admin/Regionalmanager: Konditionen anlegen oder (solange offen) aendern
    const verwaltung =
        modus === "verwalten" && eigeneId === profileId ? (
            <p className="text-xs text-gray-500">Deinen eigenen Arbeitsvertrag weist ein Admin zu.</p>
        ) : modus === "verwalten" ? (
            bearbeiten ? (
                <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
                    <div className="text-sm font-medium">{offen ? "Vertragskonditionen ändern" : "Arbeitsvertrag zuweisen"}</div>
                    <VertragKonditionen
                        wert={konditionen}
                        onChange={setKonditionen}
                        idPrefix={`vk-${profileId}`}
                        minijobBegrenzt={!istAdmin}
                    />
                    <div>
                        <label htmlFor={`vk-${profileId}-center`} className="block text-xs text-gray-500 mb-1">
                            Arbeitsort (Center)
                        </label>
                        {centerOptionen.length === 0 ? (
                            <p className="text-xs text-amber-700">
                                Diesem Mitarbeiter ist noch kein Center zugeordnet – bitte zuerst unten ein Center
                                zuordnen, sonst fehlt im Vertrag der Arbeitsort.
                            </p>
                        ) : (
                            <select
                                id={`vk-${profileId}-center`}
                                value={centerId}
                                onChange={(e) => setCenterId(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            >
                                {centerOptionen.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}, {c.stadt}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <p className="text-xs text-gray-500">
                        Name und Anschrift kommen aus dem Personalfragebogen, Ort und Datum setzt die App beim
                        Unterschreiben ein.{" "}
                        {offen ? "" : "Der Mitarbeiter bekommt eine E-Mail und unterschreibt den Vertrag in der App."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={konditionenSpeichern}
                            disabled={speichert}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm"
                        >
                            {speichert ? "Wird gespeichert…" : "Speichern"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setBearbeiten(false);
                                setKonditionen(konditionenAus(vertrag, modell));
                            }}
                            className="px-4 py-2 border rounded-md hover:bg-white text-sm"
                        >
                            Abbrechen
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        setErfolg(null);
                        setKonditionen(konditionenAus(vertrag, modell));
                        setBearbeiten(true);
                    }}
                    className="inline-flex items-center px-3 py-2 rounded-md border hover:bg-gray-50 text-sm"
                >
                    <PenLine className="h-4 w-4 mr-2" />
                    {offen ? "Konditionen ändern" : vertrag ? "Neuen Vertrag zuweisen" : "Arbeitsvertrag zuweisen"}
                </button>
            )
        ) : null;

    const meldungen = (
        <>
            {erfolg && <div className="p-2 bg-green-50 text-green-700 rounded-md text-sm">{erfolg}</div>}
            {fehler && <div className="p-2 bg-red-50 text-red-700 rounded-md text-sm">{fehler}</div>}
        </>
    );

    if (zustand.art === "einfach" && !vertrag) {
        return (
            <div className="space-y-3">
                <div
                    className={`p-4 border rounded-lg text-sm ${
                        modus === "verwalten" ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-blue-50 border-blue-200 text-blue-900"
                    }`}
                >
                    {modus === "verwalten" ? (
                        "Arbeitsvertrag offen – noch nicht zugewiesen."
                    ) : (
                        <>
                            Dein Arbeitsvertrag wird gerade von Esska erstellt. Sobald er fertig ist, bekommst du
                            eine E-Mail und kannst ihn hier prüfen und unterschreiben.
                            <span className="block italic text-xs mt-1">
                                Esska is preparing your employment contract. You will get an email as soon as it is
                                ready to sign here.
                            </span>
                        </>
                    )}
                </div>
                {verwaltung}
                {meldungen}
            </div>
        );
    }

    if (zustand.art === "einfach") {
        return (
            <div className="space-y-3">
                {modus === "verwalten" && offen && (
                    <div className="p-3 border rounded-lg bg-amber-50 border-amber-200 text-sm text-amber-900">
                        Konditionen hinterlegt ({ARBEITSZEIT_MODELL_LABELS[offen.art]}, ab {datum(offen.beginn)}
                        {offen.befristet_bis ? ` bis ${datum(offen.befristet_bis)}` : ""}
                        {offen.stundenlohn_cent !== null ? `, ${euro(offen.stundenlohn_cent)}/Std.` : ""}). Für diese
                        Beschäftigungsart ist noch keine ausfüllbare Vorlage hinterlegt – bis dahin gilt die
                        Bestätigung per Haken.
                    </div>
                )}
                <ArbeitsvertragBox
                    profileId={profileId}
                    modell={vertrag?.art ?? modell}
                    nurLesen={modus !== "selbst"}
                    onStatus={onStatus}
                />
                {verwaltung}
                {meldungen}
            </div>
        );
    }

    const { person, center } = zustand;
    const v = zustand.vertrag;
    const pdfUrl = `/api/vertrag/${v.id}/pdf`;
    const fehlt: string[] = [];
    if (!person?.vorname || !person?.nachname) fehlt.push("Vor- und Nachname");
    if (!person?.anschrift_strasse || !person?.anschrift_plz || !person?.anschrift_ort) fehlt.push("Anschrift");
    if (!center) fehlt.push("Center (Arbeitsort)");
    // Angaben, die Admin/Regionalmanager beim Zuweisen eintragen
    const fehltKonditionen: string[] = [];
    if (BEFRISTETE_ARTEN.includes(v.art) && !v.befristet_bis) fehltKonditionen.push("Enddatum der Befristung");
    if (v.stunden_pro_woche === null) fehltKonditionen.push("Stunden je Woche");
    if (v.stundenlohn_cent === null) fehltKonditionen.push("Stundenlohn");
    fehlt.push(...fehltKonditionen);
    const mitVertretung = minderjaehrig(person?.geburtsdatum ?? null);

    const zeilen: [string, string][] = [
        ["Name", person ? `${person.vorname ?? ""} ${person.nachname ?? ""}`.trim() || "—" : "—"],
        [
            "Anschrift",
            person?.anschrift_strasse
                ? `${person.anschrift_strasse}, ${person.anschrift_plz ?? ""} ${person.anschrift_ort ?? ""}`.trim()
                : "—",
        ],
        ["Beschäftigung", ARBEITSZEIT_MODELL_LABELS[v.art]],
        ["Beginn", datum(v.beginn)],
        ["Befristet bis", v.befristet_bis ? datum(v.befristet_bis) : "—"],
        ["Arbeitsort", center ? `${center.name}, ${center.stadt}` : "—"],
        ["Stunden je Woche", v.stunden_pro_woche === null ? "—" : `ca. ${zahl(v.stunden_pro_woche)}`],
        ["Stundenlohn brutto", euro(v.stundenlohn_cent)],
    ];

    return (
        <div className="p-4 border rounded-lg bg-white space-y-4 text-sm">
            <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <div className="font-medium">Arbeitsvertrag – {ARBEITSZEIT_MODELL_LABELS[v.art]}</div>
                    <div className="text-xs text-gray-500">
                        {v.unterschrieben_am
                            ? `Unterschrieben am ${new Date(v.unterschrieben_am).toLocaleString("de-DE")}`
                            : "Noch nicht unterschrieben"}
                    </div>
                </div>
            </div>

            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
                {zeilen.map(([k, w]) => (
                    <React.Fragment key={k}>
                        <dt className="text-gray-500">{k}</dt>
                        <dd className="break-words">{w}</dd>
                    </React.Fragment>
                ))}
            </dl>

            <div className="flex flex-wrap gap-2">
                <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
                >
                    <FileText className="h-4 w-4 mr-2" />
                    {v.unterschrieben_am ? "Vertrag ansehen" : "Vertrag lesen (Vorschau)"}
                </a>
                {v.unterschrieben_am && (
                    <a href={`${pdfUrl}?download=1`} className="inline-flex items-center px-3 py-2 rounded-md border hover:bg-gray-50">
                        <Download className="h-4 w-4 mr-2" />
                        Herunterladen
                    </a>
                )}
            </div>

            {v.unterschrieben_am ? (
                <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Unterschrieben – der Vertrag kann nicht mehr geändert werden.
                </div>
            ) : modus !== "selbst" ? (
                <div className="text-amber-700">
                    Wartet auf die Unterschrift des Mitarbeiters.
                    {fehlt.length > 0 && ` Es fehlen noch: ${fehlt.join(", ")}.`}
                </div>
            ) : fehlt.length > 0 ? (
                <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900">
                    Im Vertrag fehlen noch Angaben: {fehlt.join(", ")}. Bitte ergänze zuerst deine Stammdaten
                    {fehlt.includes("Center (Arbeitsort)") || fehltKonditionen.length > 0
                        ? " bzw. melde dich bei deinem Ansprechpartner"
                        : ""}
                    .
                </div>
            ) : (
                <div className="space-y-4 border-t pt-4">
                    <p className="text-gray-600">
                        Bitte lies den Vertrag vollständig (Vorschau) und prüfe die Angaben oben. Stimmt etwas
                        nicht, melde dich vor dem Unterschreiben bei deinem Ansprechpartner.
                        <span className="block italic text-xs mt-1">
                            Please read the full contract (preview) and check the details above before signing.
                        </span>
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={geprueft}
                            onChange={(e) => setGeprueft(e.target.checked)}
                            className="mt-1 flex-shrink-0"
                        />
                        <span>
                            Ich habe den Vertrag gelesen, die Angaben sind richtig und ich bin mit dem Inhalt
                            einverstanden.
                            <span className="block italic text-xs text-gray-500">
                                I have read the contract, the details are correct and I agree to its contents.
                            </span>
                        </span>
                    </label>
                    <Unterschriftsfeld
                        label="Deine Unterschrift"
                        hinweis={`Ort und Datum werden automatisch eingesetzt (${center?.stadt ?? ""}, ${datum(heuteIso())}).`}
                        onChange={setUnterschrift}
                        gesperrt={sendet}
                    />
                    {mitVertretung && (
                        <Unterschriftsfeld
                            label="Unterschrift Eltern / gesetzliche Vertretung"
                            hinweis="Du bist noch nicht volljährig – deshalb muss zusätzlich ein Elternteil unterschreiben."
                            onChange={setVertreter}
                            gesperrt={sendet}
                        />
                    )}
                    <button
                        type="button"
                        onClick={unterschreiben}
                        disabled={sendet || !geprueft || !unterschrift || (mitVertretung && !vertreter)}
                        className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                        {sendet ? "Wird unterschrieben…" : "Verbindlich unterschreiben"}
                    </button>
                </div>
            )}

            {verwaltung}
            {meldungen}
        </div>
    );
}
