"use client";
import React from 'react';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Store, Users, CalendarDays, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const adminKacheln = [
    { href: '/app/centers', icon: Store, title: 'Center', text: 'Standorte anlegen und verwalten' },
    { href: '/app/employees', icon: Users, title: 'Mitarbeiter', text: 'Personal einladen und zuordnen' },
    { href: '/app/shifts', icon: CalendarDays, title: 'Schichtplan', text: 'Wochenpläne erstellen und veröffentlichen' },
    { href: '/app/sales', icon: TrendingUp, title: 'Umsätze', text: 'Tagesumsätze und Auswertungen' },
];

const mitarbeiterKacheln = [
    { href: '/app/my-centers', icon: Store, title: 'Meine Center', text: 'Standorte, denen ich zugeordnet bin' },
    { href: '/app/my-shifts', icon: CalendarDays, title: 'Meine Schichten', text: 'Veröffentlichte Wochenpläne' },
    { href: '/app/user-settings', icon: Users, title: 'Stammdaten', text: 'Persönliche Daten pflegen' },
];

export default function DashboardContent() {
    const { loading, user, role } = useGlobal();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const kacheln = role === 'admin' ? adminKacheln : mitarbeiterKacheln;
    const begruessung = role === 'admin' ? 'Admin-Übersicht' : 'Willkommen';

    return (
        <div className="space-y-6 p-6">
            <Card>
                <CardHeader>
                    <CardTitle>{begruessung}</CardTitle>
                    <CardDescription>
                        Angemeldet als {user?.email}
                    </CardDescription>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                {kacheln.map((kachel) => (
                    <Link
                        key={kachel.href}
                        href={kachel.href}
                        className="flex items-center gap-4 p-4 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <div className="p-3 bg-primary-50 rounded-full">
                            <kachel.icon className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                            <h3 className="font-medium">{kachel.title}</h3>
                            <p className="text-sm text-gray-500">{kachel.text}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
