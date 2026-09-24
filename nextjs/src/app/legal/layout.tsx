"use client";
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, FileText, Shield, Users } from 'lucide-react';

// Dieselbe Reihenfolge und Beschreibung wie auf der Uebersicht /legal.
const rechtsdokumente = [
    {
        id: 'impressum',
        titel: 'Impressum',
        icon: FileText,
        text: 'Anbieterkennzeichnung nach § 5 DDG'
    },
    {
        id: 'datenschutz',
        titel: 'Datenschutzerklärung',
        icon: Shield,
        text: 'Wie diese Anwendung mit Daten umgeht'
    },
    {
        id: 'datenschutz-beschaeftigte',
        titel: 'Datenschutz für Beschäftigte',
        icon: Users,
        text: 'Welche Daten wir von dir verarbeiten und warum'
    },
    {
        id: 'nutzungsregeln',
        titel: 'Nutzungsregeln',
        icon: BookOpen,
        text: 'Regeln für die Nutzung der App'
    }
];

export default function LegalLayout({ children } : { children: React.ReactNode }) {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="py-6">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Zurück
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Seitennavigation */}
                    <div className="w-full lg:w-64 flex-shrink-0">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="p-4 border-b border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-900">Rechtliches</h2>
                                <p className="text-sm text-gray-500 mt-1">Impressum, Datenschutz und Nutzungsregeln</p>
                            </div>
                            <nav className="p-4 space-y-2">
                                {rechtsdokumente.map((dok) => (
                                    <Link
                                        key={dok.id}
                                        href={`/legal/${dok.id}`}
                                        className="block p-3 rounded-md hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <dok.icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{dok.titel}</div>
                                                <div className="text-xs text-gray-500">{dok.text}</div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Inhalt */}
                    <div className="flex-1">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
