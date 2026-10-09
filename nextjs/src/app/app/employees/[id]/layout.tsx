"use client";

import React from "react";
import NurAdmin from "@/components/esska/NurAdmin";

// Die Detailseite zeigt die vollstaendige Personalakte (Steuer-ID,
// RV-Nummer, Verdienst, Dokumente) - nur fuer Admins. Regionalmanager
// sehen ihre Mitarbeiter in der Uebersicht.
export default function MitarbeiterDetailLayout({ children }: { children: React.ReactNode }) {
    return (
        <NurAdmin
            hinweis="Die Personalakte ist der Verwaltung vorbehalten."
            zurueck={{ href: "/app/employees", text: "Zur Mitarbeiterübersicht" }}
        >
            {children}
        </NurAdmin>
    );
}
