"use client";

import React, { useEffect, useState } from "react";
import { Trash2, Upload, FileCheck, Download, Camera } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaDokumentTyp, EsskaEmployeeDocument } from "@/lib/esska/types";
import { DOKUMENT_TYP_LABELS } from "@/lib/esska/types";

const BUCKET = "employee-documents";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ERLAUBTE_TYPEN = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

type Props = {
    profileId: string;
    /** Dokumenttypen, die prominent als Pflicht angezeigt werden */
    pflicht?: EsskaDokumentTyp[];
    onChanged?: (docs: EsskaEmployeeDocument[]) => void;
};

export default function DokumenteUpload({ profileId, pflicht = ["ausweis_vorderseite", "ausweis_rueckseite"], onChanged }: Props) {
    const [docs, setDocs] = useState<EsskaEmployeeDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadTyp, setUploadTyp] = useState<EsskaDokumentTyp>("ausweis_vorderseite");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = async () => {
        try {
            const client = await getEsskaClient();
            const { data, error: e } = await client
                .from("employee_documents")
                .select("*")
                .eq("profile_id", profileId)
                .order("hochgeladen_am", { ascending: false });
            if (e) throw e;
            const list = (data as EsskaEmployeeDocument[]) ?? [];
            setDocs(list);
            onChanged?.(list);
        } catch (err) {
            setError(friendlyError(err, { aktion: "Dokumente konnten nicht geladen werden" }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileId]);

    const handleFile = async (file: File) => {
        setError(null);
        if (file.size > MAX_BYTES) {
            setError("Datei zu groß (max. 10 MB).");
            return;
        }
        if (!ERLAUBTE_TYPEN.includes(file.type)) {
            setError("Nur Bilder (JPG, PNG, WebP, HEIC) oder PDF erlaubt.");
            return;
        }
        setBusy(true);
        try {
            const client = await getEsskaClient();
            const ext = file.name.split(".").pop() ?? "bin";
            const path = `${profileId}/${uploadTyp}/${Date.now()}.${ext}`;

            const { error: upErr } = await client.storage.from(BUCKET).upload(path, file, {
                cacheControl: "3600",
                upsert: false,
            });
            if (upErr) throw upErr;

            const { error: insErr } = await client.from("employee_documents").insert({
                profile_id: profileId,
                dokument_typ: uploadTyp,
                storage_path: path,
                hochgeladen_von: profileId,
            });
            if (insErr) throw insErr;

            await reload();
        } catch (err) {
            setError(friendlyError(err, { aktion: "Upload fehlgeschlagen" }));
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (doc: EsskaEmployeeDocument) => {
        if (!confirm(`${DOKUMENT_TYP_LABELS[doc.dokument_typ]} wirklich löschen?`)) return;
        setBusy(true);
        try {
            const client = await getEsskaClient();
            await client.storage.from(BUCKET).remove([doc.storage_path]);
            const { error: e } = await client.from("employee_documents").delete().eq("id", doc.id);
            if (e) throw e;
            await reload();
        } catch (err) {
            setError(friendlyError(err, { aktion: "Löschen fehlgeschlagen" }));
        } finally {
            setBusy(false);
        }
    };

    const handleDownload = async (doc: EsskaEmployeeDocument) => {
        try {
            const client = await getEsskaClient();
            const { data, error: e } = await client.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60);
            if (e) throw e;
            window.open(data.signedUrl, "_blank");
        } catch (err) {
            setError(friendlyError(err, { aktion: "Download fehlgeschlagen" }));
        }
    };

    const vorhandeneTypen = new Set(docs.map((d) => d.dokument_typ));
    const fehlendePflicht = pflicht.filter((p) => !vorhandeneTypen.has(p));

    return (
        <div className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

            {fehlendePflicht.length > 0 && (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-md text-sm">
                    Noch erforderlich: {fehlendePflicht.map((p) => DOKUMENT_TYP_LABELS[p]).join(", ")}.
                    Bitte gut lesbar fotografieren oder scannen – beide Ausweisseiten müssen vollständig erkennbar sein.
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-end">
                <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">Dokumenttyp</label>
                    <select
                        value={uploadTyp}
                        onChange={(e) => setUploadTyp(e.target.value as EsskaDokumentTyp)}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                        {(Object.keys(DOKUMENT_TYP_LABELS) as EsskaDokumentTyp[]).map((t) => (
                            <option key={t} value={t}>
                                {DOKUMENT_TYP_LABELS[t]}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2">
                    <label className={`inline-flex items-center justify-center px-3 py-2 rounded-md cursor-pointer text-sm
                        ${busy ? "bg-gray-200 text-gray-500" : "bg-primary-600 text-white hover:bg-primary-700"}`}>
                        <Camera className="h-4 w-4 mr-2" />
                        {busy ? "…" : "Foto aufnehmen"}
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            disabled={busy}
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFile(f);
                                e.target.value = "";
                            }}
                        />
                    </label>
                    <label className={`inline-flex items-center justify-center px-3 py-2 border rounded-md cursor-pointer text-sm
                        ${busy ? "bg-gray-100 text-gray-400" : "hover:bg-secondary-50"}`}>
                        <Upload className="h-4 w-4 mr-2" />
                        Datei wählen
                        <input
                            type="file"
                            accept={ERLAUBTE_TYPEN.join(",")}
                            className="hidden"
                            disabled={busy}
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFile(f);
                                e.target.value = "";
                            }}
                        />
                    </label>
                </div>
            </div>

            {loading ? (
                <p className="text-sm text-gray-500">Lädt…</p>
            ) : docs.length === 0 ? (
                <p className="text-sm text-gray-500">Noch keine Dokumente hochgeladen.</p>
            ) : (
                <ul className="space-y-2">
                    {docs.map((doc) => (
                        <li key={doc.id} className="flex items-center justify-between border rounded-md p-3 text-sm">
                            <div className="flex items-center gap-2">
                                <FileCheck className="h-4 w-4 text-green-600" />
                                <span className="font-medium">{DOKUMENT_TYP_LABELS[doc.dokument_typ]}</span>
                                <span className="text-gray-500 text-xs">
                                    {new Date(doc.hochgeladen_am).toLocaleString("de-DE")}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => handleDownload(doc)} className="text-primary-600 hover:text-primary-800" title="Ansehen">
                                    <Download className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => handleDelete(doc)} disabled={busy} className="text-red-600 hover:text-red-800" title="Löschen">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
