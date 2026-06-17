"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter } from "@/lib/esska/types";
import { isoDatum } from "@/lib/esska/types";

const BUCKET = "sales-receipts";
const MAX_BYTES = 10 * 1024 * 1024;
const ERLAUBTE_TYPEN = ["image/jpeg", "image/png", "image/webp", "image/heic"];

// 15-Minuten-Schritte von 08:00 bis 21:00
const ZEIT_OPTIONEN: string[] = (() => {
    const arr: string[] = [];
    for (let h = 8; h <= 21; h++) {
        for (let m = 0; m < 60; m += 15) {
            if (h === 21 && m > 0) continue;
            arr.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
        }
    }
    return arr;
})();

export default function SalesEntryPage() {
    const router = useRouter();
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [centerId, setCenterId] = useState("");
    const [datum, setDatum] = useState(isoDatum(new Date()));
    const [istAdmin, setIstAdmin] = useState(false);
    const [notiz, setNotiz] = useState("");
    const [arbeitsStart, setArbeitsStart] = useState("");
    const [arbeitsEnde, setArbeitsEnde] = useState("");
    const [umsatzStart, setUmsatzStart] = useState("");
    const [umsatzEnde, setUmsatzEnde] = useState("");
    const [fotoFile, setFotoFile] = useState<File | null>(null);
    const [fotoPreview, setFotoPreview] = useState<string | null>(null);
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
                    // Auto-Vorauswahl: wenn nur 1 Center, direkt setzen.
                    // (Sonderfall Hamburg: 4 Center -> Auswahl-Dropdown bleibt sichtbar)
                    if (cs.length === 1) setCenterId(cs[0].id);
                    else if (cs[0]) setCenterId(cs[0].id);
                }
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            }
        };
        load();
    }, []);

    const handleFile = (file: File) => {
        setError(null);
        if (file.size > MAX_BYTES) {
            setError("Datei zu groß (max. 10 MB).");
            return;
        }
        if (!ERLAUBTE_TYPEN.includes(file.type)) {
            setError("Bitte ein Foto im JPG-, PNG-, WebP- oder HEIC-Format wählen.");
            return;
        }
        setFotoFile(file);
        if (fotoPreview) URL.revokeObjectURL(fotoPreview);
        setFotoPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!centerId || !datum) {
            setError("Center und Datum sind Pflicht.");
            return;
        }
        if (!fotoFile && !istAdmin) {
            setError("Bitte ein Foto der Verkaufsliste hochladen.");
            return;
        }
        if (arbeitsStart && arbeitsEnde && arbeitsEnde <= arbeitsStart) {
            setError("Die Arbeitszeit-Endzeit muss nach der Startzeit liegen.");
            return;
        }
        if (umsatzStart && umsatzEnde && umsatzEnde <= umsatzStart) {
            setError("Die Umsatzzeit-Endzeit muss nach der Startzeit liegen.");
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const client = await getEsskaClient();
            const { data: { user } } = await client.auth.getUser();
            if (!user) throw new Error("Nicht angemeldet");

            let fotoPath: string | null = null;
            if (fotoFile) {
                const ext = fotoFile.name.split(".").pop() ?? "jpg";
                fotoPath = `${centerId}/${datum}/${Date.now()}.${ext}`;
                const { error: upErr } = await client.storage.from(BUCKET).upload(fotoPath, fotoFile, {
                    cacheControl: "3600",
                    upsert: true,
                });
                if (upErr) throw upErr;
            }

            const { error: e } = await client.from("daily_sales").upsert(
                {
                    center_id: centerId,
                    datum,
                    notiz: notiz.trim() || null,
                    arbeitszeit_start: arbeitsStart || null,
                    arbeitszeit_ende: arbeitsEnde || null,
                    umsatz_start: umsatzStart || null,
                    umsatz_ende: umsatzEnde || null,
                    beleg_foto_path: fotoPath,
                    erfasst_von: user.id,
                },
                { onConflict: "center_id,datum" }
            );
            if (e) throw e;

            setSuccess("Umsatz-Eintrag gespeichert.");
            setNotiz("");
            setArbeitsStart("");
            setArbeitsEnde("");
            setUmsatzStart("");
            setUmsatzEnde("");
            setFotoFile(null);
            if (fotoPreview) URL.revokeObjectURL(fotoPreview);
            setFotoPreview(null);
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
                    Pro Center und Tag genau ein Eintrag. Foto der Verkaufsliste + Arbeits- und Umsatzzeit reichen aus –
                    der Admin liest die Beträge später aus dem Foto aus.
                </p>
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

                {/* Foto-Upload */}
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Foto von Verkaufsliste {!istAdmin && <span className="text-red-500">*</span>}
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs text-gray-500 mb-2">So sollte dein Foto aussehen:</p>
                            <div className="border-2 border-dashed border-secondary-300 rounded-md p-6 text-center bg-secondary-50">
                                <ImageIcon className="h-10 w-10 mx-auto text-secondary-400" />
                                <p className="text-xs text-gray-500 mt-2">
                                    Vorlage-Platzhalter
                                    <br />
                                    (Beispielbild folgt)
                                </p>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-2">Dein Foto:</p>
                            {fotoPreview ? (
                                <div className="relative">
                                    <Image
                                        src={fotoPreview}
                                        alt="Vorschau"
                                        width={400}
                                        height={300}
                                        unoptimized
                                        className="w-full rounded-md border object-cover max-h-64"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (fotoPreview) URL.revokeObjectURL(fotoPreview);
                                            setFotoFile(null);
                                            setFotoPreview(null);
                                        }}
                                        className="absolute top-2 right-2 bg-white border rounded-full p-1 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <label className="inline-flex items-center justify-center px-3 py-3 bg-primary-600 text-white rounded-md cursor-pointer text-sm hover:bg-primary-700">
                                        <Camera className="h-4 w-4 mr-2" />
                                        Foto aufnehmen
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) handleFile(f);
                                                e.target.value = "";
                                            }}
                                        />
                                    </label>
                                    <label className="inline-flex items-center justify-center px-3 py-2 border rounded-md cursor-pointer text-sm hover:bg-secondary-50">
                                        <Upload className="h-4 w-4 mr-2" />
                                        Aus Galerie wählen
                                        <input
                                            type="file"
                                            accept={ERLAUBTE_TYPEN.join(",")}
                                            className="hidden"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) handleFile(f);
                                                e.target.value = "";
                                            }}
                                        />
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Arbeitszeit */}
                <div>
                    <label className="block text-sm font-medium mb-1">Arbeits-Zeit (15-Minuten-Schritte)</label>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Von</label>
                            <select
                                value={arbeitsStart}
                                onChange={(e) => setArbeitsStart(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            >
                                <option value="">– wählen –</option>
                                {ZEIT_OPTIONEN.map((z) => (
                                    <option key={z} value={z}>{z}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Bis</label>
                            <select
                                value={arbeitsEnde}
                                onChange={(e) => setArbeitsEnde(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            >
                                <option value="">– wählen –</option>
                                {ZEIT_OPTIONEN.map((z) => (
                                    <option key={z} value={z}>{z}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Umsatzzeit */}
                <div>
                    <label className="block text-sm font-medium mb-1">Umsatz-Zeit (15-Minuten-Schritte)</label>
                    <p className="text-xs text-gray-500 mb-1">
                        Zeitraum, in dem die Umsätze tatsächlich erzielt wurden (steht so auf der Verkaufsliste).
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Von</label>
                            <select
                                value={umsatzStart}
                                onChange={(e) => setUmsatzStart(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            >
                                <option value="">– wählen –</option>
                                {ZEIT_OPTIONEN.map((z) => (
                                    <option key={z} value={z}>{z}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Bis</label>
                            <select
                                value={umsatzEnde}
                                onChange={(e) => setUmsatzEnde(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            >
                                <option value="">– wählen –</option>
                                {ZEIT_OPTIONEN.map((z) => (
                                    <option key={z} value={z}>{z}</option>
                                ))}
                            </select>
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

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                        {saving ? "Speichern…" : "Speichern"}
                    </button>
                    <button type="button" onClick={() => router.push("/app/sales")} className="px-4 py-2 border rounded-md hover:bg-secondary-100">
                        Abbrechen
                    </button>
                </div>
            </form>
        </div>
    );
}
