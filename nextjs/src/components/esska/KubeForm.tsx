"use client";

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import type {
    EsskaKubeAlgLeistung,
    EsskaKubeBegrenzung,
    EsskaKubeDeclaration,
    EsskaKubeLebensunterhalt,
    EsskaKubeStatus,
    EsskaKubeVorbeschaeftigung,
} from "@/lib/esska/types";
import {
    KUBE_LEBENSUNTERHALT_LABELS,
    KUBE_STATUS_LABELS,
    centToEuro,
    euroToCent,
} from "@/lib/esska/types";

const MONATE = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
];

type VorbeschaeftigungForm = {
    arbeitgeber: string;
    zeitraum: string;
    arbeitstage: string;
    verdienst_euro: string;
};

type Props = {
    profileId: string;
    saison: string;
    existing?: EsskaKubeDeclaration | null;
    onSaved: (k: EsskaKubeDeclaration) => void;
};

export default function KubeForm({ profileId, saison, existing, onSaved }: Props) {
    const [begrenzung, setBegrenzung] = useState<EsskaKubeBegrenzung>(existing?.begrenzung ?? "70_arbeitstage");
    const [status, setStatus] = useState<EsskaKubeStatus | "">(existing?.erwerbsstatus ?? "");
    const [statusSonstiges, setStatusSonstiges] = useState(existing?.erwerbsstatus_sonstiges ?? "");
    const [bafoeg, setBafoeg] = useState<boolean | null>(existing?.bafoeg_bezug ?? null);
    const [arbeitgeber, setArbeitgeber] = useState(existing?.aktueller_arbeitgeber ?? "");
    const [verdienstEuro, setVerdienstEuro] = useState(
        existing?.aktueller_verdienst_eur_cent ? centToEuro(existing.aktueller_verdienst_eur_cent) : ""
    );
    const [algLeistung, setAlgLeistung] = useState<EsskaKubeAlgLeistung | "">(existing?.arbeitslosen_leistung ?? "");
    const [lebensunterhalt, setLebensunterhalt] = useState<EsskaKubeLebensunterhalt | "">(existing?.lebensunterhalt ?? "");
    const [lebensunterhaltSonstiges, setLebensunterhaltSonstiges] = useState(existing?.lebensunterhalt_sonstiges ?? "");
    const [monate, setMonate] = useState<number[]>(existing?.monate_ueber_geringfuegigkeit ?? []);
    const [vorbeschaeftigungen, setVorbeschaeftigungen] = useState<VorbeschaeftigungForm[]>(
        (existing?.weitere_kurzfristige_beschaeftigungen ?? []).map((v) => ({
            arbeitgeber: v.arbeitgeber,
            zeitraum: v.zeitraum,
            arbeitstage: v.arbeitstage.toString(),
            verdienst_euro: centToEuro(v.verdienst_eur_cent),
        }))
    );
    const [erkZeitgrenze, setErkZeitgrenze] = useState(existing?.erklaerung_zeitgrenze ?? false);
    const [erkNichtberufsmaessig, setErkNichtberufsmaessig] = useState(existing?.erklaerung_nichtberufsmaessig ?? false);
    const [verpflichtung, setVerpflichtung] = useState(existing?.verpflichtung_mitteilung ?? false);
    const [nachweis, setNachweis] = useState(existing?.nachweis_zustimmung ?? false);
    const [ort, setOrt] = useState(existing?.unterzeichnet_ort ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const istSchuelerStudent = status === "schueler" || status === "student";
    const istArbeitnehmer = status === "arbeitnehmer_teilzeit" || status === "arbeitnehmer_vollzeit";
    const istArbeitssuchend = status === "arbeitssuchend";

    const toggleMonat = (m: number) => {
        setMonate((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)));
    };

    const addVorbeschaeftigung = () => {
        setVorbeschaeftigungen((prev) => [...prev, { arbeitgeber: "", zeitraum: "", arbeitstage: "", verdienst_euro: "" }]);
    };

    const updateVorbeschaeftigung = (i: number, key: keyof VorbeschaeftigungForm, value: string) => {
        setVorbeschaeftigungen((prev) => prev.map((v, idx) => (idx === i ? { ...v, [key]: value } : v)));
    };

    const removeVorbeschaeftigung = (i: number) => {
        setVorbeschaeftigungen((prev) => prev.filter((_, idx) => idx !== i));
    };

    const alleErklaerungenBestaetigt = erkZeitgrenze && erkNichtberufsmaessig && verpflichtung && nachweis;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!status || !lebensunterhalt) {
            setError("Bitte Erwerbsstatus und Lebensunterhalt auswählen.");
            return;
        }
        if (!alleErklaerungenBestaetigt) {
            setError("Bitte alle vier Erklärungen bestätigen.");
            return;
        }
        if (!ort.trim()) {
            setError("Bitte den Ort der Unterzeichnung angeben.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const client = await getEsskaClient();
            const payload = {
                profile_id: profileId,
                saison,
                begrenzung,
                erwerbsstatus: status,
                erwerbsstatus_sonstiges: status === "sonstiges" ? statusSonstiges.trim() || null : null,
                bafoeg_bezug: istSchuelerStudent ? bafoeg : null,
                aktueller_arbeitgeber: istArbeitnehmer ? arbeitgeber.trim() || null : null,
                aktueller_verdienst_eur_cent: istArbeitnehmer && verdienstEuro ? euroToCent(verdienstEuro) : null,
                arbeitslosen_leistung: istArbeitssuchend ? (algLeistung || null) : null,
                lebensunterhalt,
                lebensunterhalt_sonstiges: lebensunterhalt === "sonstiges" ? lebensunterhaltSonstiges.trim() || null : null,
                monate_ueber_geringfuegigkeit: monate,
                weitere_kurzfristige_beschaeftigungen: vorbeschaeftigungen
                    .filter((v) => v.arbeitgeber.trim())
                    .map<EsskaKubeVorbeschaeftigung>((v) => ({
                        arbeitgeber: v.arbeitgeber.trim(),
                        zeitraum: v.zeitraum.trim(),
                        arbeitstage: parseInt(v.arbeitstage, 10) || 0,
                        verdienst_eur_cent: euroToCent(v.verdienst_euro),
                    })),
                erklaerung_zeitgrenze: erkZeitgrenze,
                erklaerung_nichtberufsmaessig: erkNichtberufsmaessig,
                verpflichtung_mitteilung: verpflichtung,
                nachweis_zustimmung: nachweis,
                unterzeichnet_am: new Date().toISOString(),
                unterzeichnet_ort: ort.trim(),
            };

            const { data, error: e } = existing
                ? await client.from("kube_declarations").update(payload).eq("id", existing.id).select("*").single()
                : await client.from("kube_declarations").insert(payload).select("*").single();
            if (e) throw e;
            onSaved(data as EsskaKubeDeclaration);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

            <Section titel="Geplante kurzfristige Beschäftigung">
                <p className="text-sm text-gray-600 mb-2">Die Beschäftigung ist im Voraus vertraglich begrenzt auf:</p>
                <div className="flex gap-6">
                    <Radio
                        name="begrenzung"
                        checked={begrenzung === "3_monate"}
                        onChange={() => setBegrenzung("3_monate")}
                        label="maximal 3 Monate"
                    />
                    <Radio
                        name="begrenzung"
                        checked={begrenzung === "70_arbeitstage"}
                        onChange={() => setBegrenzung("70_arbeitstage")}
                        label="maximal 70 Arbeitstage"
                    />
                </div>
            </Section>

            <Section titel="Aktueller Erwerbs- bzw. Lebensstatus">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(Object.keys(KUBE_STATUS_LABELS) as EsskaKubeStatus[]).map((s) => (
                        <Radio
                            key={s}
                            name="erwerbsstatus"
                            checked={status === s}
                            onChange={() => setStatus(s)}
                            label={KUBE_STATUS_LABELS[s]}
                        />
                    ))}
                </div>
                {status === "sonstiges" && (
                    <input
                        value={statusSonstiges}
                        onChange={(e) => setStatusSonstiges(e.target.value)}
                        placeholder="Bitte angeben…"
                        className={`${inputCls} mt-2`}
                    />
                )}

                {istSchuelerStudent && (
                    <div className="mt-4 p-3 bg-primary-50 rounded-md">
                        <p className="text-sm font-medium mb-2">Da du Schüler/Student bist:</p>
                        <div className="flex gap-6">
                            <Radio name="bafoeg" checked={bafoeg === true} onChange={() => setBafoeg(true)} label="Ich beziehe BAföG" />
                            <Radio name="bafoeg" checked={bafoeg === false} onChange={() => setBafoeg(false)} label="Ich beziehe kein BAföG" />
                        </div>
                    </div>
                )}

                {istArbeitnehmer && (
                    <div className="mt-4 p-3 bg-primary-50 rounded-md grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Aktueller Arbeitgeber</label>
                            <input value={arbeitgeber} onChange={(e) => setArbeitgeber(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Monatlicher Verdienst (€)</label>
                            <input value={verdienstEuro} onChange={(e) => setVerdienstEuro(e.target.value)} inputMode="decimal" className={inputCls} />
                        </div>
                    </div>
                )}

                {istArbeitssuchend && (
                    <div className="mt-4 p-3 bg-primary-50 rounded-md space-y-2">
                        <p className="text-sm font-medium">Da du arbeitssuchend gemeldet bist:</p>
                        <Radio name="alg" checked={algLeistung === "sgb_iii"} onChange={() => setAlgLeistung("sgb_iii")} label="Ich beziehe Leistungen nach SGB III (Arbeitslosengeld I)" />
                        <Radio name="alg" checked={algLeistung === "sgb_ii"} onChange={() => setAlgLeistung("sgb_ii")} label="Ich beziehe Leistungen nach SGB II (Bürgergeld)" />
                        <Radio name="alg" checked={algLeistung === "keine"} onChange={() => setAlgLeistung("keine")} label="Ich beziehe keine Leistungen" />
                    </div>
                )}
            </Section>

            <Section titel="Bestreitung des überwiegenden Lebensunterhalts">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(Object.keys(KUBE_LEBENSUNTERHALT_LABELS) as EsskaKubeLebensunterhalt[]).map((l) => (
                        <Radio
                            key={l}
                            name="lebensunterhalt"
                            checked={lebensunterhalt === l}
                            onChange={() => setLebensunterhalt(l)}
                            label={KUBE_LEBENSUNTERHALT_LABELS[l]}
                        />
                    ))}
                </div>
                {lebensunterhalt === "sonstiges" && (
                    <input
                        value={lebensunterhaltSonstiges}
                        onChange={(e) => setLebensunterhaltSonstiges(e.target.value)}
                        placeholder="Bitte angeben…"
                        className={`${inputCls} mt-2`}
                    />
                )}
            </Section>

            <Section titel="Beschäftigungen über der Geringfügigkeitsgrenze im aktuellen Kalenderjahr">
                <p className="text-sm text-gray-600 mb-2">
                    In welchen Monaten hast du dieses Jahr mehr als die Geringfügigkeitsgrenze verdient?
                    Nichts ankreuzen = in keinem Monat.
                </p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {MONATE.map((m, i) => (
                        <label key={m} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={monate.includes(i + 1)} onChange={() => toggleMonat(i + 1)} />
                            {m}
                        </label>
                    ))}
                </div>
            </Section>

            <Section titel="Weitere kurzfristige Beschäftigungen im laufenden Kalenderjahr">
                {vorbeschaeftigungen.length === 0 && (
                    <p className="text-sm text-gray-500">Keine erfasst – falls vorhanden, bitte hinzufügen.</p>
                )}
                <div className="space-y-3">
                    {vorbeschaeftigungen.map((v, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end border rounded-md p-3">
                            <div className="md:col-span-2">
                                <label className="block text-xs text-gray-500 mb-1">Arbeitgeber</label>
                                <input value={v.arbeitgeber} onChange={(e) => updateVorbeschaeftigung(i, "arbeitgeber", e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Zeitraum</label>
                                <input value={v.zeitraum} onChange={(e) => updateVorbeschaeftigung(i, "zeitraum", e.target.value)} placeholder="01.02.–15.03." className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Arbeitstage</label>
                                <input value={v.arbeitstage} onChange={(e) => updateVorbeschaeftigung(i, "arbeitstage", e.target.value)} inputMode="numeric" className={inputCls} />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-500 mb-1">Verdienst (€)</label>
                                    <input value={v.verdienst_euro} onChange={(e) => updateVorbeschaeftigung(i, "verdienst_euro", e.target.value)} inputMode="decimal" className={inputCls} />
                                </div>
                                <button type="button" onClick={() => removeVorbeschaeftigung(i)} className="text-red-600 pb-2">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={addVorbeschaeftigung}
                    className="mt-3 inline-flex items-center text-sm text-primary-600 hover:underline"
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Beschäftigung hinzufügen
                </button>
            </Section>

            <Section titel="Erklärungen (alle Pflicht)">
                <div className="space-y-3 text-sm">
                    <Check checked={erkZeitgrenze} onChange={setErkZeitgrenze}>
                        Mir ist bekannt, dass alle kurzfristigen Beschäftigungen innerhalb eines Kalenderjahres
                        zusammenzurechnen sind und die Grenze von maximal 3 Monaten oder 70 Arbeitstagen pro
                        Kalenderjahr nicht überschritten werden darf.
                    </Check>
                    <Check checked={erkNichtberufsmaessig} onChange={setErkNichtberufsmaessig}>
                        Ich bestätige, dass diese Beschäftigung ausschließlich als vorübergehende Nebentätigkeit dient,
                        ich meinen überwiegenden Lebensunterhalt nicht aus dieser Beschäftigung bestreite und sie keine
                        reguläre, auf Dauer angelegte Erwerbstätigkeit ersetzt. Mir ist bekannt, dass bei falschen oder
                        unvollständigen Angaben eine nachträgliche Sozialversicherungspflicht entstehen kann.
                    </Check>
                    <Check checked={verpflichtung} onChange={setVerpflichtung}>
                        Ich verpflichte mich, jede weitere kurzfristige Beschäftigung im Kalenderjahr sowie jede Änderung
                        meines Status (z. B. Studienabbruch, Aufnahme Vollzeitbeschäftigung) unverzüglich mitzuteilen.
                    </Check>
                    <Check checked={nachweis} onChange={setNachweis}>
                        Ich erkläre mich damit einverstanden, auf Anforderung geeignete Statusnachweise vorzulegen
                        (z. B. Immatrikulationsbescheinigung, Schulbescheinigung, Rentenbescheid, Gewerbeanmeldung).
                    </Check>
                </div>
            </Section>

            <Section titel="Unterzeichnung">
                <div className="max-w-sm">
                    <label className="block text-sm font-medium mb-1">Ort</label>
                    <input value={ort} onChange={(e) => setOrt(e.target.value)} placeholder="z. B. Dresden" className={inputCls} />
                    <p className="text-xs text-gray-500 mt-2">
                        Mit dem Absenden wird das Datum automatisch gesetzt. Die Erklärung gilt als digital unterzeichnet.
                    </p>
                </div>
            </Section>

            <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
                {saving ? "Speichern…" : "Statuserklärung abgeben"}
            </button>
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

function Radio({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: () => void; label: string }) {
    return (
        <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-0.5" />
            {label}
        </label>
    );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
    return (
        <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
            <span>{children}</span>
        </label>
    );
}
