"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { getEsskaClient } from "@/lib/esska/client";
import { friendlyError } from "@/lib/esska/errors";
import type { EsskaProfile } from "@/lib/esska/types";
import { formatDate } from "@/lib/esska/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function EmployeesPage() {
    const [profiles, setProfiles] = useState<EsskaProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                const client = await getEsskaClient();
                const { data, error: e } = await client
                    .from("profiles")
                    .select("*")
                    .order("nachname", { ascending: true, nullsFirst: false });
                if (e) throw e;
                setProfiles((data as EsskaProfile[]) ?? []);
            } catch (err) {
                setError(friendlyError(err, { aktion: "Fehler beim Laden" }));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const sichtbar = profiles.filter((p) => {
        if (!filter) return true;
        const text = `${p.vorname ?? ""} ${p.nachname ?? ""} ${p.email ?? ""}`.toLowerCase();
        return text.includes(filter.toLowerCase());
    });

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

            <div className="relative max-w-md">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Name oder E-Mail suchen…"
                    className="w-full border rounded-md pl-9 pr-3 py-2 text-sm"
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Übersicht</CardTitle>
                    <CardDescription>
                        {loading ? "Lädt…" : `${sichtbar.length} Person${sichtbar.length === 1 ? "" : "en"}`}
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
                            Noch keine Mitarbeiter im System.
                        </div>
                    )}
                    {sichtbar.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-left">
                                    <tr>
                                        <Th>Name</Th>
                                        <Th>E-Mail</Th>
                                        <Th>Rolle</Th>
                                        <Th>Modell</Th>
                                        <Th>Onboarding</Th>
                                        <Th>Status</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sichtbar.map((p) => (
                                        <tr key={p.id} className="border-t hover:bg-gray-50">
                                            <Td>
                                                <Link href={`/app/employees/${p.id}`} className="text-primary-600 hover:underline">
                                                    {p.vorname || p.nachname ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() : "—"}
                                                </Link>
                                            </Td>
                                            <Td>{p.email ?? "—"}</Td>
                                            <Td>
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                                    p.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-800"
                                                }`}>
                                                    {p.role}
                                                </span>
                                            </Td>
                                            <Td>{p.arbeitszeit_modell ?? "—"}</Td>
                                            <Td>
                                                {p.onboarding_abgeschlossen ? (
                                                    <span className="text-green-700 text-xs">✓ am {formatDate(p.stammdaten_bestaetigt_am)}</span>
                                                ) : (
                                                    <span className="text-amber-700 text-xs">offen</span>
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
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return <th className="px-3 py-2 font-medium text-gray-700">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
    return <td className="px-3 py-2">{children}</td>;
}
