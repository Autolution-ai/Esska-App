"use client";

import React from "react";
import Link from "next/link";
import { useGlobal } from "@/lib/context/GlobalContext";

/** Zeigt den Inhalt nur Admins. Alle anderen sehen einen kurzen Hinweis mit
 *  Rueckweg. Die eigentliche Absicherung liegt in der Datenbank; das hier
 *  verhindert, dass Regionalmanager oder Mitarbeiter in Seiten geraten,
 *  deren Daten oder Aktionen ihnen nicht zustehen. */
export default function NurAdmin({
    children,
    hinweis,
    zurueck,
}: {
    children: React.ReactNode;
    hinweis: string;
    zurueck: { href: string; text: string };
}) {
    const { role, loading } = useGlobal();
    if (loading || role === null) return null;
    if (role !== "admin") {
        return (
            <div className="p-6 text-sm text-gray-600 space-y-2">
                <p>{hinweis}</p>
                <Link href={zurueck.href} className="text-primary-600 hover:underline">
                    {zurueck.text}
                </Link>
            </div>
        );
    }
    return <>{children}</>;
}
