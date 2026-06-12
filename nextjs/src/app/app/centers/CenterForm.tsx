"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getEsskaClient } from "@/lib/esska/client";
import type { EsskaCenter, EsskaCenterKategorie, EsskaCenterStatus } from "@/lib/esska/types";
import { centToEuro, euroToCent } from "@/lib/esska/types";

type FormState = {
    saison: string;
    name: string;
    stadt: string;
    kuerzel: string;
    kategorie: EsskaCenterKategorie;
    start_datum: string;
    end_datum: string;
    flaeche_position: string;
    laenge_m: string;
    breite_m: string;
    flaeche_qm_override: string;
    mietdauer_tage_override: string;
    miete_euro: string;
    status: EsskaCenterStatus;
    notiz: string;
};

const leereForm: FormState = {
    saison: "",
    name: "",
    stadt: "",
    kuerzel: "",
    kategorie: "A",
    start_datum: "",
    end_datum: "",
    flaeche_position: "",
    laenge_m: "",
    breite_m: "",
    flaeche_qm_override: "",
    mietdauer_tage_override: "",
    miete_euro: "",
    status: "geplant",
    notiz: "",
};

function defaultSaison(): string {
    const now = new Date();
    const jahr = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const naechstes = (jahr + 1) % 100;
    return `${jahr % 100}/${naechstes.toString().padStart(2, "0")}`;
}

