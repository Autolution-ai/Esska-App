"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import type { EsskaCenter, EsskaProfile, EsskaRole } from "@/lib/esska/types";
import { centToEuro, formatDate, formatMoney } from "@/lib/esska/types";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

type AssignmentRow = {
    id: string;
    rolle_im_center: string | null;
    center: EsskaCenter;
};

export default function EmployeeDetailPage() {
    const params = useParams<{ id: string }>();
    const [profile, setProfile] = useState<EsskaProfile | null>(null);
    const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [selectedCenterId, setSelectedCenterId] = useState("");
    const [rolleImCenter, setRolleImCenter] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = async () => {
        try {
            const client = await getEsskaClient();
            const [pRes, aRes, cRes] = await Promise.all([
                client.from("profiles").select("*").eq("id", params.id).single(),
                client
                    .from("center_assignments")
                    .select("id, rolle_im_center, centers(*)")
                    .eq("profile_id", params.id),
                client.from("centers").select("*").order("saison", { ascending: false }),
            ]);
            if (pRes.error) throw pRes.error;
            if (aRes.error) throw aRes.error;
            if (cRes.error) throw cRes.error;

            setProfile(pRes.data as EsskaProfile);
            const rows = ((aRes.data as unknown) as Array<{ id: string; rolle_im_center: string | null; centers: EsskaCenter | null }> ?? []).flatMap((r) =>
                r.centers ? [{ id: r.id, rolle_im_center: r.rolle_im_center, center: r.centers }] : []
            );
            setAssignments(rows);
            setCenters((cRes.data as EsskaCenter[]) ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Fehler beim Laden");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        reload();
    }, [params.id]);

    const handleAssign = async () => {
        if (!selectedCenterId) return;
        setBusy(true);
        setError(null);
        try {
            const client = await getEsskaClient();
            const { error: e } = await client.from("center_assignments").insert({
                center_id: selectedCenterId,
                profile_id: params.id,
                rolle_im_center: rolleImCenter || null,
            });
            if (e) throw e;
            setSelectedCenterId("");
            setRolleImCenter("");
            await reload();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Zuordnung fehlgeschlagen");
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async (assignmentId: string) => {
        if (!confirm("Zuordnung wirklich entfernen?")) return;
        setBusy(true);
        try {
            const client = await getEsskaClient();
            const { error: e } = await client.from("center_assignments").delete().eq("id", assignmentId);
            if (e) throw e;
            await reload();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Entfernen fehlgeschlagen");
        } finally {
            setBusy(false);
        }
    };

    const handleRoleChange = async (newRole: EsskaRole) => {
        if (!profile) return;
        if (!confirm(`Rolle wirklich auf "${newRole}" setzen?`)) return;
        setBusy(true);
        try {
            const client = await getEsskaClient();
            const { data, error: e } = await client
                .from("profiles")
                .update({ role: newRole })
                .eq("id", profile.id)
                .select("*")
                .single();
            if (e) throw e;
            setProfile(data as EsskaProfile);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Rolle konnte nicht geändert werden");
        } finally {
            setBusy(false);
        }
    };

    const handleAktivToggle = async () => {
        if (!profile) return;
        setBusy(true);
        try {
            const client = await getEsskaClient();
            const { data, error: e } = await client
                .from("profiles")
                .update({ aktiv: !profile.aktiv })
                .eq("id", profile.id)
                .select("*")
                .single();
            if (e) throw e;
            setProfile(data as EsskaProfile);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Status konnte nicht geändert werden");
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <div className="p-6 text-gray-500">Lädt…</div>;
    if (!profile) {
        return (
            <div className="p-6">
                <Link href="/app/employees" className="text-sm text-primary-600 hover:underline">
                    ← Zurück
                </Link>
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                    {error ?? "Mitarbeiter nicht gefunden."}
                </div>
            </div>
        );
    }

    const verfuegbareCenter = centers.filter((c) => !assignments.some((a) => a.center.id === c.id));

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div>
                <Link href="/app/employees" className="text-sm text-primary-600 hover:underline">
                    ← Zurück zur Mitarbeiterliste
                </Link>
                <h1 className="text-2xl font-bold mt-2">
                    {profile.vorname || profile.nachname
                        ? `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim()
                        : profile.email ?? "Unbenannt"}
                </h1>
                <p className="text-gray-500">{profile.email}</p>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Account</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Row label="Rolle">
                            <select
                                value={profile.role}
                                onChange={(e) => handleRoleChange(e.target.value as EsskaRole)}
                                disabled={busy}
                                className="border rounded-md px-2 py-1 text-sm"
                            >
                                <option value="mitarbeiter">mitarbeiter</option>
                                <option value="admin">admin</option>
                            </select>
                        </Row>
                        <Row label="Aktiv">
                            <button onClick={handleAktivToggle} disabled={busy} className="text-sm underline">
                                {profile.aktiv ? "aktiv – deaktivieren" : "inaktiv – aktivieren"}
                            </button>
                        </Row>
                        <Row label="Onboarding">
                            {profile.onboarding_abgeschlossen
                                ? `abgeschlossen am ${formatDate(profile.stammdaten_bestaetigt_am)}`
                                : "offen"}
                        </Row>
                        <Row label="Angelegt">{formatDate(profile.created_at)}</Row>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Beschäftigung</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Row label="Modell">{profile.arbeitszeit_modell ?? "—"}</Row>
                        <Row label="Stunden/Woche">{profile.stunden_pro_woche ?? "—"}</Row>
                        <Row label="Verdienst/Monat">
                            {profile.verdienst_monat_eur_cent ? `${centToEuro(profile.verdienst_monat_eur_cent)} €` : "—"}
                        </Row>
                        <Row label="Eintritt">{formatDate(profile.eintrittsdatum)}</Row>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Persönliche Daten</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Row label="Geburtsdatum">{formatDate(profile.geburtsdatum)}</Row>
                        <Row label="Geburtsort">{profile.geburtsort ?? "—"}</Row>
                        <Row label="Staatsangehörigkeit">{profile.staatsangehoerigkeit ?? "—"}</Row>
                        <Row label="Familienstand">{profile.familienstand ?? "—"}</Row>
                        <Row label="Anschrift">
                            {profile.anschrift_strasse
                                ? `${profile.anschrift_strasse}, ${profile.anschrift_plz ?? ""} ${profile.anschrift_ort ?? ""}`
                                : "—"}
                        </Row>
                        <Row label="Mobil">{profile.telefon_mobil ?? "—"}</Row>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Sozialversicherung & Steuer</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Row label="RV-Nummer">{profile.rentenversicherungsnummer ?? "—"}</Row>
                        <Row label="KV">
                            {profile.krankenversicherung_name
                                ? `${profile.krankenversicherung_name} (${profile.krankenversicherung_status})`
                                : "—"}
                        </Row>
                        <Row label="RV-Befreiung">{profile.rentenversicherung_befreit ? "ja" : "nein"}</Row>
                        <Row label="Steuer-ID">{profile.steuer_id ?? "—"}</Row>
                        <Row label="Steuerklasse">{profile.steuerklasse ?? "—"}</Row>
                        <Row label="Kinderfreibetrag">{profile.kinderfreibetrag ?? "—"}</Row>
                        <Row label="Konfession">{profile.konfession ?? "—"}</Row>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Center-Zuordnungen</CardTitle>
                    <CardDescription>Wo arbeitet diese Person in welcher Saison?</CardDescription>
                </CardHeader>
                <CardContent>
                    {assignments.length === 0 ? (
                        <p className="text-sm text-gray-500">Noch keinem Center zugeordnet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {assignments.map((a) => (
                                <li key={a.id} className="flex items-center justify-between border rounded-md p-3 text-sm">
                                    <div>
                                        <Link href={`/app/centers/${a.center.id}`} className="font-medium text-primary-600 hover:underline">
                                            {a.center.name}
                                        </Link>{" "}
                                        <span className="text-gray-500">
                                            ({a.center.kuerzel}) · Saison {a.center.saison} · {formatMoney(a.center.miete_eur_cent)}
                                        </span>
                                        {a.rolle_im_center && (
                                            <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                                                {a.rolle_im_center}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleRemove(a.id)}
                                        disabled={busy}
                                        className="text-red-600 hover:text-red-800"
                                        title="Zuordnung entfernen"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {verfuegbareCenter.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                            <p className="text-sm font-medium mb-2">Weiteres Center zuordnen</p>
                            <div className="flex flex-col md:flex-row gap-2">
                                <select
                                    value={selectedCenterId}
                                    onChange={(e) => setSelectedCenterId(e.target.value)}
                                    className="border rounded-md px-3 py-2 text-sm flex-1"
                                >
                                    <option value="">– Center wählen –</option>
                                    {verfuegbareCenter.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({c.kuerzel}) · {c.saison}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    value={rolleImCenter}
                                    onChange={(e) => setRolleImCenter(e.target.value)}
                                    placeholder="Rolle im Center (optional)"
                                    className="border rounded-md px-3 py-2 text-sm flex-1"
                                />
                                <button
                                    onClick={handleAssign}
                                    disabled={!selectedCenterId || busy}
                                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Zuordnen
                                </button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-4 text-sm border-b last:border-0 py-1.5">
            <dt className="text-gray-500">{label}</dt>
            <dd className="text-gray-900 text-right">{children}</dd>
        </div>
    );
}
