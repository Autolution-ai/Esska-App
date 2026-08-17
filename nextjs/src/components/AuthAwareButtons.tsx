"use client";
import { useState, useEffect } from 'react';
import { createSPASassClient } from '@/lib/supabase/client';
import { ArrowRight } from 'lucide-react';
import Link from "next/link";

/**
 * Buttons auf der oeffentlichen Startseite.
 *
 * Bewusst KEIN Registrieren-Link: Zugaenge zur Esska-App vergibt
 * ausschliesslich der Admin per E-Mail-Einladung. Wer schon angemeldet
 * ist, wird direkt in die App geleitet.
 */
export default function AuthAwareButtons({ variant = 'primary' }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const supabase = await createSPASassClient();
                const { data: { user } } = await supabase.getSupabaseClient().auth.getUser();
                setIsAuthenticated(!!user);
            } catch (error) {
                console.error('Error checking auth status:', error);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    if (loading) {
        return null;
    }

    // Kompakter Button in der Kopfzeile
    if (variant === 'nav') {
        return (
            <Link
                href={isAuthenticated ? "/app" : "/auth/login"}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
                {isAuthenticated ? "Zur App" : "Anmelden"}
            </Link>
        );
    }

    // Grosser Button im oberen Bereich
    return (
        <Link
            href={isAuthenticated ? "/app" : "/auth/login"}
            className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 rounded-lg bg-primary-600 text-white text-lg font-medium hover:bg-primary-700 transition-colors"
        >
            {isAuthenticated ? "Zur App" : "Anmelden"}
            <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
    );
}
