"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter, EsskaCenterKategorie, EsskaCenterOpeningHour, EsskaCenterZeitraum, EsskaProfile } from "@/lib/esska/types";
import { WOCHENTAG_LABELS, berechneCenterStatus, centToEuro, euroToCent } from "@/lib/esska/types";

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
    // C-5: Status wird berechnet - manuell bleibt nur "In Absprache"
    in_absprache: boolean;
    manager_id: string;
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
    in_absprache: false,
    manager_id: "",
    notiz: "",
};

// C-7/C-8: ein Eintrag je Wochentag (0 = Montag ... 6 = Sonntag).
// Standard: Mo-Sa geoeffnet, So geschlossen (Ausnahmen wie Leipzig setzt
// der Admin einfach per Haken). Ohne Zeiten gelten die Slot-Standardzeiten.
type OeffnungState = { geoeffnet: boolean; oeffnet: string; schliesst: string };

const standardOeffnung = (): OeffnungState[] =>
    Array.from({ length: 7 }, (_, i) => ({
        geoeffnet: i !== 6,
        oeffnet: "",
        schliesst: "",
    }));

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
        in_absprache: center?.status === "in_absprache",
        manager_id: center?.manager_id ?? "",
        notiz: center?.notiz ?? "",
    });
    const [oeffnung, setOeffnung] = useState<OeffnungState[]>(standardOeffnung());
    const [zeitraeume, setZeitraeume] = useState<EsskaCenterZeitraum[]>([]);
    const [manager, setManager] = useState<Pick<EsskaProfile, "id" | "vorname" | "nachname" | "email">[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Manager-Kandidaten (Admins + Regionalmanager) und - beim Bearbeiten -
    // die gespeicherten Oeffnungszeiten laden
    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const { data: mData } = await client
                    .from("profiles")
                    .select("id, vorname, nachname, email")
                    .in("role", ["admin", "regionalmanager"])
                    .order("nachname");
                setManager((mData as typeof manager) ?? []);

                if (center) {
                    const { data: zData } = await client
                        .from("center_zeitraeume")
                        .select("*")
                        .eq("center_id", center.id);
                    setZeitraeume((zData as EsskaCenterZeitraum[]) ?? []);

                    const { data: oData } = await client
                        .from("center_opening_hours")
                        .select("*")
                        .eq("center_id", center.id);
                    const rows = (oData as EsskaCenterOpeningHour[]) ?? [];
                    if (rows.length > 0) {
                        setOeffnung(
                            Array.from({ length: 7 }, (_, i) => {
                                const r = rows.find((x) => x.wochentag === i);
                                return {
                                    geoeffnet: r?.geoeffnet ?? i !== 6,
                                    oeffnet: r?.oeffnet ? r.oeffnet.slice(0, 5) : "",
                                    schliesst: r?.schliesst ? r.schliesst.slice(0, 5) : "",
                                };
                            })
                        );
                    }
                }
            } catch {
                // Nicht kritisch - Formular bleibt nutzbar, Fehler zeigt sich beim Speichern
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [center?.id]);

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

            // C-5: Status automatisch aus dem Zeitraum ableiten; nur
            // "In Absprache" ist eine manuelle Entscheidung.
            // Grundlage: der Miet-Zeitraum aus dem Formular plus alle bereits
            // gespeicherten Verlaengerungen (damit ein verlaengertes Center
            // beim Bearbeiten nicht faelschlich auf "Beendet" faellt).
            const formularZeitraum: EsskaCenterZeitraum = {
                id: "",
                center_id: "",
                typ: "miete",
                von: form.start_datum,
                bis: form.end_datum || null,
                notiz: null,
                created_at: "",
            };
            const status = form.in_absprache
                ? "in_absprache"
                : berechneCenterStatus("geplant", [
                      formularZeitraum,
                      ...zeitraeume.filter((z) => z.typ === "verlaengerung"),
                  ]);

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
                status,
                manager_id: form.manager_id || null,
                notiz: form.notiz.trim() || null,
            };

            let centerId: string;
            if (center) {
                const { error: e } = await client
                    .from("centers")
                    .update(payload)
                    .eq("id", center.id);
                if (e) throw e;
                centerId = center.id;
            } else {
                const { data, error: e } = await client
                    .from("centers")
                    .insert(payload)
                    .select("id")
                    .single();
                if (e) throw e;
                centerId = (data as { id: string }).id;
            }

            // Miet-Zeitraum synchron halten (S-5): den 'miete'-Eintrag auf die
            // Formulardaten setzen bzw. anlegen. Verlaengerungen bleiben unberuehrt.
            const mieteVorhanden = zeitraeume.find((z) => z.typ === "miete");
            if (mieteVorhanden) {
                const { error: zErr } = await client
                    .from("center_zeitraeume")
                    .update({ von: form.start_datum, bis: form.end_datum || null })
                    .eq("id", mieteVorhanden.id);
                if (zErr) throw zErr;
            } else {
                const { error: zErr } = await client
                    .from("center_zeitraeume")
                    .insert({ center_id: centerId, typ: "miete", von: form.start_datum, bis: form.end_datum || null });
                if (zErr) throw zErr;
            }

            // Oeffnungszeiten speichern (C-7/C-8): ein Datensatz je Wochentag
            const { error: oErr } = await client.from("center_opening_hours").upsert(
                oeffnung.map((o, wochentag) => ({
                    center_id: centerId,
                    wochentag,
                    geoeffnet: o.geoeffnet,
                    oeffnet: o.geoeffnet && o.oeffnet ? o.oeffnet : null,
                    schliesst: o.geoeffnet && o.schliesst ? o.schliesst : null,
                })),
                { onConflict: "center_id,wochentag" }
            );
            if (oErr) throw oErr;

            router.push(`/app/centers/${centerId}`);
            router.refresh();
        } catch (err) {
            setError(friendlyError(err, { aktion: center ? "Center aktualisieren" : "Center anlegen", entitaet: "Center" }));
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
                    <Field
                        label="Status"
                        hint="Geplant/Aktiv/Beendet wird automatisch aus dem Zeitraum berechnet. Haken setzen, solange der Vertrag noch verhandelt wird."
                    >
                        <label className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.in_absprache}
                                onChange={(e) => update("in_absprache", e.target.checked)}
                            />
                            In Absprache (noch nicht fix)
                        </label>
                    </Field>
                    <Field label="Regionalmanager" hint="Sieht und plant nur die eigenen Center.">
                        <select
                            value={form.manager_id}
                            onChange={(e) => update("manager_id", e.target.value)}
                            className={inputCls}
                        >
                            <option value="">– kein Manager –</option>
                            {manager.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {`${m.vorname ?? ""} ${m.nachname ?? ""}`.trim() || (m.email ?? "?")}
                                </option>
                            ))}
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

            <Section titel="Öffnungstage & -zeiten">
                <p className="text-xs text-gray-500 mb-3">
                    Ohne Uhrzeiten gelten die Standard-Slotzeiten (09:00–15:00 / 15:00–20:30).
                    Geschlossene Tage sind im Verfügbarkeits- und Schichtplan nicht wählbar.
                </p>
                <div className="space-y-2">
                    {oeffnung.map((o, i) => (
                        <div key={i} className="flex items-center gap-3 flex-wrap">
                            <label className="flex items-center gap-2 w-32 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={o.geoeffnet}
                                    onChange={(e) =>
                                        setOeffnung((prev) =>
                                            prev.map((x, j) => (j === i ? { ...x, geoeffnet: e.target.checked } : x))
                                        )
                                    }
                                />
                                {WOCHENTAG_LABELS[i]}
                            </label>
                            {o.geoeffnet ? (
                                <div className="flex items-center gap-2 text-sm">
                                    <input
                                        type="time"
                                        step={900}
                                        value={o.oeffnet}
                                        onChange={(e) =>
                                            setOeffnung((prev) =>
                                                prev.map((x, j) => (j === i ? { ...x, oeffnet: e.target.value } : x))
                                            )
                                        }
                                        className="border rounded px-2 py-1 text-sm"
                                    />
                                    <span>–</span>
                                    <input
                                        type="time"
                                        step={900}
                                        value={o.schliesst}
                                        onChange={(e) =>
                                            setOeffnung((prev) =>
                                                prev.map((x, j) => (j === i ? { ...x, schliesst: e.target.value } : x))
                                            )
                                        }
                                        className="border rounded px-2 py-1 text-sm"
                                    />
                                    {!o.oeffnet && !o.schliesst && (
                                        <span className="text-xs text-gray-400">Standardzeiten</span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-sm text-gray-400">geschlossen</span>
                            )}
                        </div>
                    ))}
                </div>
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
