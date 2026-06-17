"use client";

import React, { useState } from "react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaPensionExemption } from "@/lib/esska/types";

type Props = {
    profileId: string;
    /** Aus dem Profil vorgegebene RV-Nummer (Pflichtfeld in Stammdaten). */
    rentenversicherungsnummer: string | null;
    existing?: EsskaPensionExemption | null;
    onSaved: (e: EsskaPensionExemption) => void;
};

export default function PensionExemptionForm({
    profileId,
    rentenversicherungsnummer,
    existing,
    onSaved,
}: Props) {
    const [rvNr, setRvNr] = useState(
        existing?.rentenversicherungsnummer ?? rentenversicherungsnummer ?? ""
    );
    const [merkblatt, setMerkblatt] = useState(existing?.merkblatt_zur_kenntnis_genommen ?? false);
    const [ort, setOrt] = useState(existing?.unterzeichnet_ort ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rvNr.trim()) {
            setError("Bitte Rentenversicherungsnummer angeben.");
            return;
        }
        if (!merkblatt) {
            setError("Bitte das Merkblatt zur Kenntnis nehmen.");
            return;
        }
        if (!ort.trim()) {
            setError("Bitte Ort der Unterzeichnung angeben.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const client = await getEsskaClient();
            const payload = {
                profile_id: profileId,
                rentenversicherungsnummer: rvNr.trim(),
                merkblatt_zur_kenntnis_genommen: merkblatt,
                unterzeichnet_am: new Date().toISOString(),
                unterzeichnet_ort: ort.trim(),
            };
            const { data, error: e } = existing
                ? await client
                      .from("pension_exemptions")
                      .update(payload)
                      .eq("id", existing.id)
                      .select("*")
                      .single()
                : await client.from("pension_exemptions").insert(payload).select("*").single();
            if (e) throw e;
            onSaved(data as EsskaPensionExemption);
        } catch (err) {
            setError(friendlyError(err, { aktion: "Speichern fehlgeschlagen" }));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5 bg-white border rounded-lg p-4">
            <div>
                <h3 className="text-lg font-semibold">
                    Antrag auf Befreiung von der Rentenversicherungspflicht
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                    Gemäß § 6 Absatz 1b Sozialgesetzbuch VI · für geringfügig entlohnte Beschäftigung
                </p>
            </div>

            <div className="bg-secondary-50 border border-secondary-200 rounded-md p-3 text-sm text-gray-700">
                <strong>Kurzer Hinweis:</strong> Wir füllen dieses Formular vorsichtshalber bei allen
                Mitarbeitern aus. Falls du bei uns als geringfügig Beschäftigte/r (Minijob) eingestuft
                wirst, haben wir den Antrag dann sofort griffbereit. Es kommt nur dann zur Anwendung
                und ist für dich sonst ohne Auswirkung. Dauert keine 2 Minuten.
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Rentenversicherungsnummer</label>
                <input
                    value={rvNr}
                    onChange={(e) => setRvNr(e.target.value)}
                    required
                    placeholder="z. B. 65170839W001"
                    className="w-full border rounded-md px-3 py-2 text-sm font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                    Steht auf dem Sozialversicherungsausweis. Format: 11 Ziffern + 1 Buchstabe + 3 Ziffern.
                </p>
            </div>

            <div className="space-y-3 text-sm">
                <p className="font-medium">Erklärung:</p>
                <p className="text-gray-700 leading-relaxed">
                    Hiermit beantrage ich die Befreiung von der Versicherungspflicht in der
                    Rentenversicherung im Rahmen meiner geringfügig entlohnten Beschäftigung und
                    verzichte damit auf den Erwerb von Pflichtbeitragszeiten.
                </p>
                <p className="text-gray-700 leading-relaxed">
                    Mir ist bekannt, dass der Befreiungsantrag für alle von mir zeitgleich ausgeübten
                    geringfügig entlohnten Beschäftigungen gilt und für die Dauer der Beschäftigungen
                    bindend ist; eine Rücknahme ist nicht möglich. Ich verpflichte mich, alle weiteren
                    Arbeitgeber, bei denen ich eine geringfügig entlohnte Beschäftigung ausübe, über
                    diesen Befreiungsantrag zu informieren.
                </p>
                <label className="flex items-start gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={merkblatt}
                        onChange={(e) => setMerkblatt(e.target.checked)}
                        className="mt-1"
                    />
                    <span>
                        Ich habe die Hinweise auf dem Merkblatt über die möglichen Folgen einer
                        Befreiung von der Rentenversicherungspflicht zur Kenntnis genommen.
                    </span>
                </label>
            </div>

            <div className="max-w-xs">
                <label className="block text-sm font-medium mb-1">Ort der Unterzeichnung</label>
                <input
                    value={ort}
                    onChange={(e) => setOrt(e.target.value)}
                    required
                    placeholder="z. B. Dresden"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                    Datum wird automatisch gesetzt. Antrag gilt als digital unterzeichnet.
                </p>
            </div>

            {existing?.unterzeichnet_am && (
                <p className="text-xs text-gray-500">
                    Zuletzt unterzeichnet am {new Date(existing.unterzeichnet_am).toLocaleString("de-DE")}
                </p>
            )}

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

            <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
                {saving ? "Speichern…" : "Antrag absenden"}
            </button>
        </form>
    );
}
