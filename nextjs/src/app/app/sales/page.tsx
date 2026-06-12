"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function SalesPage() {
    return (
        <div className="space-y-6 p-2 md:p-6">
            <h1 className="text-2xl font-bold">Umsätze</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Etappe 3</CardTitle>
                    <CardDescription>
                        Tagesumsatz-Erfassung und Dashboard mit Diagrammen folgen in Etappe 3.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
}
