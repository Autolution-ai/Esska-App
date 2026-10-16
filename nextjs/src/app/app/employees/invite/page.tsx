"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { useGlobal } from "@/lib/context/GlobalContext";
import type { EsskaCenter } from "@/lib/esska/types";
import Zugangsdaten, { type Zugang } from "@/components/esska/Zugangsdaten";

export default function InvitePage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    // M-1: optionale Center-Zuordnung schon beim Einladen
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [centerId, setCenterId] = useState("");
    const [rueckkehrer, setRueckkehrer] = useState(false);
    const { role, user } = useGlobal();
    // Regionalmanager: nur eigene Center, Zuordnung ist Pflicht
    const istRegional = role === "regionalmanager";
    const [mailAn, setMailAn] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const { data } = await client
                    .from("centers")
                    .select("*")
                    .in("status", ["aktiv", "geplant", "in_absprache"])
                    .order("name");
                const alle = (data as EsskaCenter[]) ?? [];
                setCenters(istRegional ? alle.filter((c) => c.manager_id === user?.id) : alle);
            } catch {
                // Dropdown bleibt leer - Einladen funktioniert trotzdem
            }
        };
        load();
    }, [istRegional, user?.id]);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [zugang, setZugang] = useState<Zugang | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (istRegional && !centerId) {
            setResult({ ok: false, message: "Bitte ein Center auswählen." });
            return;
        }
        setSending(true);
        setResult(null);
        setZugang(null);
        setMailAn(null);
        try {
            const res = await fetch("/api/employees/invite", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email, centerId: centerId || undefined, rueckkehrer }),
            });
            const data = await res.json();
            if (!res.ok) {
                setResult({ ok: false, message: data.error ?? "Zugang konnte nicht angelegt werden." });
            } else {
                // Hinweis nur zeigen, wenn etwas schiefging (z. B. Center-Zuordnung)
                setResult(data.hinweis ? { ok: false, message: data.hinweis } : null);
                setMailAn(data.mail_verschickt ? (data.zugang?.email ?? null) : null);
                if (data.zugang) setZugang(data.zugang as Zugang);
                setEmail("");
                setRueckkehrer(false);
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
            <h1 className="text-2xl font-bold">Mitarbeiter anlegen</h1>
            <p className="text-gray-600 text-sm">
                Der Zugang wird sofort angelegt, und die Person bekommt ihre Zugangsdaten per E-Mail.
                Zusätzlich erscheinen sie hier zum Kopieren, z. B. für WhatsApp. Nach dem ersten Login
                durchläuft sie das Onboarding (Stammdaten, ggf. KuBe-Bogen, Ausweis hochladen).
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
                        {istRegional ? "Center" : "Center zuordnen (optional)"}
                    </label>
                    <select
                        value={centerId}
                        onChange={(e) => setCenterId(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                        <option value="">{istRegional ? "– bitte wählen –" : "– später zuordnen –"}</option>
                        {centers.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} ({c.kuerzel}) · {c.stadt} · {c.saison}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                        {istRegional
                            ? "Du kannst Mitarbeiter nur für deine eigenen Center anlegen."
                            : "Kann jederzeit über die Mitarbeiter-Detailseite geändert oder ergänzt werden."}
                    </p>
                </div>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                        type="checkbox"
                        checked={rueckkehrer}
                        onChange={(e) => setRueckkehrer(e.target.checked)}
                        className="mt-1"
                    />
                    <span>
                        <span className="font-medium">War letzte Saison schon dabei</span>
                        <span className="block text-xs text-gray-500">
                            Verkürzter Personalfragebogen: Steuer-, Sozialversicherungs- und Geburtsdaten
                            werden nicht erneut abgefragt. RV-Befreiung, KuBe-Erklärung und aktuelle
                            Nachweise bleiben Pflicht.
                        </span>
                    </span>
                </label>
                {mailAn && (
                    <div className="p-3 rounded-md text-sm bg-green-50 text-green-700">
                        Zugang angelegt. Die Zugangsdaten wurden per E-Mail an {mailAn} geschickt.
                    </div>
                )}
                {zugang && (
                    <Zugangsdaten
                        zugang={zugang}
                        titel={
                            mailAn
                                ? "Falls die Mail nicht ankommt (Spam-Ordner?), diesen Text weiterleiten:"
                                : "Zugang angelegt – diesen Text an den Mitarbeiter schicken:"
                        }
                    />
                )}
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
                        {sending ? "Wird angelegt…" : "Zugang anlegen"}
                    </button>
                    <button type="button" onClick={() => router.push("/app/employees")} className="px-4 py-2 border rounded-md hover:bg-gray-50">
                        Abbrechen
                    </button>
                </div>
            </form>
        </div>
    );
}
