"use client";

import React from "react";
import NurAdmin from "@/components/esska/NurAdmin";

// Die Detailseite zeigt die vollstaendige Personalakte (Steuer-ID,
// RV-Nummer, Verdienst, Dokumente). Admins: alles. Regionalmanager (seit
// 23.10.2026): nur lesen, nur Mitarbeiter ihrer Center - die Datenbank
// liefert ihnen andere gar nicht.
export default function MitarbeiterDetailLayout({ children }: { children: React.ReactNode }) {
    return (
        <NurAdmin
            rollen={["admin", "regionalmanager"]}
            hinweis="Die Personalakte ist der Verwaltung und den Regionalmanagern vorbehalten."
            zurueck={{ href: "/app/employees", text: "Zur Mitarbeiterübersicht" }}
        >
            {children}
        </NurAdmin>
    );
}
