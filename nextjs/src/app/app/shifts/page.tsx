"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ShiftsPage() {
    return (
        <div className="space-y-6 p-2 md:p-6">
            <h1 className="text-2xl font-bold">Schichtplan</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Etappe 2</CardTitle>
                    <CardDescription>
                        Wochenplan-Editor und Verfügbarkeitsabfrage folgen in Etappe 2.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
}
