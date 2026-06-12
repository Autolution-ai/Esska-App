// src/lib/context/GlobalContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client';
import type { EsskaRole } from '@/lib/esska/types';
import type { SupabaseClient } from '@supabase/supabase-js';


type User = {
    email: string;
    id: string;
    registered_at: Date;
};

interface GlobalContextType {
    loading: boolean;
    user: User | null;
    role: EsskaRole | null;
    onboardingAbgeschlossen: boolean | null;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function GlobalProvider({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<EsskaRole | null>(null);
    const [onboardingAbgeschlossen, setOnboardingAbgeschlossen] = useState<boolean | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const supabase = await createSPASassClient();
                const client = supabase.getSupabaseClient() as unknown as SupabaseClient;

                const { data: { user } } = await client.auth.getUser();
                if (!user) {
                    throw new Error('User not found');
                }

                setUser({
                    email: user.email!,
                    id: user.id,
                    registered_at: new Date(user.created_at)
                });

                const { data: profile } = await client
                    .from('profiles')
                    .select('role, onboarding_abgeschlossen')
                    .eq('id', user.id)
                    .single();

                if (profile?.role) {
                    setRole(profile.role as EsskaRole);
                }
                if (profile) {
                    setOnboardingAbgeschlossen(!!profile.onboarding_abgeschlossen);
                }
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    return (
        <GlobalContext.Provider value={{ loading, user, role, onboardingAbgeschlossen }}>
            {children}
        </GlobalContext.Provider>
    );
}

export const useGlobal = () => {
    const context = useContext(GlobalContext);
    if (context === undefined) {
        throw new Error('useGlobal must be used within a GlobalProvider');
    }
    return context;
};
