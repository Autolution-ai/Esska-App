"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Edit, FileDown, Mail, Plus, Trash2, UserX } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter, EsskaKubeDeclaration, EsskaProfile, EsskaRole } from "@/lib/esska/types";
import { centToEuro, formatDate, formatMoney } from "@/lib/esska/types";
import { generiereKubePdf, generiereStammdatenPdf, pdfHerunterladen } from "@/lib/esska/pdf";
import DokumenteUpload from "@/components/esska/DokumenteUpload";
import StammdatenForm from "@/components/esska/StammdatenForm";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

type AssignmentRow = {
    id: string;
    rolle_im_center: string | null;
    center: EsskaCenter;
};

export default function EmployeeDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const [profile, setProfile] = useState<EsskaProfile | null>(null);
    const [kubes, setKubes] = useState<EsskaKubeDeclaration[]>([]);
    const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [selectedCenterId, setSelectedCenterId] = useState("");
    const [rolleImCenter, setRolleImCenter] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [editStammdaten, setEditStammdaten] = useState(false);

    const reload = async () => {
        try {
            const client = await getEsskaClient();
            const [pRes, aRes, cRes, kRes] = await Promise.all([
                client.from("profiles").select("*").eq("id", params.id).single(),
                client
                    .from("center_assignments")
                    .select("id, rolle_im_center, centers(*)")
                    .eq("profile_id", params.id),
                client.from("centers").select("*").order("saison", { ascending: false }),
                client.from("kube_declarations").select("*").eq("profile_id", params.id).order("saison", { ascending: false }),
            ]);
            if (pRes.error) throw pRes.error;
            if (aRes.error) throw aRes.error;
            if (cRes.error) throw cRes.error;
            setKubes((kRes.data as EsskaKubeDeclaration[]) ?? []);

            setProfile(pRes.data as EsskaProfile);
            const rows = ((aRes.data as unknown) as Array<{ id: string; rolle_im_center: string | null; centers: EsskaCenter | null }> ?? []).flatMap((r) =>
                r.centers ? [{ id: r.id, rolle_im_center: r.rolle_im_center, center: r.centers }] : []
            );
            setAssignments(rows);
            setCenters((cRes.data as EsskaCenter[]) ?? []);
        } catch (err) {
            setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
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
            setError(friendlyError(err, { aktion: "Zuordnung fehlgeschlagen" }));
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
            setError(friendlyError(err, { aktion: "Entfernen fehlgeschlagen" }));
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
            setError(friendlyError(err, { aktion: "Rolle konnte nicht geändert werden" }));
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
            setError(friendlyError(err, { aktion: "Status konnte nicht geändert werden" }));
        } finally {
            setBusy(false);
        }
    };

    const handleReinvite = async () => {
        if (!profile) return;
        setBusy(true);
        setError(null);
        setInfo(null);
        try {
            const res = await fetch(`/api/employees/${profile.id}/reinvite`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error ?? "Erneutes Einladen fehlgeschlagen");
            } else {
                setInfo(`Neue Einladung an ${data.email ?? profile.email} verschickt. Der alte Link ist jetzt ungültig.`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Netzwerkfehler");
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!profile) return;
        const name = profile.vorname || profile.nachname
            ? `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim()
            : profile.email ?? "diesen Mitarbeiter";
        const bestaetigt = confirm(
            `${name} wird unwiderruflich gelöscht – inklusive aller Stammdaten, Schichten, Verfügbarkeiten und Dokumente.\n\nWirklich löschen?`
        );
        if (!bestaetigt) return;
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/employees/${profile.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error ?? "Löschen fehlgeschlagen");
                setBusy(false);
                return;
            }
            router.push("/app/employees");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Netzwerkfehler");
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
            <div className="flex flex-wrap items-start justify-between gap-4">
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
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setEditStammdaten((v) => !v)}
                        disabled={busy}
                        className="inline-flex items-center px-3 py-2 border rounded-md text-sm hover:bg-secondary-100 disabled:opacity-50"
                    >
                        <Edit className="h-4 w-4 mr-2" />
                        {editStammdaten ? "Bearbeitung schließen" : "Stammdaten bearbeiten"}
                    </button>
                    {!profile.onboarding_abgeschlossen && (
                        <button
                            onClick={handleReinvite}
                            disabled={busy}
                            className="inline-flex items-center px-3 py-2 border rounded-md text-sm hover:bg-secondary-100 disabled:opacity-50"
                            title="Frische Einladungsmail verschicken, alter Link wird ungültig"
                        >
                            <Mail className="h-4 w-4 mr-2" />
                            Erneut einladen
                        </button>
                    )}
                    <button
                        onClick={handleDelete}
                        disabled={busy}
                        className="inline-flex items-center px-3 py-2 border border-red-300 text-red-700 rounded-md text-sm hover:bg-red-50 disabled:opacity-50"
                        title="Mitarbeiter komplett löschen"
                    >
                        <UserX className="h-4 w-4 mr-2" />
                        Löschen
                    </button>
                </div>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
            {info && <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{info}</div>}

            {editStammdaten && (
                <Card>
                    <CardHeader>
                        <CardTitle>Stammdaten bearbeiten</CardTitle>
                        <CardDescription>
                            Änderungen werden direkt gespeichert. Der Mitarbeiter sieht die neuen Werte sofort
                            unter &bdquo;Einstellungen &amp; Stammdaten&ldquo;.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <StammdatenForm
                            profile={profile}
                            onSaved={(p) => {
                                setProfile(p);
                                setInfo("Stammdaten gespeichert.");
                            }}
                        />
                    </CardContent>
                </Card>
            )}

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
                    <CardTitle>Formulare & Personalakte</CardTitle>
                    <CardDescription>Ausgefüllte Formulare als PDF herunterladen, Dokumente einsehen.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={async () => {
                                const bytes = await generiereStammdatenPdf(profile);
                                pdfHerunterladen(bytes, `Personalfragebogen_${profile.nachname ?? "Mitarbeiter"}.pdf`);
                            }}
                            className="inline-flex items-center px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
                        >
                            <FileDown className="h-4 w-4 mr-2" />
                            Personalfragebogen (PDF)
                        </button>
                        {kubes.map((k) => (
                            <button
                                key={k.id}
                                onClick={async () => {
                                    const bytes = await generiereKubePdf(k, profile);
                                    pdfHerunterladen(bytes, `KuBe_${k.saison.replace("/", "-")}_${profile.nachname ?? "Mitarbeiter"}.pdf`);
                                }}
                                className="inline-flex items-center px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
                            >
                                <FileDown className="h-4 w-4 mr-2" />
                                KuBe-Erklärung {k.saison} (PDF)
                            </button>
                        ))}
                        {kubes.length === 0 && (
                            <span className="text-sm text-gray-500 self-center">
                                Noch keine KuBe-Statuserklärung abgegeben.
                            </span>
                        )}
                    </div>
                    <div className="border-t pt-4">
                        <p className="text-sm font-medium mb-2">Hochgeladene Dokumente</p>
                        <DokumenteUpload profileId={profile.id} />
                    </div>
                </CardContent>
            </Card>

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
