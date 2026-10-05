"use client";

import React, { useEffect, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import { useGlobal } from "@/lib/context/GlobalContext";
import type { EsskaArbeitszeitModell, EsskaVertragsvorlage } from "@/lib/esska/types";
import { ARBEITSZEIT_MODELL_LABELS } from "@/lib/esska/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Reihenfolge der Karten: die bei Esska ueblichen Arten zuerst
const ARTEN: EsskaArbeitszeitModell[] = ["minijob", "kurzfristig", "werkstudent", "teilzeit", "vollzeit"];
const MAX_BYTES = 20 * 1024 * 1024;

type Neu = { titel: string; datei: File | null };

export default function VertraegePage() {
    const { role } = useGlobal();
    const [vorlagen, setVorlagen] = useState<EsskaVertragsvorlage[]>([]);
    const [links, setLinks] = useState<Record<string, string>>({});
    const [neu, setNeu] = useState<Record<string, Neu>>({});
    const [laedt, setLaedt] = useState(true);
    const [busy, setBusy] = useState<EsskaArbeitszeitModell | null>(null);
    const [fehler, setFehler] = useState<{ art: EsskaArbeitszeitModell | null; text: string } | null>(null);
    const [erfolg, setErfolg] = useState<string | null>(null);

    const laden = async () => {
        try {
            const client = await getEsskaClient();
            const { data, error } = await client.from("vertragsvorlagen").select("*").eq("aktiv", true);
            if (error) throw error;
            const liste = (data as EsskaVertragsvorlage[]) ?? [];
            setVorlagen(liste);
            const paare = await Promise.all(
                liste.map(async (v) => {
                    const { data: u } = await client.storage
                        .from("arbeitsvertraege")
                        .createSignedUrl(v.datei_pfad, 3600);
                    return [v.id, u?.signedUrl ?? ""] as const;
                })
            );
            setLinks(Object.fromEntries(paare));
        } catch (err) {
            setFehler({ art: null, text: friendlyError(err, { aktion: "Vorlagen laden" }) });
        } finally {
            setLaedt(false);
        }
    };

    useEffect(() => {
        laden();
    }, []);

    const hochladen = async (art: EsskaArbeitszeitModell) => {
        const eingabe = neu[art] ?? { titel: "", datei: null };
        setFehler(null);
        setErfolg(null);
        if (!eingabe.datei) {
            setFehler({ art, text: "Bitte zuerst eine PDF-Datei auswählen." });
            return;
        }
        const istPdf =
            eingabe.datei.type === "application/pdf" || eingabe.datei.name.toLowerCase().endsWith(".pdf");
        if (!istPdf) {
            setFehler({ art, text: "Bitte eine PDF-Datei verwenden – andere Formate lassen sich auf dem Handy oft nicht öffnen." });
            return;
        }
        if (eingabe.datei.size > MAX_BYTES) {
            setFehler({ art, text: "Die Datei ist größer als 20 MB." });
            return;
        }
        const alt = vorlagen.find((v) => v.art === art);
        if (
            alt &&
            !window.confirm(
                `Die bisherige Vorlage für „${ARBEITSZEIT_MODELL_LABELS[art]}“ wird ersetzt. ` +
                    `Alle Mitarbeiter dieser Art müssen die neue Fassung erneut bestätigen. Fortfahren?`
            )
        ) {
            return;
        }

        setBusy(art);
        try {
            const client = await getEsskaClient();
            const { data: { user } } = await client.auth.getUser();
            const pfad = `${art}/${Date.now()}.pdf`;
            const { error: upErr } = await client.storage
                .from("arbeitsvertraege")
                .upload(pfad, eingabe.datei, { contentType: "application/pdf", upsert: false });
            if (upErr) throw upErr;

            // Erst die alte Fassung abloesen (es darf nur eine aktive je Art geben),
            // dann die neue eintragen. Scheitert das Eintragen, wird die alte
            // wieder aktiviert, damit die Art nicht ohne Vertrag dasteht.
            if (alt) {
                const { error: e1 } = await client.from("vertragsvorlagen").update({ aktiv: false }).eq("id", alt.id);
                if (e1) throw e1;
            }
            const titel = eingabe.titel.trim() || `Arbeitsvertrag ${ARBEITSZEIT_MODELL_LABELS[art]}`;
            const { error: e2 } = await client.from("vertragsvorlagen").insert({
                art,
                titel,
                datei_pfad: pfad,
                hochgeladen_von: user?.id ?? null,
            });
            if (e2) {
                if (alt) await client.from("vertragsvorlagen").update({ aktiv: true }).eq("id", alt.id);
                throw e2;
            }
            setNeu((prev) => ({ ...prev, [art]: { titel: "", datei: null } }));
            setErfolg(`Vorlage für „${ARBEITSZEIT_MODELL_LABELS[art]}“ gespeichert.`);
            await laden();
        } catch (err) {
            setFehler({ art, text: friendlyError(err, { aktion: "Hochladen" }) });
        } finally {
            setBusy(null);
        }
    };

    if (role && role !== "admin") {
        return <div className="p-6 text-sm text-gray-600">Diese Seite ist nur für Admins.</div>;
    }

    return (
        <div className="space-y-6 p-2 md:p-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold">Arbeitsverträge</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Je Beschäftigungsart eine PDF-Vorlage. Mitarbeiter sehen die Vorlage zu ihrer eingetragenen
                    Beschäftigungsart im Onboarding und unter &bdquo;Stammdaten&ldquo; und bestätigen sie dort.
                    Ist für eine Art keine Vorlage hinterlegt, entfällt der Schritt vorerst.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                    Die Bestätigung belegt Erhalt und Kenntnisnahme. Für befristete Verträge ist zusätzlich die
                    Unterschrift auf Papier nötig (§ 14 Abs. 4 TzBfG).
                </p>
            </div>

            {erfolg && <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{erfolg}</div>}
            {fehler && fehler.art === null && (
                <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{fehler.text}</div>
            )}

            {laedt ? (
                <p className="text-gray-500">Lädt…</p>
            ) : (
                ARTEN.map((art) => {
                    const v = vorlagen.find((x) => x.art === art);
                    const eingabe = neu[art] ?? { titel: "", datei: null };
                    return (
                        <Card key={art}>
                            <CardHeader>
                                <CardTitle>{ARBEITSZEIT_MODELL_LABELS[art]}</CardTitle>
                                <CardDescription>
                                    {v
                                        ? `Aktuell: ${v.titel} · hochgeladen am ${new Date(v.hochgeladen_am).toLocaleDateString("de-DE")}`
                                        : "Noch keine Vorlage hinterlegt."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {v && links[v.id] && (
                                    <a
                                        href={links[v.id]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center text-sm text-primary-600 hover:underline"
                                    >
                                        <FileText className="h-4 w-4 mr-1.5" />
                                        Aktuelle Vorlage ansehen
                                    </a>
                                )}
                                <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                                    <div className="flex-1 min-w-48">
                                        <label htmlFor={`titel-${art}`} className="block text-xs text-gray-500 mb-1">
                                            Titel (optional)
                                        </label>
                                        <input
                                            id={`titel-${art}`}
                                            value={eingabe.titel}
                                            onChange={(e) =>
                                                setNeu((prev) => ({ ...prev, [art]: { ...eingabe, titel: e.target.value } }))
                                            }
                                            placeholder={`Arbeitsvertrag ${ARBEITSZEIT_MODELL_LABELS[art]}`}
                                            className="w-full border rounded-md px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor={`datei-${art}`} className="block text-xs text-gray-500 mb-1">
                                            PDF-Datei
                                        </label>
                                        <input
                                            id={`datei-${art}`}
                                            type="file"
                                            accept="application/pdf,.pdf"
                                            onChange={(e) =>
                                                setNeu((prev) => ({
                                                    ...prev,
                                                    [art]: { ...eingabe, datei: e.target.files?.[0] ?? null },
                                                }))
                                            }
                                            className="text-sm"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => hochladen(art)}
                                        disabled={busy !== null}
                                        className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        {busy === art ? "Lädt hoch…" : v ? "Ersetzen" : "Hochladen"}
                                    </button>
                                </div>
                                {fehler && fehler.art === art && (
                                    <p className="text-sm text-red-700">{fehler.text}</p>
                                )}
                            </CardContent>
                        </Card>
                    );
                })
            )}
        </div>
    );
}
