"use client";

import React, { useState } from "react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type {
    EsskaAktuellerStatus,
    EsskaArbeitszeitModell,
    EsskaFamilienstand,
    EsskaKonfession,
    EsskaKvStatus,
    EsskaProfile,
    EsskaSteuerklasse,
} from "@/lib/esska/types";
import {
    AKTUELLER_STATUS_LABELS,
    BERUFSTAETIG_ART_LABELS,
    centToEuro,
    euroToCent,
    validiereRvNummer,
    validiereSteuerId,
} from "@/lib/esska/types";
import type { EsskaBerufstaetigArt } from "@/lib/esska/types";

// Bekannteste deutsche Krankenkassen, alphabetisch sortiert.
// "Andere…" ermoeglicht Freitext fuer alle nicht gelisteten Kassen.
const KRANKENKASSEN_GESETZLICH = [
    // O-6: Es gibt keine bundesweite "AOK" - die 11 regionalen AOKs einzeln
    "AOK Baden-Württemberg",
    "AOK Bayern",
    "AOK Bremen/Bremerhaven",
    "AOK Hessen",
    "AOK Niedersachsen",
    "AOK Nordost",
    "AOK NordWest",
    "AOK PLUS (Sachsen und Thüringen)",
    "AOK Rheinland/Hamburg",
    "AOK Rheinland-Pfalz/Saarland",
    "AOK Sachsen-Anhalt",
    "Audi BKK",
    "Barmer",
    "BIG direkt gesund",
    "BKK firmus",
    "BKK Mobil Oil",
    "BKK VBU",
    "DAK-Gesundheit",
    "Debeka BKK",
    "HEK",
    "hkk Krankenkasse",
    "IKK classic",
    "Knappschaft",
    "KKH",
    "mhplus BKK",
    "Pronova BKK",
    "R+V BKK",
    "Salus BKK",
    "SBK",
    "Techniker Krankenkasse",
    "Viactiv",
] as const;

const KRANKENKASSEN_PRIVAT = [
    "Allianz Private Krankenversicherung",
    "ARAG",
    "AXA",
    "Barmenia",
    "Continentale",
    "Debeka",
    "DKV Deutsche Krankenversicherung",
    "Gothaer",
    "Hallesche",
    "HanseMerkur",
    "HUK-Coburg",
    "INTER",
    "LVM",
    "Mecklenburgische",
    "Münchener Verein",
    "R+V",
    "Signal Iduna",
    "uniVersa",
    "Württembergische",
] as const;

type Props = {
    profile: EsskaProfile;
    onSaved: (p: EsskaProfile) => void;
    /** Im Onboarding wird die Bestaetigung mit angeboten und onboarding_abgeschlossen gesetzt. */
    onboardingMode?: boolean;
    /** Wenn der Admin den Mitarbeiter editiert: zusaetzliche Felder freischalten
     *  (arbeitszeit_modell, eintrittsdatum). */
    adminMode?: boolean;
};

type Form = Omit<
    EsskaProfile,
    "verdienst_monat_eur_cent" | "stunden_pro_woche" | "kinderfreibetrag" | "max_schichten_pro_woche"
> & {
    verdienst_euro: string;
    stunden_pro_woche_str: string;
    max_schichten_pro_woche_str: string;
    kinderfreibetrag_str: string;
    bestaetigt: boolean;
};

function profileToForm(p: EsskaProfile): Form {
    return {
        ...p,
        verdienst_euro: p.verdienst_monat_eur_cent ? centToEuro(p.verdienst_monat_eur_cent) : "",
        stunden_pro_woche_str: p.stunden_pro_woche?.toString() ?? "",
        max_schichten_pro_woche_str: p.max_schichten_pro_woche?.toString() ?? "",
        kinderfreibetrag_str: p.kinderfreibetrag?.toString() ?? "",
        bestaetigt: false,
    };
}

