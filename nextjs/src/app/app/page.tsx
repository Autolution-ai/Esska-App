"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CalendarDays, CreditCard, ShoppingCart, Store, TrendingUp, User, Users } from 'lucide-react';
import Link from 'next/link';
import InstallHinweis from '@/components/esska/InstallHinweis';

type Kachel = { href: string; icon: typeof Store; title: string; text: string };

const adminKacheln: Kachel[] = [
    { href: '/app/sales', icon: TrendingUp, title: 'Umsätze', text: 'Kassenmeldungen aller Center, Exporte' },
    { href: '/app/shifts', icon: CalendarDays, title: 'Schichtplan', text: 'Wochenpläne erstellen und veröffentlichen' },
    { href: '/app/employees', icon: Users, title: 'Mitarbeiter', text: 'Personal einladen und zuordnen' },
    { href: '/app/centers', icon: Store, title: 'Center', text: 'Standorte anlegen und verwalten' },
    { href: '/app/sales/cards', icon: CreditCard, title: 'Karteneinnahmen', text: 'Kartenumsätze je Center und Tag' },
    { href: '/app/orders', icon: ShoppingCart, title: 'Bestellungen', text: 'Warenbestellungen der Center' },
];

const managerKacheln: Kachel[] = adminKacheln.filter((k) => k.href !== '/app/sales/cards');

const mitarbeiterKacheln: Kachel[] = [
    { href: '/app/availability', icon: CalendarDays, title: 'Verfügbarkeit', text: 'Wann kannst du arbeiten?' },
    { href: '/app/my-shifts', icon: CalendarDays, title: 'Meine Schichten', text: 'Deine veröffentlichten Einsätze' },
    { href: '/app/orders', icon: ShoppingCart, title: 'Ware bestellen', text: 'Nachschub für deinen Stand' },
    { href: '/app/user-settings', icon: User, title: 'Stammdaten', text: 'Persönliche Daten pflegen' },
];

export default function DashboardContent() {
    const { loading, user, role, onboardingAbgeschlossen } = useGlobal();
    const router = useRouter();

    useEffect(() => {
        if (!loading && role === 'mitarbeiter' && onboardingAbgeschlossen === false) {
            router.replace('/app/onboarding');
        }
    }, [loading, role, onboardingAbgeschlossen, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const istMitarbeiter = role === 'mitarbeiter';
    const kacheln =
        role === 'admin' ? adminKacheln : role === 'regionalmanager' ? managerKacheln : mitarbeiterKacheln;
    const begruessung =
        role === 'admin' ? 'Admin-Übersicht' : role === 'regionalmanager' ? 'Regionalleitung' : 'Willkommen';

    return (
        <div className="space-y-6 p-4 md:p-6">
            <InstallHinweis />

            <Card>
                <CardHeader>
                    <CardTitle>{begruessung}</CardTitle>
                    <CardDescription>Angemeldet als {user?.email}</CardDescription>
                </CardHeader>
            </Card>

            {/* Haupt-Aktion: taeglich gebraucht, deshalb ganz oben und gross */}
            {istMitarbeiter && (
                <Link
                    href="/app/sales/new"
                    className="flex items-center gap-4 p-5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                >
                    <div className="p-3 bg-white/15 rounded-full">
                        <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Umsatz melden</h3>
                        <p className="text-sm text-white/85">
                            Kassenbestand deiner Schicht eintragen – am besten direkt nach Schichtende.
                        </p>
                    </div>
                </Link>
            )}

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
