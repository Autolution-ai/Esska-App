import Link from "next/link";
import { Smartphone } from "lucide-react";

// T-3: Schritt-fuer-Schritt-Anleitung, wie die App als Icon auf den
// Home-Bildschirm kommt. Oeffentlich erreichbar, damit der Link einfach
// per Nachricht geteilt werden kann - auch an Leute ohne Login.
export const metadata = {
    title: "Esska-App installieren",
};

export default function AnleitungPage() {
    return (
        <div className="min-h-screen bg-secondary-50 py-10 px-4">
            <div className="max-w-xl mx-auto space-y-6">
                <div className="text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center">
                        <Smartphone className="h-6 w-6 text-secondary-100" />
                    </div>
                    <h1 className="mt-4 text-2xl font-bold">Esska-App aufs Handy holen</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        In einer Minute liegt die App als Icon auf deinem Startbildschirm –
                        ohne App Store, ohne Download.
                        <br />
                        <span className="italic">
                            In one minute the app is on your home screen – no app store, no download.
                        </span>
                    </p>
                </div>

                <div className="bg-white border rounded-lg p-5 space-y-3">
                    <h2 className="text-lg font-semibold"> iPhone (Safari)</h2>
                    <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-2">
                        <li>
                            Öffne <strong>esska-app.vercel.app</strong> im <strong>Safari</strong>-Browser
                            (wichtig: nicht in Chrome oder Instagram/WhatsApp-Browser).
                        </li>
                        <li>
                            Tippe unten in der Mitte auf das <strong>Teilen-Symbol</strong> (Quadrat mit
                            Pfeil nach oben).
                        </li>
                        <li>
                            Scrolle nach unten und tippe auf <strong>&bdquo;Zum Home-Bildschirm&ldquo;</strong>.
                        </li>
                        <li>Tippe oben rechts auf <strong>&bdquo;Hinzufügen&ldquo;</strong> – fertig.</li>
                    </ol>
                    <p className="text-xs text-gray-500 italic">
                        English: Open the site in Safari → tap the share icon (square with arrow) →
                        “Add to Home Screen” → “Add”.
                    </p>
                </div>

                <div className="bg-white border rounded-lg p-5 space-y-3">
                    <h2 className="text-lg font-semibold">🤖 Android (Chrome)</h2>
                    <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-2">
                        <li>
                            Öffne <strong>esska-app.vercel.app</strong> im <strong>Chrome</strong>-Browser.
                        </li>
                        <li>
                            Tippe oben rechts auf das <strong>Drei-Punkte-Menü</strong> (⋮).
                        </li>
                        <li>
                            Tippe auf <strong>&bdquo;App installieren&ldquo;</strong> bzw.{" "}
                            <strong>&bdquo;Zum Startbildschirm hinzufügen&ldquo;</strong>.
                        </li>
                        <li>Bestätige mit <strong>&bdquo;Installieren&ldquo;</strong> – fertig.</li>
                    </ol>
                    <p className="text-xs text-gray-500 italic">
                        English: Open the site in Chrome → tap the three-dot menu → “Install app” /
                        “Add to home screen” → “Install”.
                    </p>
                </div>

                <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4 text-sm text-gray-700">
                    <p className="font-medium text-gray-900 mb-1">Danach</p>
                    <p>
                        Auf deinem Startbildschirm liegt jetzt das Esska-Icon. Einmal antippen,
                        anmelden – die Anmeldung bleibt gespeichert. Bei Problemen melde dich bei
                        deiner Ansprechperson.
                    </p>
                </div>

                <div className="text-center">
                    <Link
                        href="/auth/login"
                        className="inline-flex justify-center rounded-md bg-primary-600 py-2 px-6 text-sm font-medium text-white hover:bg-primary-700"
                    >
                        Zur Anmeldung
                    </Link>
                </div>
            </div>
        </div>
    );
}
