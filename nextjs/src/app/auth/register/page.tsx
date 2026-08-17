import Link from "next/link";
import { Mail } from "lucide-react";

/**
 * Selbstregistrierung ist bewusst deaktiviert.
 *
 * Die Esska-App ist eine interne Anwendung mit Personal- und Kassendaten.
 * Zugaenge vergibt ausschliesslich der Admin ueber eine E-Mail-Einladung
 * (Mitarbeiter -> Mitarbeiter einladen). Ein offenes Registrierungsformular
 * wuerde es jedem im Internet erlauben, sich ein Konto anzulegen.
 */
export default function RegisterDisabledPage() {
    return (
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 space-y-5">
            <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-secondary-100 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-secondary-600" />
                </div>
                <h1 className="mt-4 text-xl font-bold">Zugang nur auf Einladung</h1>
                <p className="mt-2 text-sm text-gray-600">
                    Für die Esska-App kann man sich nicht selbst registrieren. Sobald du für
                    die Saison eingeplant bist, bekommst du eine Einladung per E-Mail und
                    legst darüber dein Passwort fest.
                </p>
            </div>

            <div className="bg-secondary-50 border border-secondary-200 rounded-md p-4 text-sm text-gray-700">
                <p className="font-medium text-gray-900 mb-1">Keine Einladung erhalten?</p>
                <p>
                    Schau zuerst im Spam-Ordner nach. Wenn dort nichts ist, melde dich bei
                    deiner Ansprechperson – sie kann die Einladung erneut verschicken.
                </p>
            </div>

            <Link
                href="/auth/login"
                className="flex w-full justify-center rounded-md bg-primary-600 py-2 px-4 text-sm font-medium text-white hover:bg-primary-700"
            >
                Zur Anmeldung
            </Link>
        </div>
    );
}
