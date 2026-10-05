"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, FileText } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type {
    EsskaArbeitszeitModell,
    EsskaVertragsbestaetigung,
    EsskaVertragsvorlage,
} from "@/lib/esska/types";
import { ARBEITSZEIT_MODELL_LABELS } from "@/lib/esska/types";

type Zustand =
    | { art: "laden" }
    | { art: "keine_vorlage" }
    | {
          art: "da";
          vorlage: EsskaVertragsvorlage;
          bestaetigung: EsskaVertragsbestaetigung | null;
          neueFassung: boolean;
          urlAnsehen: string | null;
          urlDownload: string | null;
      };

type Props = {
    profileId: string;
    modell: EsskaArbeitszeitModell | null;
    /** Admin-Ansicht: nur anzeigen, nicht bestaetigen (bestaetigen kann nur die Person selbst). */
    nurLesen?: boolean;
    /** Meldet, ob der Schritt erledigt ist: bestaetigt ODER (noch) keine Vorlage fuer diese Art. */
    onStatus?: (erledigt: boolean) => void;
};

/** Zeigt den Arbeitsvertrag zur Beschaeftigungsart und laesst ihn per
 *  Haken bestaetigen - wie eine Datenschutzerklaerung. */
export default function ArbeitsvertragBox({ profileId, modell, nurLesen = false, onStatus }: Props) {
    const [zustand, setZustand] = useState<Zustand>({ art: "laden" });
    const [haken, setHaken] = useState(false);
    const [speichert, setSpeichert] = useState(false);
    const [fehler, setFehler] = useState<string | null>(null);

    const laden = useCallback(async () => {
        setFehler(null);
        if (!modell) {
            setZustand({ art: "keine_vorlage" });
            onStatus?.(true);
            return;
        }
        try {
            const client = await getEsskaClient();
            const { data: vData, error: vErr } = await client
                .from("vertragsvorlagen")
                .select("*")
                .eq("art", modell)
                .eq("aktiv", true)
                .maybeSingle();
            if (vErr) throw vErr;
            const vorlage = vData as EsskaVertragsvorlage | null;
            if (!vorlage) {
                setZustand({ art: "keine_vorlage" });
                onStatus?.(true);
                return;
            }
            const { data: bData, error: bErr } = await client
                .from("vertragsbestaetigungen")
                .select("*")
                .eq("profile_id", profileId);
            if (bErr) throw bErr;
            const alle = (bData as EsskaVertragsbestaetigung[]) ?? [];
            const bestaetigung = alle.find((b) => b.vorlage_id === vorlage.id) ?? null;

            // Links vorab erzeugen: ein window.open NACH einer Abfrage wird
            // auf dem iPhone als Popup blockiert, ein normaler Link nicht.
            const [ansehen, download] = await Promise.all([
                client.storage.from("arbeitsvertraege").createSignedUrl(vorlage.datei_pfad, 3600),
                client.storage
                    .from("arbeitsvertraege")
                    .createSignedUrl(vorlage.datei_pfad, 3600, { download: `${vorlage.titel}.pdf` }),
            ]);

            setZustand({
                art: "da",
                vorlage,
                bestaetigung,
                // Es gibt eine aeltere Bestaetigung, aber nicht fuer die aktuelle Fassung
                neueFassung: !bestaetigung && alle.length > 0,
                urlAnsehen: ansehen.data?.signedUrl ?? null,
                urlDownload: download.data?.signedUrl ?? null,
            });
            onStatus?.(!!bestaetigung);
        } catch (err) {
            setFehler(friendlyError(err, { aktion: "Arbeitsvertrag laden" }));
        }
        // onStatus bewusst nicht in den Abhaengigkeiten: Aufrufer uebergeben
        // meist eine neue Funktion pro Render, das wuerde endlos neu laden.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileId, modell]);

    useEffect(() => {
        laden();
    }, [laden]);

    const bestaetigen = async () => {
        if (zustand.art !== "da") return;
        if (!haken) {
            setFehler("Bitte zuerst den Haken setzen, dass du den Vertrag gelesen hast.");
            return;
        }
        setSpeichert(true);
        setFehler(null);
        try {
            const client = await getEsskaClient();
            const { data, error } = await client
                .from("vertragsbestaetigungen")
                .insert({ profile_id: profileId, vorlage_id: zustand.vorlage.id })
                .select("*")
                .single();
            if (error) throw error;
            setZustand({ ...zustand, bestaetigung: data as EsskaVertragsbestaetigung, neueFassung: false });
            onStatus?.(true);
        } catch (err) {
            setFehler(friendlyError(err, { aktion: "Bestätigen" }));
        } finally {
            setSpeichert(false);
        }
    };

    if (zustand.art === "laden") {
        return <div className="text-sm text-gray-500">{fehler ?? "Arbeitsvertrag wird geladen…"}</div>;
    }

    if (zustand.art === "keine_vorlage") {
        return (
            <div className="p-4 border rounded-lg bg-gray-50 text-sm text-gray-600">
                {modell
                    ? `Für „${ARBEITSZEIT_MODELL_LABELS[modell]}“ ist noch kein Arbeitsvertrag hinterlegt.`
                    : "Deine Beschäftigungsart ist noch nicht eingetragen."}{" "}
                {nurLesen
                    ? ""
                    : "Sobald dein Vertrag bereitsteht, findest du ihn hier und unter „Stammdaten“ zum Bestätigen."}
                {!nurLesen && (
                    <span className="block italic text-xs mt-1">
                        Your contract is not available yet. Once it is, you will find it here and under
                        &bdquo;Stammdaten&ldquo;.
                    </span>
                )}
            </div>
        );
    }

    const { vorlage, bestaetigung, neueFassung, urlAnsehen, urlDownload } = zustand;

    return (
        <div className="p-4 border rounded-lg bg-white space-y-3 text-sm">
            <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <div className="font-medium">{vorlage.titel}</div>
                    <div className="text-xs text-gray-500">
                        {ARBEITSZEIT_MODELL_LABELS[vorlage.art]} · Fassung vom{" "}
                        {new Date(vorlage.hochgeladen_am).toLocaleDateString("de-DE")}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {urlAnsehen && (
                    <a
                        href={urlAnsehen}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
                    >
                        <FileText className="h-4 w-4 mr-2" />
                        Vertrag ansehen
                    </a>
                )}
                {urlDownload && (
                    <a
                        href={urlDownload}
                        className="inline-flex items-center px-3 py-2 rounded-md border hover:bg-gray-50"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Herunterladen
                    </a>
                )}
            </div>

            {bestaetigung ? (
                <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Bestätigt am {new Date(bestaetigung.bestaetigt_am).toLocaleString("de-DE")}
                </div>
            ) : nurLesen ? (
                <div className="text-amber-700">
                    Noch nicht bestätigt{neueFassung ? " (eine frühere Fassung war bestätigt)" : ""}.
                </div>
            ) : (
                <div className="space-y-3 border-t pt-3">
                    {neueFassung && (
                        <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 text-xs">
                            Es gibt eine neue Fassung deines Arbeitsvertrags. Bitte lies sie und bestätige sie
                            erneut.
                        </p>
                    )}
                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={haken}
                            onChange={(e) => setHaken(e.target.checked)}
                            className="mt-1 flex-shrink-0"
                        />
                        <span>
                            Ich habe meinen Arbeitsvertrag erhalten und gelesen und bin mit seinem Inhalt
                            einverstanden.
                            <span className="block italic text-xs text-gray-500">
                                I have received and read my employment contract and agree to its contents.
                            </span>
                        </span>
                    </label>
                    <button
                        type="button"
                        onClick={bestaetigen}
                        disabled={speichert}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                        {speichert ? "Wird gespeichert…" : "Vertrag bestätigen"}
                    </button>
                </div>
            )}

            {fehler && <div className="p-2 bg-red-50 text-red-700 rounded-md">{fehler}</div>}
        </div>
    );
}
