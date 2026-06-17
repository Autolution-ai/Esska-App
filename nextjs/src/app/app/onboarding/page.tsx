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

    const saison = useMemo(aktuelleSaison, []);

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const { data: { user } } = await client.auth.getUser();
                if (!user) throw new Error("Nicht angemeldet");

                const [pRes, kRes, eRes] = await Promise.all([
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
                ]);
                if (pRes.error) throw pRes.error;
                setProfile(pRes.data as EsskaProfile);
                if (kRes.data) setKube(kRes.data as EsskaKubeDeclaration);
                if (eRes.data) setPension(eRes.data as EsskaPensionExemption);
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

    // KuBe-Schritt: nur wenn Admin den User als 'kurzfristig' eingestuft hat
    const brauchtKube = profile.arbeitszeit_modell === "kurzfristig";

    // Ausweis Vorder- und Rueckseite: Pflicht bei allen
    const ausweisDa =
        docs.some((d) => d.dokument_typ === "ausweis_vorderseite") &&
        docs.some((d) => d.dokument_typ === "ausweis_rueckseite");

    // Student: Immatrikulationsbescheinigung Pflicht
    let zusaetzlichePflicht: { typ: EsskaDokumentTyp; label: string } | null = null;
    if (profile.aktueller_status === "student") {
        zusaetzlichePflicht = { typ: "immatrikulation", label: "Immatrikulationsbescheinigung" };
    }
    const zusatzDa = !zusaetzlichePflicht || docs.some((d) => d.dokument_typ === zusaetzlichePflicht!.typ);
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
        try {
            const client = await getEsskaClient();
            await client.from("profiles").update({ onboarding_abgeschlossen: true }).eq("id", profile.id);
            router.push("/app");
        } catch (err) {
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
                            {zusaetzlichePflicht && (
                                <> Zusätzlich: <strong>{zusaetzlichePflicht.label}</strong>.</>
                            )}
                            {" "}Optional kannst du weitere Bescheinigungen hochladen.
                        </p>
                        <DokumenteUpload
                            profileId={profile.id}
                            pflicht={
                                zusaetzlichePflicht
                                    ? ["ausweis_vorderseite", "ausweis_rueckseite", zusaetzlichePflicht.typ]
                                    : ["ausweis_vorderseite", "ausweis_rueckseite"]
                            }
                            onChanged={setDocs}
                        />
                    </div>

                    <div className="flex items-center justify-between bg-white border rounded-lg p-4">
                        <p className="text-sm text-gray-600">
                            {alleErledigt
                                ? "Alles vollständig – du kannst das Onboarding abschließen."
                                : "Es fehlen noch Angaben (siehe Schritte oben)."}
                        </p>
                        <button
                            onClick={handleFertig}
                            disabled={!alleErledigt}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                        >
                            Onboarding abschließen
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
