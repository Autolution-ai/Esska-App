"use client";

import React, { useState } from "react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type {
    EsskaArbeitszeitModell,
    EsskaFamilienstand,
    EsskaKonfession,
    EsskaKvStatus,
    EsskaProfile,
    EsskaSteuerklasse,
} from "@/lib/esska/types";
import { centToEuro, euroToCent } from "@/lib/esska/types";

type Props = {
    profile: EsskaProfile;
    onSaved: (p: EsskaProfile) => void;
    onboardingMode?: boolean;
};

type Form = Omit<EsskaProfile, "verdienst_monat_eur_cent" | "stunden_pro_woche" | "kinderfreibetrag"> & {
    verdienst_euro: string;
    stunden_pro_woche_str: string;
    kinderfreibetrag_str: string;
    bestaetigt: boolean;
};

function profileToForm(p: EsskaProfile): Form {
    return {
        ...p,
        verdienst_euro: p.verdienst_monat_eur_cent ? centToEuro(p.verdienst_monat_eur_cent) : "",
        stunden_pro_woche_str: p.stunden_pro_woche?.toString() ?? "",
        kinderfreibetrag_str: p.kinderfreibetrag?.toString() ?? "",
        bestaetigt: false,
    };
}

export default function StammdatenForm({ profile, onSaved, onboardingMode = false }: Props) {
    const [form, setForm] = useState<Form>(profileToForm(profile));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = <K extends keyof Form>(key: K, value: Form[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const isPflichtSternchen = form.arbeitszeit_modell !== "minijob" && form.arbeitszeit_modell !== "kurzfristig";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const client = await getEsskaClient();
            const payload = {
                vorname: form.vorname || null,
                nachname: form.nachname || null,
                geburtsdatum: form.geburtsdatum || null,
                geburtsort: form.geburtsort || null,
                staatsangehoerigkeit: form.staatsangehoerigkeit || null,
                familienstand: form.familienstand,
                anschrift_strasse: form.anschrift_strasse || null,
                anschrift_plz: form.anschrift_plz || null,
                anschrift_ort: form.anschrift_ort || null,
                telefon_mobil: form.telefon_mobil || null,
                arbeitszeit_modell: form.arbeitszeit_modell,
                stunden_pro_woche: form.stunden_pro_woche_str
                    ? parseFloat(form.stunden_pro_woche_str.replace(",", "."))
                    : null,
                verdienst_monat_eur_cent: form.verdienst_euro ? euroToCent(form.verdienst_euro) : null,
                weitere_beschaeftigungen: form.weitere_beschaeftigungen || null,
                rentenversicherungsnummer: form.rentenversicherungsnummer || null,
                krankenversicherung_name: form.krankenversicherung_name || null,
                krankenversicherung_status: form.krankenversicherung_status,
                rentenversicherung_befreit: form.rentenversicherung_befreit,
                steuer_id: form.steuer_id || null,
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
                    <Field label="Staatsangehörigkeit" required>
                        <input value={form.staatsangehoerigkeit ?? ""} onChange={(e) => update("staatsangehoerigkeit", e.target.value)} required className={inputCls} />
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

            <Section titel="Beschäftigung">
                <Grid>
                    <Field label="Arbeitszeit-Modell" required>
                        <select
                            value={form.arbeitszeit_modell ?? ""}
                            onChange={(e) => update("arbeitszeit_modell", (e.target.value || null) as EsskaArbeitszeitModell | null)}
                            required
                            className={inputCls}
                        >
                            <option value="">– wählen –</option>
                            <option value="vollzeit">Vollzeit</option>
                            <option value="teilzeit">Teilzeit</option>
                            <option value="minijob">Minijob</option>
                            <option value="kurzfristig">Kurzfristig beschäftigt</option>
                        </select>
                    </Field>
                    <Field label="Stunden / Woche" hint={form.arbeitszeit_modell === "teilzeit" ? "Pflicht bei Teilzeit" : ""}>
                        <input
                            value={form.stunden_pro_woche_str}
                            onChange={(e) => update("stunden_pro_woche_str", e.target.value)}
                            inputMode="decimal"
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
                    <Field label="Weitere Beschäftigungen (falls vorhanden)" full>
                        <input
                            value={form.weitere_beschaeftigungen ?? ""}
                            onChange={(e) => update("weitere_beschaeftigungen", e.target.value)}
                            className={inputCls}
                        />
                    </Field>
                </Grid>
            </Section>

            <Section titel="Sozialversicherung">
                <Grid>
                    <Field label="Rentenversicherungsnummer (12-stellig)" required>
                        <input
                            value={form.rentenversicherungsnummer ?? ""}
                            onChange={(e) => update("rentenversicherungsnummer", e.target.value)}
                            required
                            className={`${inputCls} font-mono`}
                        />
                    </Field>
                    <Field label="Krankenversicherung (genau)" required>
                        <input
                            value={form.krankenversicherung_name ?? ""}
                            onChange={(e) => update("krankenversicherung_name", e.target.value)}
                            required
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Mitgliedsstatus" required>
                        <select
                            value={form.krankenversicherung_status ?? ""}
                            onChange={(e) => update("krankenversicherung_status", (e.target.value || null) as EsskaKvStatus | null)}
                            required
                            className={inputCls}
                        >
                            <option value="">– wählen –</option>
                            <option value="gesetzlich">gesetzlich</option>
                            <option value="privat">privat</option>
                        </select>
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

            <Section titel={`Steuerdaten ${isPflichtSternchen ? "" : "(bei Minijob/Kurzfristig optional)"}`}>
                <Grid>
                    <Field label="Steuer-ID (11-stellig)" required={isPflichtSternchen}>
                        <input
                            value={form.steuer_id ?? ""}
                            onChange={(e) => update("steuer_id", e.target.value)}
                            required={isPflichtSternchen}
                            className={`${inputCls} font-mono`}
                        />
                    </Field>
                    <Field label="Steuerklasse" required={isPflichtSternchen}>
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
                    <Field label="Kinderfreibetrag" required={isPflichtSternchen}>
                        <input
                            value={form.kinderfreibetrag_str}
                            onChange={(e) => update("kinderfreibetrag_str", e.target.value)}
                            inputMode="decimal"
                            className={inputCls}
                            required={isPflichtSternchen}
                        />
                    </Field>
                    <Field label="Konfession" required={isPflichtSternchen}>
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

            <Section titel={`Notfallkontakt ${isPflichtSternchen ? "" : "(bei Minijob/Kurzfristig optional, aber empfohlen)"}`}>
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
