import React from 'react';
import Link from 'next/link';
import { CalendarDays, Mail, Smartphone, Wallet } from 'lucide-react';
import AuthAwareButtons from '@/components/AuthAwareButtons';

export default function Home() {
    const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;

    // Was Mitarbeiter in der App tatsaechlich tun – zur Orientierung,
    // nicht als Werbung.
    const funktionen = [
        {
            icon: CalendarDays,
            titel: 'Wochenplan',
            text: 'Eintragen, wann du arbeiten kannst – und deine Schichten einsehen.',
        },
        {
            icon: Wallet,
            titel: 'Kasse melden',
            text: 'Bargeldbestand deiner Schicht erfassen.',
        },
        {
            icon: Smartphone,
            titel: 'Stammdaten',
            text: 'Deine Daten und Dokumente an einem Ort.',
        },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-secondary-50">
            {/* Kopfzeile */}
            <nav className="bg-white border-b border-secondary-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6">
                    <div className="flex justify-between h-16 items-center">
                        <span className="text-2xl font-bold text-primary-700">
                            {productName}
                        </span>
                        <AuthAwareButtons variant="nav" />
                    </div>
                </div>
            </nav>

            {/* Hauptbereich */}
            <main className="flex-1">
                <section className="px-4 sm:px-6 pt-12 pb-10 sm:pt-20 sm:pb-16">
                    <div className="max-w-xl mx-auto text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                            {productName} Collection
                        </h1>
                        <p className="text-2xl sm:text-3xl font-bold text-primary-700 mt-1">
                            Saison-App
                        </p>
                        <p className="mt-5 text-base sm:text-lg text-gray-600">
                            Wochenplan, Schichten und Kassenmeldung – alles an einem Ort,
                            direkt auf dem Handy.
                        </p>

                        <div className="mt-8">
                            <AuthAwareButtons />
                        </div>

                        {/* Hinweis fuer alle, die noch keinen Zugang haben */}
                        <div className="mt-6 flex items-start gap-2.5 text-left bg-white border border-secondary-200 rounded-lg p-4 text-sm text-gray-600">
                            <Mail className="h-5 w-5 shrink-0 mt-0.5 text-secondary-500" />
                            <p>
                                <strong className="text-gray-900">Noch keinen Zugang?</strong>{' '}
                                Du bekommst eine Einladung per E-Mail, sobald du für die Saison
                                eingeplant bist. Melde dich bei deiner Ansprechperson, falls die
                                E-Mail nicht angekommen ist.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Kurze Orientierung, was einen erwartet */}
                <section className="px-4 sm:px-6 pb-14">
                    <div className="max-w-xl mx-auto space-y-3">
                        {funktionen.map((f) => (
                            <div
                                key={f.titel}
                                className="flex items-start gap-4 bg-white border border-secondary-200 rounded-lg p-4"
                            >
                                <div className="p-2 bg-primary-50 rounded-lg shrink-0">
                                    <f.icon className="h-5 w-5 text-primary-600" />
                                </div>
                                <div>
                                    <h2 className="font-semibold">{f.titel}</h2>
                                    <p className="text-sm text-gray-600 mt-0.5">{f.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            {/* Fusszeile */}
            <footer className="bg-white border-t border-secondary-200">
                <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
                    <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm">
                        <Link href="/legal/privacy" className="text-gray-600 hover:text-gray-900">
                            Datenschutz
                        </Link>
                        <Link href="/legal/terms" className="text-gray-600 hover:text-gray-900">
                            Nutzungsbedingungen
                        </Link>
                    </div>
                    <p className="text-center text-sm text-gray-500 mt-6">
                        © {new Date().getFullYear()} {productName} Collection
                    </p>
                </div>
            </footer>
        </div>
    );
}
