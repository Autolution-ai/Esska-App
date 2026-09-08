import Link from "next/link";
import { BookOpen, FileText, Shield, Users } from "lucide-react";

export const metadata = { title: "Rechtliches" };

const dokumente = [
    { href: "/legal/impressum", icon: FileText, titel: "Impressum", text: "Anbieterkennzeichnung nach § 5 DDG" },
    { href: "/legal/datenschutz", icon: Shield, titel: "Datenschutzerklärung", text: "Wie diese Anwendung mit Daten umgeht" },
    { href: "/legal/datenschutz-beschaeftigte", icon: Users, titel: "Datenschutz für Beschäftigte", text: "Welche Daten wir von dir verarbeiten und warum" },
    { href: "/legal/nutzungsregeln", icon: BookOpen, titel: "Nutzungsregeln", text: "Regeln für die Nutzung der App" },
];

export default function LegalIndexPage() {
    return (
        <div className="min-h-screen bg-secondary-50 py-10 px-4">
            <div className="max-w-xl mx-auto space-y-4">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold">Rechtliches</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Impressum, Datenschutz und Nutzungsregeln der Esska-App.
                    </p>
                </div>
                {dokumente.map((d) => (
                    <Link
                        key={d.href}
                        href={d.href}
                        className="flex items-center gap-4 p-4 bg-white border rounded-lg hover:bg-gray-50"
                    >
                        <div className="p-3 bg-primary-50 rounded-full">
                            <d.icon className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                            <h2 className="font-medium">{d.titel}</h2>
                            <p className="text-sm text-gray-500">{d.text}</p>
                        </div>
                    </Link>
                ))}
                <div className="text-center pt-4">
                    <Link href="/" className="text-sm text-primary-600 hover:underline">
                        ← Zur Startseite
                    </Link>
                </div>
            </div>
        </div>
    );
}
