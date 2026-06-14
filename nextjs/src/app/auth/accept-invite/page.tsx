"use client";

import React, { useEffect, useState } from "react";
import { friendlyError } from "@/lib/esska/errors";
import { useRouter } from "next/navigation";
import { CheckCircle, Lock } from "lucide-react";
import { createSPASassClient } from "@/lib/supabase/client";

type Phase = "initialisiere" | "passwort" | "speichere" | "fertig" | "fehler";

export default function AcceptInvitePage() {
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>("initialisiere");
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState("");
    const [passwordWiederholen, setPasswordWiederholen] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                const hash = window.location.hash.startsWith("#")
                    ? window.location.hash.substring(1)
                    : "";
                const params = new URLSearchParams(hash);
                const accessToken = params.get("access_token");
                const refreshToken = params.get("refresh_token");
                const errMsg = params.get("error_description") ?? params.get("error");

                if (errMsg) {
                    setError(decodeURIComponent(errMsg).replace(/\+/g, " "));
                    setPhase("fehler");
                    return;
                }

                const sass = await createSPASassClient();
                const client = sass.getSupabaseClient();

                if (accessToken && refreshToken) {
                    const { error: setErr } = await client.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    if (setErr) throw setErr;
                    window.history.replaceState({}, "", window.location.pathname);
                }

                const { data: { user } } = await client.auth.getUser();
                if (!user) {
                    setError(
                        "Einladung konnte nicht verarbeitet werden. Vermutlich ist der Link abgelaufen oder wurde bereits genutzt. Bitte den Admin um eine neue Einladung."
                    );
                    setPhase("fehler");
                    return;
                }

                setEmail(user.email ?? "");
                setPhase("passwort");
            } catch (err) {
                setError(friendlyError(err, { aktion: "Unbekannter Fehler" }));
                setPhase("fehler");
            }
        };
        init();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password.length < 10) {
            setError("Das Passwort muss mindestens 10 Zeichen lang sein.");
            return;
        }
        if (password !== passwordWiederholen) {
            setError("Die Passwörter stimmen nicht überein.");
            return;
        }
        setPhase("speichere");
        try {
            const sass = await createSPASassClient();
            const client = sass.getSupabaseClient();
            const { error: e } = await client.auth.updateUser({ password });
            if (e) throw e;
            setPhase("fertig");
            setTimeout(() => router.push("/app/onboarding"), 1200);
        } catch (err) {
            setError(friendlyError(err, { aktion: "Passwort konnte nicht gespeichert werden." }));
            setPhase("passwort");
        }
    };

    if (phase === "initialisiere") {
        return (
            <div className="text-center text-sm text-gray-600 py-8">Einladung wird geprüft…</div>
        );
    }

    if (phase === "fehler") {
        return (
            <div className="space-y-4">
                <h1 className="text-xl font-bold text-center">Einladung ungültig</h1>
                <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
                <p className="text-sm text-gray-600 text-center">
                    Bitte wende dich an deinen Administrator und lass dir eine neue Einladung schicken.
                </p>
            </div>
        );
    }

    if (phase === "fertig") {
        return (
            <div className="text-center py-8 space-y-3">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                <h1 className="text-xl font-bold">Willkommen bei Esska 👋</h1>
                <p className="text-sm text-gray-600">Du wirst zum Onboarding weitergeleitet…</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="text-center">
                <h1 className="text-2xl font-bold">Willkommen bei Esska 👋</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Schön, dass du dabei bist! Bitte setze jetzt ein Passwort für dein Konto.
                </p>
                {email && (
                    <p className="text-xs text-gray-500 mt-2">
                        Eingeladen als <span className="font-medium">{email}</span>
                    </p>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
                    <div className="relative">
                        <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={10}
                            placeholder="mindestens 10 Zeichen"
                            className="w-full border rounded-md pl-9 pr-3 py-2 text-sm"
                            autoFocus
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Passwort wiederholen</label>
                    <div className="relative">
                        <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="password"
                            value={passwordWiederholen}
                            onChange={(e) => setPasswordWiederholen(e.target.value)}
                            required
                            minLength={10}
                            className="w-full border rounded-md pl-9 pr-3 py-2 text-sm"
                        />
                    </div>
                </div>

                {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

                <button
                    type="submit"
                    disabled={phase === "speichere"}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                    {phase === "speichere" ? "Speichern…" : "Passwort setzen & loslegen"}
                </button>

                <p className="text-xs text-gray-500 text-center">
                    Nach dem Setzen des Passworts startet automatisch dein Onboarding (Stammdaten,
                    ggf. KuBe-Bogen, Ausweis-Upload).
                </p>
            </form>
        </div>
    );
}
