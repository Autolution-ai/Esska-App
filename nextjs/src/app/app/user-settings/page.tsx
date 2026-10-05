"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import { BookOpen, CheckCircle, ChevronRight, FileText, Key, Scale, Shield, Users } from "lucide-react";
import { MFASetup } from "@/components/MFASetup";
import StammdatenForm from "@/components/esska/StammdatenForm";
import ArbeitsvertragBox from "@/components/esska/ArbeitsvertragBox";
import type { EsskaProfile } from "@/lib/esska/types";

export default function UserSettingsPage() {
    const { user, role } = useGlobal();
    // Mitarbeiter nutzen das gemeinsame Startpasswort (Vorgabe Oktober 2026)
    // und legen kein eigenes fest. Admins und Regionalmanager behalten ein
    // eigenes Passwort und die Zwei-Faktor-Anmeldung.
    const eigenesPasswort = role === "admin" || role === "regionalmanager";
    const [profile, setProfile] = useState<EsskaProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileError, setProfileError] = useState<string | null>(null);

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const { data: { user: authUser } } = await client.auth.getUser();
                if (!authUser) throw new Error("Nicht angemeldet");
                const { data, error: e } = await client
                    .from("profiles")
                    .select("*")
                    .eq("id", authUser.id)
                    .single();
                if (e) throw e;
                setProfile(data as EsskaProfile);
            } catch (err) {
                setProfileError(err instanceof Error ? err.message : "Stammdaten konnten nicht geladen werden");
            } finally {
                setProfileLoading(false);
            }
        };
        load();
    }, []);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError("Die Passwörter stimmen nicht überein.");
            return;
        }
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const supabase = await createSPASassClient();
            const client = supabase.getSupabaseClient();
            const { error: e } = await client.auth.updateUser({ password: newPassword });
            if (e) throw e;
            setSuccess("Passwort erfolgreich geändert.");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            setError(friendlyError(err, { aktion: "Passwort konnte nicht geändert werden." }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div>
                <h1 className="text-2xl font-bold">Einstellungen & Stammdaten</h1>
                <p className="text-gray-500">Persönliche Daten, Passwort und Sicherheits-Einstellungen.</p>
                {/* Dauerhaft auffindbarer Ort fuer die Installations-Anleitung -
                    der Hinweis auf dem Dashboard laesst sich wegklicken. */}
                <p className="mt-2 text-sm">
                    <a href="/anleitung" className="text-primary-600 underline">
                        📱 Esska-App aufs Handy holen (Anleitung)
                    </a>
                </p>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {success && (
                <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            {/* Arbeitsvertrag ansehen, herunterladen und - falls noch offen - bestaetigen */}
            {profile && role !== "admin" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Mein Arbeitsvertrag
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ArbeitsvertragBox profileId={profile.id} modell={profile.arbeitszeit_modell} />
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Persönliche Stammdaten</CardTitle>
                    <CardDescription>
                        Daten aus dem Esska-Personalfragebogen. Felder mit * sind nur bei Teilzeit/Vollzeit Pflicht.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {profileLoading ? (
                        <p className="text-gray-500">Lädt…</p>
                    ) : profileError ? (
                        <p className="text-red-600 text-sm">{profileError}</p>
                    ) : profile ? (
                        <StammdatenForm
                            profile={profile}
                            onSaved={(p) => {
                                setProfile(p);
                                setSuccess("Stammdaten gespeichert.");
                            }}
                        />
                    ) : null}
                </CardContent>
            </Card>

            {eigenesPasswort && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Passwort ändern
                    </CardTitle>
                    <CardDescription>Angemeldet als {user?.email}</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Neues Passwort</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={10}
                                className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Passwort wiederholen</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={10}
                                className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                        >
                            {loading ? "Speichern…" : "Passwort ändern"}
                        </button>
                    </form>
                </CardContent>
            </Card>
            )}

            {eigenesPasswort && (
                <MFASetup
                    onStatusChange={() => {
                        setSuccess("Zwei-Faktor-Authentifizierung aktualisiert.");
                    }}
                />
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Scale className="h-5 w-5" />
                        Rechtliches
                    </CardTitle>
                    <CardDescription>Impressum, Datenschutz und Nutzungsregeln der Esska-App.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <ul className="divide-y">
                        {RECHTSTEXTE.map((r) => (
                            <li key={r.href}>
                                <Link
                                    href={r.href}
                                    className="flex items-center gap-3 px-6 py-3 text-sm hover:bg-gray-50"
                                >
                                    <r.icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    <span className="flex-1">{r.titel}</span>
                                    <ChevronRight className="h-4 w-4 text-gray-300" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}

const RECHTSTEXTE = [
    { href: "/legal/impressum", titel: "Impressum", icon: FileText },
    { href: "/legal/datenschutz-beschaeftigte", titel: "Datenschutz für Beschäftigte", icon: Users },
    { href: "/legal/datenschutz", titel: "Datenschutzerklärung", icon: Shield },
    { href: "/legal/nutzungsregeln", titel: "Nutzungsregeln", icon: BookOpen },
];