export default function CenterForm({ center }: { center?: EsskaCenter }) {
    const router = useRouter();
    const [form, setForm] = useState<FormState>({
        ...leereForm,
        saison: center?.saison ?? defaultSaison(),
        name: center?.name ?? "",
        stadt: center?.stadt ?? "",
        kuerzel: center?.kuerzel ?? "",
        kategorie: center?.kategorie ?? "A",
        start_datum: center?.start_datum ?? "",
        end_datum: center?.end_datum ?? "",
        flaeche_position: center?.flaeche_position ?? "",
        laenge_m: center?.laenge_m?.toString() ?? "",
        breite_m: center?.breite_m?.toString() ?? "",
        flaeche_qm_override: center?.flaeche_qm?.toString() ?? "",
        mietdauer_tage_override: center?.mietdauer_tage?.toString() ?? "",
        miete_euro: center?.miete_eur_cent ? centToEuro(center.miete_eur_cent) : "",
        status: center?.status ?? "geplant",
        notiz: center?.notiz ?? "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const flaecheAuto = useMemo(() => {
        const l = parseFloat(form.laenge_m.replace(",", "."));
        const b = parseFloat(form.breite_m.replace(",", "."));
        if (!Number.isFinite(l) || !Number.isFinite(b)) return "";
        return (l * b).toFixed(2);
    }, [form.laenge_m, form.breite_m]);

    const tageAuto = useMemo(() => {
        if (!form.start_datum || !form.end_datum) return "";
        const start = new Date(form.start_datum);
        const ende = new Date(form.end_datum);
        if (Number.isNaN(start.getTime()) || Number.isNaN(ende.getTime())) return "";
        const diff = Math.round((ende.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return diff > 0 ? diff.toString() : "";
    }, [form.start_datum, form.end_datum]);

    const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const client = await getEsskaClient();

            const payload = {
                saison: form.saison.trim(),
                name: form.name.trim(),
                stadt: form.stadt.trim(),
                kuerzel: form.kuerzel.trim().toUpperCase(),
                kategorie: form.kategorie,
                start_datum: form.start_datum,
                end_datum: form.end_datum,
                flaeche_position: form.flaeche_position.trim() || null,
                laenge_m: form.laenge_m ? parseFloat(form.laenge_m.replace(",", ".")) : null,
                breite_m: form.breite_m ? parseFloat(form.breite_m.replace(",", ".")) : null,
                flaeche_qm: form.flaeche_qm_override
                    ? parseFloat(form.flaeche_qm_override.replace(",", "."))
                    : null,
                mietdauer_tage: form.mietdauer_tage_override
                    ? parseInt(form.mietdauer_tage_override, 10)
                    : null,
                miete_eur_cent: euroToCent(form.miete_euro),
                status: form.status,
                notiz: form.notiz.trim() || null,
            };

            if (center) {
                const { error: e } = await client
                    .from("centers")
                    .update(payload)
                    .eq("id", center.id);
                if (e) throw e;
                router.push(`/app/centers/${center.id}`);
            } else {
                const { data, error: e } = await client
                    .from("centers")
                    .insert(payload)
                    .select("id")
                    .single();
                if (e) throw e;
                router.push(`/app/centers/${data.id}`);
            }
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
            {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                    {error}
                </div>
            )}

            <Section titel="Stammdaten">
                <Grid>
                    <Field label="Saison" required>
                        <input
                            value={form.saison}
                            onChange={(e) => update("saison", e.target.value)}
                            placeholder="26/27"
                            required
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Kategorie" required>
                        <select
                            value={form.kategorie}
                            onChange={(e) => update("kategorie", e.target.value as EsskaCenterKategorie)}
                            className={inputCls}
                        >
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                        </select>
                    </Field>
                    <Field label="Kürzel" required hint="z. B. EAGH, CGA">
                        <input
                            value={form.kuerzel}
                            onChange={(e) => update("kuerzel", e.target.value)}
                            required
                            maxLength={6}
                            className={`${inputCls} font-mono uppercase`}
                        />
                    </Field>
                    <Field label="Status" required>
                        <select
                            value={form.status}
                            onChange={(e) => update("status", e.target.value as EsskaCenterStatus)}
                            className={inputCls}
                        >
                            <option value="geplant">geplant</option>
                            <option value="aktiv">aktiv</option>
                            <option value="abgeschlossen">abgeschlossen</option>
                        </select>
                    </Field>
                    <Field label="Center-Name" required full>
                        <input
                            value={form.name}
                            onChange={(e) => update("name", e.target.value)}
                            placeholder="Ernst-August-Galerie"
                            required
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Stadt" required>
                        <input
                            value={form.stadt}
                            onChange={(e) => update("stadt", e.target.value)}
                            required
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Position auf der Fläche" hint="z. B. EG 010 f,g,h,i">
                        <input
                            value={form.flaeche_position}
                            onChange={(e) => update("flaeche_position", e.target.value)}
                            className={inputCls}
                        />
                    </Field>
                </Grid>
            </Section>

            <Section titel="Zeitraum & Fläche">
                <Grid>
                    <Field label="Start" required>
                        <input
                            type="date"
                            value={form.start_datum}
                            onChange={(e) => update("start_datum", e.target.value)}
                            required
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Ende" required>
                        <input
                            type="date"
                            value={form.end_datum}
                            onChange={(e) => update("end_datum", e.target.value)}
                            required
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Länge (m)">
                        <input
                            value={form.laenge_m}
                            onChange={(e) => update("laenge_m", e.target.value)}
                            inputMode="decimal"
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Breite (m)">
                        <input
                            value={form.breite_m}
                            onChange={(e) => update("breite_m", e.target.value)}
                            inputMode="decimal"
                            className={inputCls}
                        />
                    </Field>
                    <Field
                        label="Fläche (m²)"
                        hint={
                            flaecheAuto
                                ? `automatisch: ${flaecheAuto} m² (frei lassen, um zu übernehmen)`
                                : "frei lassen für automatische Berechnung"
                        }
                    >
                        <input
                            value={form.flaeche_qm_override}
                            onChange={(e) => update("flaeche_qm_override", e.target.value)}
                            placeholder={flaecheAuto}
                            inputMode="decimal"
                            className={inputCls}
                        />
                    </Field>
                    <Field
                        label="Mietdauer (Tage)"
                        hint={
                            tageAuto
                                ? `automatisch: ${tageAuto} Tage (frei lassen, um zu übernehmen)`
                                : "frei lassen für automatische Berechnung"
                        }
                    >
                        <input
                            value={form.mietdauer_tage_override}
                            onChange={(e) => update("mietdauer_tage_override", e.target.value)}
                            placeholder={tageAuto}
                            inputMode="numeric"
                            className={inputCls}
                        />
                    </Field>
                </Grid>
            </Section>

            <Section titel="Miete & Notiz">
                <Grid>
                    <Field label="Saisonmiete (€)" required hint="Gesamtbetrag, z. B. 18052,30">
                        <input
                            value={form.miete_euro}
                            onChange={(e) => update("miete_euro", e.target.value)}
                            required
                            inputMode="decimal"
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Notiz" full>
                        <textarea
                            value={form.notiz}
                            onChange={(e) => update("notiz", e.target.value)}
                            rows={3}
                            className={inputCls}
                        />
                    </Field>
                </Grid>
            </Section>

            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                    {saving ? "Speichern…" : center ? "Änderungen speichern" : "Center anlegen"}
                </button>
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                    Abbrechen
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
            <h2 className="text-lg font-semibold mb-3">{titel}</h2>
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
