"use client";

import React from "react";
import NurAdmin from "@/components/esska/NurAdmin";

// Center anlegen und pflegen ist dem Admin vorbehalten (Vorgabe Oktober 2026).
// Regionalmanager planen ihre Center ueber den Schichtplan.
export default function CentersLayout({ children }: { children: React.ReactNode }) {
    return (
        <NurAdmin
            hinweis="Die Center-Verwaltung ist der Verwaltung vorbehalten."
            zurueck={{ href: "/app/shifts", text: "Zum Schichtplan" }}
        >
            {children}
        </NurAdmin>
    );
}