export default function StammdatenForm({
    profile,
    onSaved,
    onboardingMode = false,
    adminMode = false,
}: Props) {
    const [form, setForm] = useState<Form>(profileToForm(profile));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = <K extends keyof Form>(key: K, value: Form[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    // Laut Esska-Original-Personalfragebogen sind nur fuer Minijob die mit *
    // gekennzeichneten Felder (Steuerklasse/Kinderfreibetrag/Konfession +
    // Notfallkontakt) optional. Kurzfristig Beschaeftigte muessen sie
    // ausfuellen (Lohnsteuer wird abgefuehrt). Steuer-ID ist immer Pflicht.
    // Pflichtfeld-Logik haengt vom arbeitszeit_modell ab, das nur der Admin
    // pflegt. Wenn das Modell schon gesetzt ist: 'minijob' macht *-Felder
    // optional. Wenn das Modell noch nicht gesetzt ist (frisches Mitarbeiter-
    // Onboarding): wir verlangen die Felder zur Sicherheit; falls der MA
    // tatsaechlich nur Minijobber wird, kann der Admin sie ohne Fehler leeren.
    const istMinijob = form.arbeitszeit_modell === "minijob";
    const isPflichtSternchen = !istMinijob;

    // Krankenkassen-Auswahl: Dropdown vs. Freitext "Andere…"
    const liste = form.krankenversicherung_status === "privat"
        ? KRANKENKASSEN_PRIVAT
        : KRANKENKASSEN_GESETZLICH;
    const istInListe = (name: string | null) =>
        !!name && (liste as readonly string[]).includes(name);
    const [kvAndereOffen, setKvAndereOffen] = useState<boolean>(
        !!form.krankenversicherung_name && !istInListe(form.krankenversicherung_name)
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // O-7: Steuer-ID = genau 11 Ziffern
        let steuerIdWert: string | null = form.steuer_id?.trim() || null;
        if (steuerIdWert) {
            const pruefung = validiereSteuerId(steuerIdWert);
            if (!pruefung.ok) {
                setError(pruefung.fehler ?? "Steuer-ID ungültig.");
                return;
            }
            steuerIdWert = pruefung.normalisiert;
        }

        // O-8: RV-Nummer = 8 Ziffern + Buchstabe + 3 Ziffern
        let rvWert: string | null = form.rentenversicherungsnummer?.trim() || null;
        let rvWarnung: string | null = null;
        if (rvWert) {
            const pruefung = validiereRvNummer(rvWert, form.geburtsdatum);
            if (!pruefung.ok) {
                setError(pruefung.fehler ?? "Rentenversicherungsnummer ungültig.");
                return;
            }
            rvWert = pruefung.normalisiert;
            rvWarnung = pruefung.warnung ?? null;
        }

        setSaving(true);
        try {
            const client = await getEsskaClient();
            const payload = {
                vorname: form.vorname || null,
                nachname: form.nachname || null,
                geburtsdatum: form.geburtsdatum || null,
                geburtsort: form.geburtsort || null,
                geburtsland: form.geburtsland || null,
                staatsangehoerigkeit: form.staatsangehoerigkeit || null,
                eu_staatsbuergerschaft: form.eu_staatsbuergerschaft,
                familienstand: form.familienstand,
                anschrift_strasse: form.anschrift_strasse || null,
                anschrift_plz: form.anschrift_plz || null,
                anschrift_ort: form.anschrift_ort || null,
                telefon_mobil: form.telefon_mobil || null,
                arbeitszeit_modell: form.arbeitszeit_modell,
                aktueller_status: form.aktueller_status,
                aktueller_status_sonstiges:
                    form.aktueller_status === "sonstiges"
                        ? form.aktueller_status_sonstiges?.trim() || null
                        : null,
                berufstaetig_art:
                    form.aktueller_status === "berufstaetig" ? form.berufstaetig_art : null,
                sozialleistungen_bezug: form.sozialleistungen_bezug,
                stunden_pro_woche: form.stunden_pro_woche_str
                    ? parseFloat(form.stunden_pro_woche_str.replace(",", "."))
                    : null,
                max_schichten_pro_woche: form.max_schichten_pro_woche_str
                    ? parseInt(form.max_schichten_pro_woche_str, 10) || null
                    : null,
                verdienst_monat_eur_cent: form.verdienst_euro ? euroToCent(form.verdienst_euro) : null,
                weitere_beschaeftigungen: form.weitere_beschaeftigungen || null,
                rentenversicherungsnummer: rvWert,
                krankenversicherung_name: form.krankenversicherung_name || null,
                krankenversicherung_status: form.krankenversicherung_status,
                rentenversicherung_befreit: form.rentenversicherung_befreit,
                steuer_id: steuerIdWert,
                steuerklasse: form.steuerklasse,
                kinderfreibetrag: form.kinderfreibetrag_str
                    ? parseFloat(form.kinderfreibetrag_str.replace(",", "."))
                    : null,
                konfession: form.konfession,
                notfall_name: form.notfall_name || null,
                notfall_beziehung: form.notfall_beziehung || null,
                notfall_telefon: form.notfall_telefon || null,
                ...(form.bestaetigt
                    ? {
                          stammdaten_bestaetigt_am: new Date().toISOString(),
                          onboarding_abgeschlossen: onboardingMode ? true : profile.onboarding_abgeschlossen,
                      }
                    : {}),
            };
            const { data, error: e } = await client
                .from("profiles")
                .update(payload)
                .eq("id", profile.id)
                .select("*")
                .single();
            if (e) throw e;
            if (rvWarnung) setError(rvWarnung);
            onSaved(data as EsskaProfile);
            setForm((prev) => ({ ...prev, bestaetigt: false }));
        } catch (err) {
            setError(friendlyError(err, { aktion: "Speichern fehlgeschlagen." }));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

            <Section titel="Persönliche Daten">
                <Grid>
                    <Field label="Vorname" required>
                        <input value={form.vorname ?? ""} onChange={(e) => update("vorname", e.target.value)} required className={inputCls} />
                    </Field>
                    <Field label="Nachname" required>
                        <input value={form.nachname ?? ""} onChange={(e) => update("nachname", e.target.value)} required className={inputCls} />
                    </Field>
                    <Field label="Geburtsdatum" required>
                        <input type="date" value={form.geburtsdatum ?? ""} onChange={(e) => update("geburtsdatum", e.target.value)} required className={inputCls} />
                    </Field>
                    <Field label="Geburtsort" required>
                        <input value={form.geburtsort ?? ""} onChange={(e) => update("geburtsort", e.target.value)} required className={inputCls} />
                    </Field>
                    <Field label="Geburtsland" required>
                        <input value={form.geburtsland ?? ""} onChange={(e) => update("geburtsland", e.target.value)} required placeholder="z. B. Deutschland" className={inputCls} />
                    </Field>
                    <Field label="Staatsangehörigkeit" required>
                        <input value={form.staatsangehoerigkeit ?? ""} onChange={(e) => update("staatsangehoerigkeit", e.target.value)} required className={inputCls} />
                    </Field>
                    <Field
                        label="Staatsbürgerschaft eines EU-Landes?"
                        required
                        hint="Bei Nein wird im Dokumente-Schritt zusätzlich der Aufenthaltstitel benötigt."
                    >
                        <select
                            value={form.eu_staatsbuergerschaft === null ? "" : form.eu_staatsbuergerschaft ? "ja" : "nein"}
                            onChange={(e) => update("eu_staatsbuergerschaft", e.target.value === "" ? null : e.target.value === "ja")}
                            required
                            className={inputCls}
                        >
                            <option value="">– wählen –</option>
                            <option value="ja">Ja (inkl. Deutschland)</option>
                            <option value="nein">Nein</option>
                        </select>
                    </Field>
                    <Field label="Familienstand" required>
                        <select value={form.familienstand ?? ""} onChange={(e) => update("familienstand", (e.target.value || null) as EsskaFamilienstand | null)} required className={inputCls}>
                            <option value="">– wählen –</option>
                            <option value="ledig">ledig</option>
                            <option value="verheiratet">verheiratet</option>
                            <option value="geschieden">geschieden</option>
                        </select>
                    </Field>
                </Grid>
            </Section>

            <Section titel="Kontaktdaten">
                <Grid>
                    <Field label="Straße & Hausnummer" required full>
                        <input value={form.anschrift_strasse ?? ""} onChange={(e) => update("anschrift_strasse", e.target.value)} required className={inputCls} />
                    </Field>
                    <Field label="PLZ" required>
                        <input value={form.anschrift_plz ?? ""} onChange={(e) => update("anschrift_plz", e.target.value)} required className={inputCls} />
                    </Field>
                    <Field label="Ort" required>
                        <input value={form.anschrift_ort ?? ""} onChange={(e) => update("anschrift_ort", e.target.value)} required className={inputCls} />
                    </Field>
                    <Field label="Mobil-Telefon" required>
                        <input value={form.telefon_mobil ?? ""} onChange={(e) => update("telefon_mobil", e.target.value)} required className={inputCls} />
                    </Field>
                    <Field label="E-Mail">
                        <input value={profile.email ?? ""} disabled className={`${inputCls} bg-gray-50`} />
                    </Field>
                </Grid>
            </Section>

            <Section titel="Aktueller Status">
                <Grid>
                    <Field
                        label="Was machst du aktuell?"
                        required
                        hint="Hilft uns, die passenden Nachweise (z. B. Immatrikulationsbescheinigung) anzufragen."
                    >
                        <select
                            value={form.aktueller_status ?? ""}
                            onChange={(e) =>
                                update("aktueller_status", (e.target.value || null) as EsskaAktuellerStatus | null)
                            }
                            required
                            className={inputCls}
                        >
                            <option value="">– wählen –</option>
                            {(Object.keys(AKTUELLER_STATUS_LABELS) as EsskaAktuellerStatus[]).map((s) => (
                                <option key={s} value={s}>
                                    {AKTUELLER_STATUS_LABELS[s]}
                                </option>
                            ))}
                        </select>
                    </Field>
                    {form.aktueller_status === "berufstaetig" && (
                        <Field label="In welchem Umfang?" required hint="Minijob, Teilzeit oder Vollzeit bei deinem anderen Arbeitgeber.">
                            <select
                                value={form.berufstaetig_art ?? ""}
                                onChange={(e) => update("berufstaetig_art", (e.target.value || null) as EsskaBerufstaetigArt | null)}
                                required
                                className={inputCls}
                            >
                                <option value="">– wählen –</option>
                                {(Object.keys(BERUFSTAETIG_ART_LABELS) as EsskaBerufstaetigArt[]).map((a) => (
                                    <option key={a} value={a}>{BERUFSTAETIG_ART_LABELS[a]}</option>
                                ))}
                            </select>
                        </Field>
                    )}
                    <Field
                        label="Beziehst du selbst Sozialleistungen?"
                        required
                        full
                        hint="z. B. Bürgergeld oder Arbeitslosengeld. Wichtig für die richtige Anmeldung deiner Beschäftigung – die Angabe muss bei einer Prüfung nachweisbar sein."
                    >
                        <select
                            value={form.sozialleistungen_bezug === null ? "" : form.sozialleistungen_bezug ? "ja" : "nein"}
                            onChange={(e) => update("sozialleistungen_bezug", e.target.value === "" ? null : e.target.value === "ja")}
                            required
                            className={inputCls}
                        >
                            <option value="">– wählen –</option>
                            <option value="nein">Nein</option>
                            <option value="ja">Ja</option>
                        </select>
                    </Field>
                    {form.aktueller_status === "sonstiges" && (
                        <Field label="Bitte angeben" required>
                            <input
                                value={form.aktueller_status_sonstiges ?? ""}
                                onChange={(e) => update("aktueller_status_sonstiges", e.target.value)}
                                required
                                className={inputCls}
                            />
                        </Field>
                    )}
                    <Field label="Weitere Beschäftigungen (falls vorhanden)" full>
                        <input
                            value={form.weitere_beschaeftigungen ?? ""}
                            onChange={(e) => update("weitere_beschaeftigungen", e.target.value)}
                            className={inputCls}
                        />
                    </Field>
                </Grid>
            </Section>

            {adminMode && (
                <Section titel="Beschäftigung (nur durch Admin pflegbar)">
                    <Grid>
                        <Field label="Arbeitszeit-Modell">
                            <select
                                value={form.arbeitszeit_modell ?? ""}
                                onChange={(e) =>
                                    update(
                                        "arbeitszeit_modell",
                                        (e.target.value || null) as EsskaArbeitszeitModell | null
                                    )
                                }
                                className={inputCls}
                            >
                                <option value="">– wählen –</option>
                                <option value="vollzeit">Vollzeit</option>
                                <option value="teilzeit">Teilzeit</option>
                                <option value="minijob">Minijob</option>
                                <option value="kurzfristig">Kurzfristig beschäftigt</option>
                            </select>
                        </Field>
                        <Field label="Stunden / Woche">
                            <input
                                value={form.stunden_pro_woche_str}
                                onChange={(e) => update("stunden_pro_woche_str", e.target.value)}
                                inputMode="decimal"
                                className={inputCls}
                            />
                        </Field>
                        <Field
                            label="Max. Schichten / Woche"
                            hint="Soft-Hinweis bei der Schichtplanung. Leer = kein Limit."
                        >
                            <input
                                value={form.max_schichten_pro_woche_str}
                                onChange={(e) => update("max_schichten_pro_woche_str", e.target.value)}
                                inputMode="numeric"
                                placeholder="z. B. 2"
                                className={inputCls}
                            />
                        </Field>
                        <Field label="Verdienst pro Monat (€)" hint="bei Minijob bis 556 €">
                            <input
                                value={form.verdienst_euro}
                                onChange={(e) => update("verdienst_euro", e.target.value)}
                                inputMode="decimal"
                                className={inputCls}
                            />
                        </Field>
                    </Grid>
                </Section>
            )}

            <Section titel="Sozialversicherung">
                <Grid>
                    <Field
                        label="Rentenversicherungsnummer (12-stellig)"
                        required
                        hint="Steht auf dem Sozialversicherungsausweis oder im Renteninformationsschreiben. Format: 11 Ziffern + 1 Buchstabe (z. B. 65 170839 W 001)."
                    >
                        <input
                            value={form.rentenversicherungsnummer ?? ""}
                            onChange={(e) => update("rentenversicherungsnummer", e.target.value)}
                            required
                            placeholder="65170839W001"
                            className={`${inputCls} font-mono`}
                        />
                    </Field>
                    <Field label="Mitgliedsstatus" required>
                        <select
                            value={form.krankenversicherung_status ?? ""}
                            onChange={(e) => {
                                const v = (e.target.value || null) as EsskaKvStatus | null;
                                update("krankenversicherung_status", v);
                                // Wenn Status wechselt, KV-Name zuruecksetzen
                                update("krankenversicherung_name", null);
                                setKvAndereOffen(false);
                            }}
                            required
                            className={inputCls}
                        >
                            <option value="">– wählen –</option>
                            <option value="gesetzlich">gesetzlich</option>
                            <option value="privat">privat</option>
                        </select>
                    </Field>
                    <Field
                        label="Krankenversicherung"
                        required
                        hint="Falls deine Kasse nicht in der Liste ist, wähle ‚Andere…' und gib sie selbst ein."
                    >
                        {!form.krankenversicherung_status ? (
                            <input disabled placeholder="Erst Mitgliedsstatus wählen" className={`${inputCls} bg-gray-50`} />
                        ) : kvAndereOffen ? (
                            <div className="space-y-2">
                                <input
                                    value={form.krankenversicherung_name ?? ""}
                                    onChange={(e) => update("krankenversicherung_name", e.target.value)}
                                    required
                                    placeholder="Name der Krankenversicherung"
                                    className={inputCls}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setKvAndereOffen(false);
                                        update("krankenversicherung_name", null);
                                    }}
                                    className="text-xs text-primary-600 hover:underline"
                                >
                                    Doch aus Liste wählen
                                </button>
                            </div>
                        ) : (
                            <select
                                value={istInListe(form.krankenversicherung_name) ? form.krankenversicherung_name ?? "" : ""}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "__andere__") {
                                        setKvAndereOffen(true);
                                        update("krankenversicherung_name", "");
                                    } else {
                                        update("krankenversicherung_name", v || null);
                                    }
                                }}
                                required
                                className={inputCls}
                            >
                                <option value="">– wählen –</option>
                                {liste.map((k) => (
                                    <option key={k} value={k}>
                                        {k}
                                    </option>
                                ))}
                                <option value="__andere__">Andere…</option>
                            </select>
                        )}
                    </Field>
                    {form.arbeitszeit_modell === "minijob" && (
                        <Field label="Rentenversicherungs-Befreiung beantragt?">
                            <select
                                value={form.rentenversicherung_befreit ? "ja" : "nein"}
                                onChange={(e) => update("rentenversicherung_befreit", e.target.value === "ja")}
                                className={inputCls}
                            >
                                <option value="nein">nein</option>
                                <option value="ja">ja (Antragsformular wird im Onboarding ausgefüllt)</option>
                            </select>
                        </Field>
                    )}
                </Grid>
            </Section>

            <Section titel={`Steuerdaten ${isPflichtSternchen ? "" : "(bei Minijob optional)"}`}>
                <Grid>
                    <Field
                        label="Steuer-ID (11-stellig)"
                        required
                        hint="Steht auf der Lohnsteuerbescheinigung des Arbeitgebers oder kann beim Bundeszentralamt für Steuern (bzst.de) angefragt werden. Format: 11 Ziffern."
                    >
                        <input
                            value={form.steuer_id ?? ""}
                            onChange={(e) => update("steuer_id", e.target.value)}
                            required
                            placeholder="12345678901"
                            className={`${inputCls} font-mono`}
                        />
                    </Field>
                    <Field
                        label="Steuerklasse"
                        required={isPflichtSternchen}
                        hint="Wird vom Finanzamt vergeben (I–VI). Bei Unsicherheit auf der letzten Lohnsteuerbescheinigung nachschauen oder unter ELSTER abrufen."
                    >
                        <select
                            value={form.steuerklasse ?? ""}
                            onChange={(e) => update("steuerklasse", (e.target.value || null) as EsskaSteuerklasse | null)}
                            required={isPflichtSternchen}
                            className={inputCls}
                        >
                            <option value="">– wählen –</option>
                            <option value="I">I</option>
                            <option value="II">II</option>
                            <option value="III">III</option>
                            <option value="IV">IV</option>
                            <option value="V">V</option>
                            <option value="VI">VI</option>
                        </select>
                    </Field>
                    <Field
                        label="Kinderfreibetrag"
                        required={isPflichtSternchen}
                        hint="0 wenn keine Kinder. Sonst steht der Wert (0,5 / 1,0 / 2,0 …) auf der Lohnsteuerbescheinigung."
                    >
                        <input
                            value={form.kinderfreibetrag_str}
                            onChange={(e) => update("kinderfreibetrag_str", e.target.value)}
                            inputMode="decimal"
                            placeholder="z. B. 0 oder 1,0"
                            className={inputCls}
                            required={isPflichtSternchen}
                        />
                    </Field>
                    <Field
                        label="Konfession"
                        required={isPflichtSternchen}
                        hint="Für Kirchensteuer. ‚Keine‘ wählen, wenn nicht kirchensteuerpflichtig."
                    >
                        <select
                            value={form.konfession ?? ""}
                            onChange={(e) => update("konfession", (e.target.value || null) as EsskaKonfession | null)}
                            required={isPflichtSternchen}
                            className={inputCls}
                        >
                            <option value="">– wählen –</option>
                            <option value="evangelisch">evangelisch</option>
                            <option value="katholisch">katholisch</option>
                            <option value="keine">keine</option>
                        </select>
                    </Field>
                </Grid>
            </Section>

            <Section titel={`Notfallkontakt ${isPflichtSternchen ? "" : "(bei Minijob optional, aber empfohlen)"}`}>
                <Grid>
                    <Field label="Name" required={isPflichtSternchen}>
                        <input value={form.notfall_name ?? ""} onChange={(e) => update("notfall_name", e.target.value)} required={isPflichtSternchen} className={inputCls} />
                    </Field>
                    <Field label="Beziehung" required={isPflichtSternchen} hint="z. B. Mutter, Partner, Freund">
                        <input value={form.notfall_beziehung ?? ""} onChange={(e) => update("notfall_beziehung", e.target.value)} required={isPflichtSternchen} className={inputCls} />
                    </Field>
                    <Field label="Telefon" required={isPflichtSternchen}>
                        <input value={form.notfall_telefon ?? ""} onChange={(e) => update("notfall_telefon", e.target.value)} required={isPflichtSternchen} className={inputCls} />
                    </Field>
                </Grid>
            </Section>

            <Section titel="Bestätigung">
                <label className="flex items-start gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={form.bestaetigt}
                        onChange={(e) => update("bestaetigt", e.target.checked)}
                        className="mt-1"
                    />
                    <span>
                        Ich versichere, dass meine Angaben der Wahrheit entsprechen und verpflichte mich, Änderungen
                        (z. B. weitere Beschäftigungen, Adressänderungen) unverzüglich mitzuteilen.
                    </span>
                </label>
                {profile.stammdaten_bestaetigt_am && (
                    <p className="text-xs text-gray-500 mt-2">
                        Zuletzt bestätigt am {new Date(profile.stammdaten_bestaetigt_am).toLocaleString("de-DE")}
                    </p>
                )}
            </Section>

            {/* Fehlermeldung auch direkt beim Speichern-Button anzeigen:
                nach dem Klick ist man ganz unten gescrollt und wuerde die
                Meldung oben sonst gar nicht sehen. */}
            {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
            )}

            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                    {saving ? "Speichern…" : onboardingMode ? "Weiter" : "Stammdaten speichern"}
                </button>
            </div>
        </form>
    );
}

const inputCls =
    "w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500";

function Section({ titel, children }: { titel: string; children: React.ReactNode }) {
    return (
        <div className="bg-white border rounded-lg p-4">
            <h3 className="text-base font-semibold mb-3">{titel}</h3>
            {children}
        </div>
    );
}

function Grid({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({
    label,
    children,
    required,
    full,
    hint,
}: {
    label: string;
    children: React.ReactNode;
    required?: boolean;
    full?: boolean;
    hint?: string;
}) {
    return (
        <div className={full ? "md:col-span-2" : ""}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
                {required && <span className="text-red-500"> *</span>}
            </label>
            {children}
            {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
        </div>
    );
}
