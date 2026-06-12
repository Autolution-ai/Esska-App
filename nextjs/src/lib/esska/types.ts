// Esska-spezifische Domain-Typen.
// Halten Datenmodell (Postgres) und TypeScript synchron.

export type EsskaRole = "admin" | "mitarbeiter";

export type EsskaFamilienstand = "ledig" | "verheiratet" | "geschieden";

export type EsskaArbeitszeitModell =
    | "vollzeit"
    | "teilzeit"
    | "minijob"
    | "kurzfristig";

export type EsskaKvStatus = "gesetzlich" | "privat";

export type EsskaSteuerklasse = "I" | "II" | "III" | "IV" | "V" | "VI";

export type EsskaKonfession = "evangelisch" | "katholisch" | "keine";

export type EsskaCenterStatus = "geplant" | "aktiv" | "abgeschlossen";

export type EsskaCenterKategorie = "A" | "B" | "C";

export interface EsskaProfile {
    id: string;
    role: EsskaRole;
    vorname: string | null;
    nachname: string | null;
    geburtsdatum: string | null;
    geburtsort: string | null;
    staatsangehoerigkeit: string | null;
    familienstand: EsskaFamilienstand | null;
    anschrift_strasse: string | null;
    anschrift_plz: string | null;
    anschrift_ort: string | null;
    telefon_mobil: string | null;
    email: string | null;
    eintrittsdatum: string | null;
    arbeitszeit_modell: EsskaArbeitszeitModell | null;
    stunden_pro_woche: number | null;
    verdienst_monat_eur_cent: number | null;
    weitere_beschaeftigungen: string | null;
    rentenversicherungsnummer: string | null;
    krankenversicherung_name: string | null;
    krankenversicherung_status: EsskaKvStatus | null;
    rentenversicherung_befreit: boolean;
    steuer_id: string | null;
    steuerklasse: EsskaSteuerklasse | null;
    kinderfreibetrag: number | null;
    konfession: EsskaKonfession | null;
    notfall_name: string | null;
    notfall_beziehung: string | null;
    notfall_telefon: string | null;
    stammdaten_bestaetigt_am: string | null;
    stammdaten_bestaetigt_ip: string | null;
    onboarding_abgeschlossen: boolean;
    aktiv: boolean;
    created_at: string;
    updated_at: string;
}

export interface EsskaCenter {
    id: string;
    saison: string;
    name: string;
    stadt: string;
    kuerzel: string;
    kategorie: EsskaCenterKategorie;
    start_datum: string;
    end_datum: string;
    flaeche_position: string | null;
    laenge_m: number | null;
    breite_m: number | null;
    flaeche_qm: number | null;
    mietdauer_tage: number | null;
    miete_eur_cent: number;
    status: EsskaCenterStatus;
    notiz: string | null;
    created_at: string;
    updated_at: string;
}

export interface EsskaCenterAssignment {
    id: string;
    center_id: string;
    profile_id: string;
    rolle_im_center: string | null;
    created_at: string;
}

// Hilfsfunktionen fuer Geld in Cent <-> Euro
export function centToEuro(cent: number | null | undefined): string {
    if (cent === null || cent === undefined) return "";
    const euro = cent / 100;
    return euro.toLocaleString("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function euroToCent(euro: string): number {
    if (!euro) return 0;
    const normalized = euro.replace(/\./g, "").replace(",", ".");
    const value = parseFloat(normalized);
    if (Number.isNaN(value)) return 0;
    return Math.round(value * 100);
}

// Formatierungs-Helfer
export function formatMoney(cent: number | null | undefined): string {
    if (cent === null || cent === undefined) return "—";
    return `${centToEuro(cent)} €`;
}

export function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    const date = new Date(iso);
    return date.toLocaleDateString("de-DE");
}
