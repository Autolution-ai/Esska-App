"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function MyShiftsPage() {
    return (
        <div className="space-y-6 p-2 md:p-6">
            <h1 className="text-2xl font-bold">Meine Schichten</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Etappe 2</CardTitle>
                    <CardDescription>
                        Sobald der Schichtplan-Editor gebaut ist, siehst du hier deine veröffentlichten Schichten.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
}
