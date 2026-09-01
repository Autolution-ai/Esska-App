"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type {
    EsskaDokumentTyp,
    EsskaEmployeeDocument,
    EsskaKubeDeclaration,
    EsskaPensionExemption,
    EsskaProfile,
} from "@/lib/esska/types";
import StammdatenForm from "@/components/esska/StammdatenForm";
import KubeForm from "@/components/esska/KubeForm";
import DokumenteUpload from "@/components/esska/DokumenteUpload";
import PensionExemptionForm from "@/components/esska/PensionExemptionForm";

function aktuelleSaison(): string {
    const now = new Date();
    const jahr = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return `${jahr % 100}/${((jahr + 1) % 100).toString().padStart(2, "0")}`;
}

type Schritt = "stammdaten" | "rv_befreiung" | "kube" | "dokumente";

export default function OnboardingPage() {
    const router = useRouter();
    const [profile, setProfile] = useState<EsskaProfile | null>(null);
    const [kube, setKube] = useState<EsskaKubeDeclaration | null>(null);
    const [pension, setPension] = useState<EsskaPensionExemption | null>(null);
    const [docs, setDocs] = useState<EsskaEmployeeDocument[]>([]);
    const [schritt, setSchritt] = useState<Schritt>("stammdaten");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [abschluss, setAbschluss] = useState<"idle" | "saving" | "done">("idle");

    // Wenn das Profil bereits abgeschlossen ist, direkt ins App-Dashboard
    useEffect(() => {
        if (profile?.onboarding_abgeschlossen) {
            router.replace("/app");
        }
    }, [profile?.onboarding_abgeschlossen, router]);

    const saison = useMemo(aktuelleSaison, []);

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const { data: { user } } = await client.auth.getUser();
                if (!user) throw new Error("Nicht angemeldet");

                const [pRes, kRes, eRes, dRes] = await Promise.all([
                    client.from("profiles").select("*").eq("id", user.id).single(),
                    client
                        .from("kube_declarations")
                        .select("*")
                        .eq("profile_id", user.id)
                        .eq("saison", saison)
                        .maybeSingle(),
                    client
                        .from("pension_exemptions")
                        .select("*")
                        .eq("profile_id", user.id)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                    client
                        .from("employee_documents")
                        .select("*")
                        .eq("profile_id", user.id),
                ]);
                if (pRes.error) throw pRes.error;
                setProfile(pRes.data as EsskaProfile);
                if (kRes.data) setKube(kRes.data as EsskaKubeDeclaration);
                if (eRes.data) setPension(eRes.data as EsskaPensionExemption);
                if (dRes.data) setDocs(dRes.data as EsskaEmployeeDocument[]);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [saison]);

    if (loading) return <div className="p-6 text-gray-500">Lädt…</div>;
    if (error || !profile) {
        return <div className="p-6 text-red-600 text-sm">{error ?? "Profil nicht gefunden."}</div>;
    }

    // KuBe-Schritt: nur wenn Admin den User als 'kurzfristig' eingestuft hat.
    // O-16: Bei Sozialleistungsbezug ist die kurzfristige Beschaeftigung
    // ausgeschlossen - das Formular entfaellt, der Fall wird angezeigt und
    // muss vom Admin geklaert werden.
    const sozialleistungsAusschluss =
        profile.arbeitszeit_modell === "kurzfristig" && profile.sozialleistungen_bezug === true;
    const brauchtKube = profile.arbeitszeit_modell === "kurzfristig" && !sozialleistungsAusschluss;

    // Ausweis Vorder- und Rueckseite: Pflicht bei allen
    const ausweisDa =
        docs.some((d) => d.dokument_typ === "ausweis_vorderseite") &&
        docs.some((d) => d.dokument_typ === "ausweis_rueckseite");

    // Pflicht-Nachweise je Status (O-2/O-3/O-4) und bei Nicht-EU-
    // Staatsbuergerschaft zusaetzlich der Aufenthaltstitel (O-10)
    const zusaetzlichePflichten: { typ: EsskaDokumentTyp; label: string }[] = [];
    if (profile.aktueller_status === "student") {
        zusaetzlichePflichten.push({ typ: "immatrikulation", label: "Immatrikulationsbescheinigung" });
    }
    if (profile.aktueller_status === "schueler") {
        zusaetzlichePflichten.push({ typ: "schulbescheinigung", label: "Schülerausweis / Schulbescheinigung" });
    }
    if (profile.aktueller_status === "rentner") {
        zusaetzlichePflichten.push({ typ: "rentenbescheid", label: "Rentenbescheinigung / Rentenbescheid" });
    }
    if (profile.eu_staatsbuergerschaft === false) {
        zusaetzlichePflichten.push({ typ: "aufenthaltsgenehmigung", label: "Aufenthaltstitel" });
    }
    const zusatzDa = zusaetzlichePflichten.every((z) => docs.some((d) => d.dokument_typ === z.typ));
    const dokumentePflichtErfuellt = ausweisDa && zusatzDa;

    const rvBefreiungErledigt = !!pension?.unterzeichnet_am;

    const schritte: { key: Schritt; titel: string; erledigt: boolean }[] = [
        { key: "stammdaten", titel: "Stammdaten", erledigt: !!profile.stammdaten_bestaetigt_am },
        { key: "rv_befreiung", titel: "Rentenversicherungs-Befreiung", erledigt: rvBefreiungErledigt },
        ...(brauchtKube
            ? [{ key: "kube" as Schritt, titel: "KuBe-Statuserklärung", erledigt: !!kube?.unterzeichnet_am }]
            : []),
        { key: "dokumente", titel: "Ausweis & Nachweise", erledigt: dokumentePflichtErfuellt },
    ];

    const alleErledigt = schritte.every((s) => s.erledigt);

    const handleFertig = async () => {
        if (!alleErledigt) {
            setError("Es fehlen noch Angaben. Bitte alle Schritte oben abschließen.");
            return;
        }
        setError(null);
        setAbschluss("saving");
        try {
            const client = await getEsskaClient();
            const { data, error: updErr } = await client
                .from("profiles")
                .update({ onboarding_abgeschlossen: true })
                .eq("id", profile.id)
                .select("id, onboarding_abgeschlossen")
                .single();
            if (updErr) throw updErr;
            const ok = (data as { onboarding_abgeschlossen?: boolean } | null)?.onboarding_abgeschlossen === true;
            if (!ok) {
                throw new Error(
                    "Der Status konnte nicht gespeichert werden (keine Berechtigung). Bitte den Admin kontaktieren."
                );
            }
            setAbschluss("done");
            // Full Reload statt Client-Navigation: damit der GlobalContext den
            // neuen onboarding_abgeschlossen-Wert frisch laedt und die
            // Middleware nicht wieder nach /app/onboarding zurueckschickt.
            window.location.assign("/app");
        } catch (err) {
            setAbschluss("idle");
            setError(friendlyError(err, { aktion: "Abschluss fehlgeschlagen" }));
        }
    };

    const naechsterSchritt = () => {
        const idx = schritte.findIndex((s) => s.key === schritt);
        if (idx >= 0 && idx < schritte.length - 1) setSchritt(schritte[idx + 1].key);
    };

    return (
        <div className="space-y-6 p-2 md:p-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold">Willkommen bei Esska 👋</h1>
                <p className="text-gray-600">
                    Bevor es losgeht, brauchen wir ein paar Angaben für die Personalakte. Das dauert
                    etwa 10–15 Minuten. Du kannst jederzeit unterbrechen – deine Eingaben bleiben gespeichert.
                </p>
            </div>

            {sozialleistungsAusschluss && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    <p className="font-medium mb-1">Wichtiger Hinweis zu deiner Beschäftigung</p>
                    <p>
                        Du hast angegeben, dass du Sozialleistungen beziehst. Eine Anmeldung als
                        kurzfristige Beschäftigung ist dann nicht möglich – die KuBe-Erklärung
                        entfällt für dich. Deine Ansprechperson meldet sich wegen der passenden
                        Anmeldeform bei dir. Alle übrigen Schritte kannst du normal abschließen.
                    </p>
                </div>
            )}

            {/* Fortschritt */}
            <div className="flex flex-wrap gap-2">
                {schritte.map((s) => (
                    <button
                        key={s.key}
                        onClick={() => setSchritt(s.key)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border
                            ${schritt === s.key ? "border-primary-600 bg-primary-50 text-primary-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                    >
                        {s.erledigt ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                            <Circle className="h-4 w-4 text-gray-400" />
                        )}
                        {s.titel}
                    </button>
                ))}
            </div>

            {schritt === "stammdaten" && (
                <StammdatenForm
                    profile={profile}
                    onSaved={(p) => {
                        setProfile(p);
                        naechsterSchritt();
                    }}
                />
            )}

            {schritt === "rv_befreiung" && (
                <PensionExemptionForm
                    profileId={profile.id}
                    rentenversicherungsnummer={profile.rentenversicherungsnummer}
                    vorname={profile.vorname}
                    nachname={profile.nachname}
                    geburtsdatum={profile.geburtsdatum}
                    existing={pension}
                    onSaved={(e) => {
                        setPension(e);
                        naechsterSchritt();
                    }}
                />
            )}

            {schritt === "kube" && brauchtKube && (
                <KubeForm
                    profileId={profile.id}
                    saison={saison}
                    existing={kube}
                    onSaved={(k) => {
                        setKube(k);
                        naechsterSchritt();
                    }}
                />
            )}

            {schritt === "dokumente" && (
                <div className="space-y-4">
                    <div className="bg-white border rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-1">Ausweis & Nachweise hochladen</h3>
                        <p className="text-sm text-gray-600 mb-3">
                            Pflicht: Ausweis Vorder- und Rückseite (gut lesbar).
                            {zusaetzlichePflichten.length > 0 && (
                                <> Zusätzlich: <strong>{zusaetzlichePflichten.map((z) => z.label).join(", ")}</strong>.</>
                            )}
                            {" "}Optional kannst du weitere Bescheinigungen hochladen.
                        </p>
                        <DokumenteUpload
                            profileId={profile.id}
                            pflicht={[
                                "ausweis_vorderseite",
                                "ausweis_rueckseite",
                                ...zusaetzlichePflichten.map((z) => z.typ),
                            ]}
                            onChanged={setDocs}
                        />
                    </div>

                    {!alleErledigt && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
                            <p className="font-medium mb-1">Noch zu erledigen:</p>
                            <ul className="list-disc pl-5 space-y-0.5">
                                {schritte
                                    .filter((s) => !s.erledigt)
                                    .map((s) => (
                                        <li key={s.key}>
                                            <button
                                                onClick={() => setSchritt(s.key)}
                                                className="underline hover:text-amber-700"
                                            >
                                                {s.titel}
                                            </button>
                                        </li>
                                    ))}
                            </ul>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
                    )}

                    <div className="flex items-center justify-between bg-white border rounded-lg p-4 flex-wrap gap-3">
                        <p className="text-sm text-gray-600">
                            {alleErledigt
                                ? "Alles vollständig – du kannst das Onboarding abschließen."
                                : "Es fehlen noch Angaben (siehe Schritte oben – noch nicht erledigte Schritte haben einen leeren Kreis)."}
                        </p>
                        <button
                            onClick={handleFertig}
                            disabled={!alleErledigt || abschluss !== "idle"}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                        >
                            {abschluss === "saving"
                                ? "Schließe ab…"
                                : abschluss === "done"
                                    ? "Weiterleitung…"
                                    : "Onboarding abschließen"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
