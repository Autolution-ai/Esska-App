"use client";

import React from "react";
import NurAdmin from "@/components/esska/NurAdmin";

export default function MitarbeiterAnlegenLayout({ children }: { children: React.ReactNode }) {
    return (
        <NurAdmin
            rollen={["admin", "regionalmanager"]}
            hinweis="Mitarbeiter anlegen ist der Verwaltung und den Regionalmanagern vorbehalten."
            zurueck={{ href: "/app/employees", text: "Zur Mitarbeiterübersicht" }}
        >
            {children}
        </NurAdmin>
    );
}
