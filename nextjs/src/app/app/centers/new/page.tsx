"use client";

import React from "react";
import Link from "next/link";
import CenterForm from "../CenterForm";

export default function NewCenterPage() {
    return (
        <div className="space-y-6 p-2 md:p-6">
            <div>
                <Link href="/app/centers" className="text-sm text-primary-600 hover:underline">
                    ← Zurück zur Center-Liste
                </Link>
                <h1 className="text-2xl font-bold mt-2">Neues Center anlegen</h1>
                <p className="text-gray-500">
                    Fläche und Mietdauer werden automatisch berechnet, können aber überschrieben werden.
                </p>
            </div>
            <CenterForm />
        </div>
    );
}
