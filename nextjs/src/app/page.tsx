import React from 'react';
import Link from 'next/link';
import { CalendarDays, Shield, Store, TrendingUp } from 'lucide-react';
import AuthAwareButtons from '@/components/AuthAwareButtons';

export default function Home() {
  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;

  const features = [
    {
      icon: Store,
      title: 'Center-Verwaltung',
      description: 'Standorte je Saison anlegen, verwalten und Mitarbeiter zuordnen',
      color: 'text-primary-600'
    },
    {
      icon: CalendarDays,
      title: 'Verfügbarkeit & Schichtplan',
      description: 'Verfügbarkeiten pflegen, Wochenpläne erstellen und veröffentlichen',
      color: 'text-primary-600'
    },
    {
      icon: TrendingUp,
      title: 'Umsatzreporting',
      description: 'Tagesumsätze je Center erfassen und über Zeit und Standort auswerten',
      color: 'text-primary-600'
    },
    {
      icon: Shield,
      title: 'Sicher & DSGVO-konform',
      description: 'Verschlüsselte Datenhaltung in der EU mit klarer Rollentrennung',
      color: 'text-primary-600'
    }
  ];

  return (
      <div className="min-h-screen">
        <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-sm z-50 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex-shrink-0">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
                {productName}
              </span>
              </div>
              <div className="flex items-center space-x-8">
                <AuthAwareButtons variant="nav" />
              </div>
            </div>
          </div>
        </nav>

        <section className="relative pt-32 pb-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                {productName} Collection
                <span className="block text-primary-600">Saison-App</span>
              </h1>
              <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
                Personal, Schichtplanung und Umsatzreporting für alle Center an einem Ort.
              </p>
              <div className="mt-10 flex gap-4 justify-center">
                <AuthAwareButtons />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8">
              {features.map((feature, index) => (
                  <div
                      key={index}
                      className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                  >
                    <feature.icon className={`h-8 w-8 ${feature.color}`} />
                    <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-gray-600">{feature.description}</p>
                  </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="bg-gray-50 border-t border-gray-200">
          <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-center gap-8">
              <Link href="/legal/privacy" className="text-gray-600 hover:text-gray-900">
                Datenschutz
              </Link>
              <Link href="/legal/terms" className="text-gray-600 hover:text-gray-900">
                Nutzungsbedingungen
              </Link>
            </div>
            <div className="mt-8 pt-8 border-t border-gray-200">
              <p className="text-center text-gray-600">
                © {new Date().getFullYear()} {productName} Collection
              </p>
            </div>
          </div>
        </footer>
      </div>
  );
}
