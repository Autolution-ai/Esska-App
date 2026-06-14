// Uebersetzt technische Fehler (Supabase/Postgres/Netzwerk) in
// verstaendliche deutsche Meldungen. Tabellen- und Feld-spezifische
// Hinweise machen es dem Anwender leicht, das Problem selbst zu beheben.

type PostgresError = {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
};

type CallContext = {
    /** Welche Aktion gerade lief, z. B. "Center anlegen". */
    aktion?: string;
    /** Welche Entitaet betroffen ist, z. B. "Center", "Mitarbeiter". */
    entitaet?: string;
};

const FELDLABEL: Record<string, string> = {
    kuerzel: "Kürzel",
    saison: "Saison",
    name: "Name",
    stadt: "Stadt",
    email: "E-Mail",
    profile_id: "Mitarbeiter",
    center_id: "Center",
    datum: "Datum",
    start_zeit: "Startzeit",
    end_zeit: "Endzeit",
    pause_min: "Pause",
    betrag_cent: "Betrag",
    miete_eur_cent: "Miete",
    start_datum: "Start-Datum",
    end_datum: "End-Datum",
    rentenversicherungsnummer: "Rentenversicherungsnummer",
};

function feldLabel(name: string): string {
    return FELDLABEL[name] ?? name;
}

function extrahiereFelderAusDetails(details?: string | null): string[] {
    if (!details) return [];
    const match = details.match(/Key \(([^)]+)\)=/);
    if (!match) return [];
    return match[1].split(",").map((f) => f.trim());
}

function freundlicherUniqueText(pgError: PostgresError): string {
    const felder = extrahiereFelderAusDetails(pgError.details);
    const constraint = pgError.message ?? "";

    if (constraint.includes("centers_kuerzel_unique_per_saison")) {
        return "Für diese Saison existiert bereits ein Center mit diesem Kürzel. Bitte ein anderes Kürzel wählen.";
    }
    if (constraint.includes("center_assignments_unique")) {
        return "Dieser Mitarbeiter ist diesem Center bereits zugeordnet.";
    }
    if (constraint.includes("availabilities_one_per_day")) {
        return "Für diesen Tag gibt es bereits einen Verfügbarkeits-Eintrag.";
    }
    if (constraint.includes("daily_sales_unique")) {
        return "Für dieses Center und diesen Tag existiert bereits ein Umsatz-Eintrag. Aktualisiere den bestehenden Eintrag statt einen neuen anzulegen.";
    }
    if (constraint.includes("kube_one_per_profile_saison")) {
        return "Für diese Saison hast du bereits eine KuBe-Statuserklärung abgegeben.";
    }
    if (constraint.includes("shift_weeks_unique")) {
        return "Für dieses Center und diese Woche existiert bereits ein Wochenplan.";
    }
    if (felder.length > 0) {
        const labels = felder.map(feldLabel).join(" + ");
        return `Es existiert bereits ein Eintrag mit denselben Werten für: ${labels}.`;
    }
    return "Es existiert bereits ein Eintrag mit denselben Schlüsselwerten.";
}

function freundlicherCheckText(pgError: PostgresError): string {
    const c = pgError.message ?? "";
    if (c.includes("centers_datum_valid")) {
        return "Das End-Datum darf nicht vor dem Start-Datum liegen.";
    }
    if (c.includes("centers_miete_positive")) {
        return "Die Miete muss 0 oder größer sein.";
    }
    if (c.includes("shifts_zeitfenster")) {
        return "Die Endzeit muss nach der Startzeit liegen.";
    }
    if (c.includes("shifts_pause_valid")) {
        return "Die Pause muss zwischen 0 und 600 Minuten liegen.";
    }
    if (c.includes("daily_sales") && c.includes("betrag_cent")) {
        return "Der Betrag muss 0 oder größer sein.";
    }
    return "Die Eingabewerte verletzen eine Prüfregel. Bitte Pflichtangaben und Wertebereiche prüfen.";
}

export function friendlyError(error: unknown, ctx?: CallContext): string {
    // Standardfall: kein Error-Objekt
    if (!error) return "Unbekannter Fehler.";

    // String direkt zurueck
    if (typeof error === "string") return error;

    const pg = error as PostgresError;
    const code = pg.code;
    const aktion = ctx?.aktion ? ctx.aktion + " fehlgeschlagen. " : "";

    switch (code) {
        case "23505":
            return freundlicherUniqueText(pg);
        case "23503":
            return `${aktion}Ein verknüpfter Datensatz existiert nicht (mehr). Bitte Auswahl prüfen.`;
        case "23514":
            return aktion + freundlicherCheckText(pg);
        case "23502": {
            const felder = extrahiereFelderAusDetails(pg.details);
            if (felder.length > 0) {
                return `Bitte folgende Pflichtfelder ausfüllen: ${felder.map(feldLabel).join(", ")}.`;
            }
            return `${aktion}Ein Pflichtfeld ist leer.`;
        }
        case "22P02":
            return `${aktion}Eine Eingabe hat ein ungültiges Format (z. B. Zahl statt Text).`;
        case "42501":
        case "PGRST301":
            return `${aktion}Keine Berechtigung für diese Aktion.`;
        case "PGRST116":
            return `${aktion}Datensatz nicht gefunden.`;
        case "PGRST204":
            return `${aktion}Datensatz nicht gefunden.`;
        case "PGRST302":
            return `${aktion}Anmeldung erforderlich oder abgelaufen. Bitte neu einloggen.`;
        default:
            break;
    }

    if (pg.message) {
        if (/duplicate key|already exists/i.test(pg.message)) {
            return freundlicherUniqueText(pg);
        }
        if (/network|fetch|connection/i.test(pg.message)) {
            return "Netzwerkproblem. Bitte Internetverbindung prüfen und erneut versuchen.";
        }
        if (/jwt|token/i.test(pg.message)) {
            return "Anmeldung abgelaufen. Bitte neu einloggen.";
        }
        return aktion + pg.message;
    }

    return aktion + "Unbekannter Fehler.";
}
