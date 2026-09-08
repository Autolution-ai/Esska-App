'use client';

import React from 'react';
import LegalDocument from '@/components/LegalDocument';
import { notFound } from 'next/navigation';

// Die Rechtstexte der Esska-App. Die alten englischen Pfade des Templates
// zeigen weiter auf die passenden deutschen Texte, damit bestehende Links
// (z. B. in verschickten E-Mails) nicht ins Leere laufen.
const legalDocuments = {
    'impressum': {
        title: 'Impressum',
        path: '/terms/impressum.md'
    },
    'datenschutz': {
        title: 'Datenschutzerklärung',
        path: '/terms/datenschutz.md'
    },
    'datenschutz-beschaeftigte': {
        title: 'Datenschutzhinweise für Beschäftigte',
        path: '/terms/datenschutz-beschaeftigte.md'
    },
    'nutzungsregeln': {
        title: 'Nutzungsregeln',
        path: '/terms/nutzungsregeln.md'
    },
    'privacy': {
        title: 'Datenschutzerklärung',
        path: '/terms/datenschutz.md'
    },
    'terms': {
        title: 'Nutzungsregeln',
        path: '/terms/nutzungsregeln.md'
    }
} as const;

type LegalDocument = keyof typeof legalDocuments;

interface LegalPageProps {
    document: LegalDocument;
    lng: string;
}

interface LegalPageParams {
    params: Promise<LegalPageProps>
}

export default function LegalPage({ params }: LegalPageParams) {
    const {document} = React.use<LegalPageProps>(params);

    if (!legalDocuments[document]) {
        notFound();
    }

    const { title, path } = legalDocuments[document];

    return (
        <div className="container mx-auto px-4 py-8">
            <LegalDocument
                title={title}
                filePath={path}
            />
        </div>
    );
}