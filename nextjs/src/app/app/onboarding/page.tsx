"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import type { EsskaEmployeeDocument, EsskaKubeDeclaration, EsskaProfile } from "@/lib/esska/types";
import StammdatenForm from "@/components/esska/StammdatenForm";
import KubeForm from "@/components/esska/KubeForm";
import DokumenteUpload from "@/components/esska/DokumenteUpload";

function aktuelleSaison(): string {
    const now = new Date();
    const jahr = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return `${jahr % 100}/${((jahr + 1) % 100).toString().padStart(2, "0")}`;
}

type Schritt = "stammdaten" | "kube" | "dokumente" | "fertig";

export default function OnboardingPage() {
    const router = useRouter();
    const [profile, setProfile] = useState<EsskaProfile | null>(null);
    const [kube, setKube] = useState<EsskaKubeDeclaration | null>(null);
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

                const { data: p, error: pe } = await client.from("profiles").select("*").eq("id", user.id).single();
                if (pe) throw pe;
                setProfile(p as EsskaProfile);

                const { data: k } = await client
                    .from("kube_declarations")
                    .select("*")
                    .eq("profile_id", user.id)
                    .eq("saison", saison)
                    .maybeSingle();
                if (k) setKube(k as EsskaKubeDeclaration);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Fehler beim Laden");
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

    const brauchtKube = profile.arbeitszeit_modell === "kurzfristig";
    const ausweisDa =
        docs.some((d) => d.dokument_typ === "ausweis_vorderseite") &&
        docs.some((d) => d.dokument_typ === "ausweis_rueckseite");

    const schritte: { key: Schritt; titel: string; erledigt: boolean }[] = [
        { key: "stammdaten", titel: "Stammdaten", erledigt: !!profile.stammdaten_bestaetigt_am },
        ...(brauchtKube
            ? [{ key: "kube" as Schritt, titel: "KuBe-Statuserklärung", erledigt: !!kube?.unterzeichnet_am }]
            : []),
        { key: "dokumente", titel: "Ausweis & Nachweise", erledigt: ausweisDa },
    ];

    const handleFertig = async () => {
        try {
            const client = await getEsskaClient();
            await client.from("profiles").update({ onboarding_abgeschlossen: true }).eq("id", profile.id);
            router.push("/app");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Abschluss fehlgeschlagen");
        }
    };

    const alleErledigt = schritte.every((s) => s.erledigt);

    return (
        <div className="space-y-6 p-2 md:p-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold">Willkommen bei Esska 👋</h1>
                <p className="text-gray-600">
                    Bevor es losgeht, brauchen wir ein paar Angaben für die Personalakte. Das dauert etwa 10 Minuten.
                    Du kannst jederzeit unterbrechen – deine Eingaben bleiben gespeichert.
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
                    onboardingMode={false}
                    onSaved={(p) => {
                        setProfile(p);
                        setSchritt(brauchtKube ? "kube" : "dokumente");
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
                        setSchritt("dokumente");
                    }}
                />
            )}

            {schritt === "dokumente" && (
                <div className="space-y-4">
                    <div className="bg-white border rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-3">Ausweis & Nachweise hochladen</h3>
                        <DokumenteUpload profileId={profile.id} onChanged={setDocs} />
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
