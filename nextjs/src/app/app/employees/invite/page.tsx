"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import type { EsskaCenter } from "@/lib/esska/types";

export default function InvitePage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    // M-1: optionale Center-Zuordnung schon beim Einladen
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [centerId, setCenterId] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const { data } = await client
                    .from("centers")
                    .select("*")
                    .in("status", ["aktiv", "geplant", "in_absprache"])
                    .order("name");
                setCenters((data as EsskaCenter[]) ?? []);
            } catch {
                // Dropdown bleibt leer - Einladen funktioniert trotzdem
            }
        };
        load();
    }, []);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        setResult(null);
        try {
            const res = await fetch("/api/employees/invite", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email, centerId: centerId || undefined }),
            });
            const data = await res.json();
            if (!res.ok) {
                setResult({ ok: false, message: data.error ?? "Einladung fehlgeschlagen" });
            } else {
                setResult({
                    ok: true,
                    message: data.hinweis ?? `Einladung an ${email} verschickt.`,
                });
                setEmail("");
            }
        } catch (err) {
            setResult({ ok: false, message: err instanceof Error ? err.message : "Netzwerkfehler" });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6 p-2 md:p-6 max-w-xl">
            <Link href="/app/employees" className="text-sm text-primary-600 hover:underline">
                ← Zurück zur Mitarbeiterliste
            </Link>
            <h1 className="text-2xl font-bold">Mitarbeiter einladen</h1>
            <p className="text-gray-600 text-sm">
                Der Mitarbeiter erhält eine E-Mail mit einem Link zum Setzen seines Passworts. Nach dem ersten
                Login durchläuft er das Onboarding (Stammdaten ausfüllen, ggf. KuBe-Bogen, Ausweis hochladen).
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 bg-white border rounded-lg p-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
                    <div className="relative">
                        <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="vorname.nachname@example.de"
                            className="w-full border rounded-md pl-9 pr-3 py-2 text-sm"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Center zuordnen (optional)
                    </label>
                    <select
                        value={centerId}
                        onChange={(e) => setCenterId(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                        <option value="">– später zuordnen –</option>
                        {centers.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} ({c.kuerzel}) · {c.stadt} · {c.saison}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                        Kann jederzeit über die Mitarbeiter-Detailseite geändert oder ergänzt werden.
                    </p>
                </div>
                {result && (
                    <div
                        className={`p-3 rounded-md text-sm ${
                            result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                        }`}
                    >
                        {result.message}
                    </div>
                )}
                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={sending}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                        {sending ? "Senden…" : "Einladung senden"}
                    </button>
                    <button type="button" onClick={() => router.push("/app/employees")} className="px-4 py-2 border rounded-md hover:bg-gray-50">
                        Abbrechen
                    </button>
                </div>
            </form>
        </div>
    );
}
