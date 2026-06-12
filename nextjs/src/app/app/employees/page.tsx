"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function EmployeesPage() {
    return (
        <div className="space-y-6 p-2 md:p-6">
            <h1 className="text-2xl font-bold">Mitarbeiter</h1>
            <Card>
                <CardHeader>
                    <CardTitle>In Arbeit</CardTitle>
                    <CardDescription>
                        Mitarbeiter-Einladungen, Stammdaten-Anzeige und Center-Zuordnung kommen im nächsten Entwicklungsschritt.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                        <li>Mitarbeiter per E-Mail einladen</li>
                        <li>Stammdaten und Onboarding-Status einsehen</li>
                        <li>Mitarbeiter zu Centern zuordnen</li>
                        <li>PDF-Downloads der ausgefüllten Formulare</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
