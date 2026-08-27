"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaCenter, EsskaProfile } from "@/lib/esska/types";
import { addTage, formatDate, isoDatum, montagDerWoche } from "@/lib/esska/types";
import { useGlobal } from "@/lib/context/GlobalContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type AssignmentRow = { center_id: string; profile_id: string };

// Drei Wochen, fuer die der Verfuegbarkeits-Status angezeigt wird
const WOCHEN_LABELS = ["Diese Woche", "Nächste Woche", "Übernächste Woche"];

export default function EmployeesPage() {
    const router = useRouter();
    const { role, loading: globalLoading } = useGlobal();

    const [profiles, setProfiles] = useState<EsskaProfile[]>([]);
    const [centers, setCenters] = useState<EsskaCenter[]>([]);
    const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
    // profile_id -> [dieseWoche, naechste, uebernaechste] eingetragen?
    const [verfuegbarkeit, setVerfuegbarkeit] = useState<Record<string, boolean[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState("");
    const [centerFilter, setCenterFilter] = useState<string>("alle");
    const [gruppierung, setGruppierung] = useState<"keine" | "center" | "stadt">("keine");

    // Diese Seite ist eine reine Admin-Ansicht. Mitarbeiter wuerden durch RLS
    // ohnehin nur sich selbst sehen – wir leiten sie gar nicht erst hierher.
    useEffect(() => {
        if (!globalLoading && role === "mitarbeiter") {
            router.replace("/app");
        }
    }, [globalLoading, role, router]);

    const wochenStarts = useMemo(() => {
        const mo = montagDerWoche(new Date());
        return [mo, addTage(mo, 7), addTage(mo, 14)];
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const von = isoDatum(wochenStarts[0]);
                const bis = isoDatum(addTage(wochenStarts[2], 6));
                const [pRes, cRes, aRes, vRes] = await Promise.all([
                    client
                        .from("profiles")
                        .select("*")
                        .order("nachname", { ascending: true, nullsFirst: false }),
                    client.from("centers").select("*").order("saison", { ascending: false }).order("name"),
                    client.from("center_assignments").select("center_id, profile_id"),
                    client
                        .from("availabilities")
                        .select("profile_id, datum")
                        .gte("datum", von)
                        .lte("datum", bis),
                ]);
                if (pRes.error) throw pRes.error;
                if (cRes.error) throw cRes.error;
                if (aRes.error) throw aRes.error;
                if (vRes.error) throw vRes.error;
                setProfiles((pRes.data as EsskaProfile[]) ?? []);
                setCenters((cRes.data as EsskaCenter[]) ?? []);
                setAssignments((aRes.data as AssignmentRow[]) ?? []);

                // Pro Mitarbeiter und Woche: mindestens ein Eintrag = eingetragen
                const map: Record<string, boolean[]> = {};
                const grenzen = wochenStarts.map((w) => [isoDatum(w), isoDatum(addTage(w, 6))] as const);
                for (const row of (vRes.data as Array<{ profile_id: string; datum: string }>) ?? []) {
                    const arr = map[row.profile_id] ?? [false, false, false];
                    grenzen.forEach(([von2, bis2], i) => {
                        if (row.datum >= von2 && row.datum <= bis2) arr[i] = true;
                    });
                    map[row.profile_id] = arr;
                }
                setVerfuegbarkeit(map);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const centerVon = (profileId: string): EsskaCenter[] => {
        const ids = assignments.filter((a) => a.profile_id === profileId).map((a) => a.center_id);
        return centers.filter((c) => ids.includes(c.id));
    };

    const sichtbar = profiles.filter((p) => {
        if (filter) {
            const text = `${p.vorname ?? ""} ${p.nachname ?? ""} ${p.email ?? ""}`.toLowerCase();
            if (!text.includes(filter.toLowerCase())) return false;
        }
        if (centerFilter === "alle") return true;
        const meine = centerVon(p.id);
        if (centerFilter === "ohne") return meine.length === 0;
        return meine.some((c) => c.id === centerFilter);
    });

    // Gruppierte Darstellung: Gruppen-Schluessel -> Mitarbeiter.
    // Ein Mitarbeiter mit mehreren Centern erscheint in jeder seiner Gruppen.
    const gruppen = useMemo(() => {
        if (gruppierung === "keine") return null;
        const map = new Map<string, EsskaProfile[]>();
        const push = (schluessel: string, p: EsskaProfile) => {
            const arr = map.get(schluessel) ?? [];
            if (!arr.some((x) => x.id === p.id)) arr.push(p);
            map.set(schluessel, arr);
        };
        for (const p of sichtbar) {
            const meine = centerVon(p.id);
            if (meine.length === 0) {
                push("— Ohne Center —", p);
            } else {
                for (const c of meine) {
                    push(gruppierung === "center" ? `${c.name} (${c.kuerzel}) · ${c.stadt}` : c.stadt, p);
                }
            }
        }
        // Alphabetisch, "Ohne Center" ans Ende
        return [...map.entries()].sort(([a], [b]) => {
            if (a.startsWith("—")) return 1;
            if (b.startsWith("—")) return -1;
            return a.localeCompare(b, "de");
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gruppierung, sichtbar, assignments, centers]);

    if (!globalLoading && role === "mitarbeiter") return null;

    return (
        <div className="space-y-6 p-2 md:p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Mitarbeiter</h1>
                    <p className="text-gray-500">Eingeladene und registrierte Personen verwalten.</p>
                </div>
                <Link
                    href="/app/employees/invite"
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Mitarbeiter einladen
                </Link>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <div className="relative w-full max-w-xs">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Name oder E-Mail suchen…"
                        className="w-full border rounded-md pl-9 pr-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Center</label>
                    <select
                        value={centerFilter}
                        onChange={(e) => setCenterFilter(e.target.value)}
                        className="border rounded-md px-3 py-2 text-sm"
                    >
                        <option value="alle">Alle Center</option>
                        {centers.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} ({c.kuerzel}) · {c.stadt}
                            </option>
                        ))}
                        <option value="ohne">Ohne Center</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Gruppieren nach</label>
                    <select
                        value={gruppierung}
                        onChange={(e) => setGruppierung(e.target.value as typeof gruppierung)}
                        className="border rounded-md px-3 py-2 text-sm"
                    >
                        <option value="keine">Keine Gruppierung</option>
                        <option value="center">Center</option>
                        <option value="stadt">Stadt</option>
                    </select>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Übersicht</CardTitle>
                    <CardDescription>
                        {loading ? "Lädt…" : `${sichtbar.length} Person${sichtbar.length === 1 ? "" : "en"}`}
                        {" · Verfügbarkeiten: "}
                        {wochenStarts
                            .map((w, i) => `${WOCHEN_LABELS[i]} ab ${w.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`)
                            .join(" · ")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm mb-3">
                            {error}
                        </div>
                    )}
                    {!loading && sichtbar.length === 0 && (
                        <div className="text-center py-10 text-gray-500">
                            Keine Mitarbeiter für diese Auswahl.
                        </div>
                    )}
                    {sichtbar.length > 0 && gruppen === null && (
                        <MitarbeiterTabelle
                            personen={sichtbar}
                            centerVon={centerVon}
                            verfuegbarkeit={verfuegbarkeit}
                        />
                    )}
                    {sichtbar.length > 0 && gruppen !== null && (
                        <div className="space-y-6">
                            {gruppen.map(([schluessel, personen]) => (
                                <div key={schluessel}>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                        {schluessel}{" "}
                                        <span className="font-normal text-gray-400">({personen.length})</span>
                                    </h3>
                                    <MitarbeiterTabelle
                                        personen={personen}
                                        centerVon={centerVon}
                                        verfuegbarkeit={verfuegbarkeit}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function MitarbeiterTabelle({
    personen,
    centerVon,
    verfuegbarkeit,
}: {
    personen: EsskaProfile[];
    centerVon: (id: string) => EsskaCenter[];
    verfuegbarkeit: Record<string, boolean[]>;
}) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left">
                    <tr>
                        <Th>Name</Th>
                        <Th>E-Mail</Th>
                        <Th>Center</Th>
                        <Th>Rolle</Th>
                        <Th>Onboarding</Th>
                        <Th>Verfügbarkeit eingetragen</Th>
                        <Th>Status</Th>
                    </tr>
                </thead>
                <tbody>
                    {personen.map((p) => {
                        const meine = centerVon(p.id);
                        const wochen = verfuegbarkeit[p.id] ?? [false, false, false];
                        return (
                            <tr key={p.id} className="border-t hover:bg-gray-50">
                                <Td>
                                    <Link href={`/app/employees/${p.id}`} className="text-primary-600 hover:underline">
                                        {p.vorname || p.nachname ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() : "—"}
                                    </Link>
                                </Td>
                                <Td>{p.email ?? "—"}</Td>
                                <Td>
                                    {meine.length === 0
                                        ? "—"
                                        : meine.map((c) => `${c.kuerzel} (${c.stadt})`).join(", ")}
                                </Td>
                                <Td>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                                        p.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-800"
                                    }`}>
                                        {p.role}
                                    </span>
                                </Td>
                                <Td>
                                    {p.onboarding_abgeschlossen ? (
                                        <span className="text-green-700 text-xs">✓ am {formatDate(p.stammdaten_bestaetigt_am)}</span>
                                    ) : (
                                        <span className="text-amber-700 text-xs">offen</span>
                                    )}
                                </Td>
                                <Td>
                                    {p.role === "admin" ? (
                                        <span className="text-xs text-gray-400">—</span>
                                    ) : (
                                        <span className="inline-flex gap-1">
                                            {wochen.map((ok, i) => (
                                                <span
                                                    key={i}
                                                    title={`${WOCHEN_LABELS[i]}: ${ok ? "eingetragen" : "fehlt noch"}`}
                                                    className={`px-1.5 py-0.5 rounded text-xs ${
                                                        ok
                                                            ? "bg-green-100 text-green-800"
                                                            : "bg-red-50 text-red-700"
                                                    }`}
                                                >
                                                    {["Diese", "Nächste", "Übern."][i]} {ok ? "✓" : "✕"}
                                                </span>
                                            ))}
                                        </span>
                                    )}
                                </Td>
                                <Td>
                                    {p.aktiv ? (
                                        <span className="text-green-700 text-xs">aktiv</span>
                                    ) : (
                                        <span className="text-gray-500 text-xs">inaktiv</span>
                                    )}
                                </Td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
    return <td className="px-3 py-2">{children}</td>;
}
