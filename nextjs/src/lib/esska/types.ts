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

// ---------------------------------------------------------------------------
// KuBe-Statuserklaerung (kurzfristige Beschaeftigung)
// ---------------------------------------------------------------------------

export type EsskaKubeBegrenzung = "3_monate" | "70_arbeitstage";

export type EsskaKubeStatus =
    | "schueler"
    | "student"
    | "azubi"
    | "arbeitnehmer_teilzeit"
    | "arbeitnehmer_vollzeit"
    | "selbststaendig"
    | "rentner"
    | "hausfrau_hausmann"
    | "arbeitssuchend"
    | "freiwilligendienst"
    | "schulentlassen_ausbildung"
    | "schulentlassen_studium"
    | "schulentlassen_freiwilligendienst"
    | "sonstiges";

export type EsskaKubeLebensunterhalt =
    | "hauptbeschaeftigung"
    | "studium_schule"
    | "ausbildung"
    | "rente"
    | "selbststaendigkeit"
    | "unterhalt_familie"
    | "sonstiges";

export type EsskaKubeAlgLeistung = "sgb_iii" | "sgb_ii" | "keine";

export interface EsskaKubeVorbeschaeftigung {
    arbeitgeber: string;
    zeitraum: string;
    arbeitstage: number;
    verdienst_eur_cent: number;
}

export interface EsskaKubeDeclaration {
    id: string;
    profile_id: string;
    saison: string;
    begrenzung: EsskaKubeBegrenzung;
    erwerbsstatus: EsskaKubeStatus;
    erwerbsstatus_sonstiges: string | null;
    bafoeg_bezug: boolean | null;
    aktueller_arbeitgeber: string | null;
    aktueller_verdienst_eur_cent: number | null;
    arbeitslosen_leistung: EsskaKubeAlgLeistung | null;
    lebensunterhalt: EsskaKubeLebensunterhalt;
    lebensunterhalt_sonstiges: string | null;
    monate_ueber_geringfuegigkeit: number[];
    weitere_kurzfristige_beschaeftigungen: EsskaKubeVorbeschaeftigung[];
    erklaerung_zeitgrenze: boolean;
    erklaerung_nichtberufsmaessig: boolean;
    verpflichtung_mitteilung: boolean;
    nachweis_zustimmung: boolean;
    unterzeichnet_am: string | null;
    unterzeichnet_ip: string | null;
    unterzeichnet_ort: string | null;
    unterschrift_minderjaehriger_vorhanden: boolean;
    pdf_path: string | null;
    created_at: string;
    updated_at: string;
}

export const KUBE_STATUS_LABELS: Record<EsskaKubeStatus, string> = {
    schueler: "Schüler/in",
    student: "Student/in",
    azubi: "Auszubildende/r",
    arbeitnehmer_teilzeit: "Arbeitnehmer/in (Teilzeit)",
    arbeitnehmer_vollzeit: "Arbeitnehmer/in (Vollzeit)",
    selbststaendig: "Selbstständige/r",
    rentner: "Rentner/in",
    hausfrau_hausmann: "Hausfrau/Hausmann",
    arbeitssuchend: "Arbeitssuchende/r (gemeldet bei Agentur für Arbeit)",
    freiwilligendienst: "Freiwilligendienstleistende/r",
    schulentlassen_ausbildung: "Schulentlassene/r mit Berufsausbildungsabsicht",
    schulentlassen_studium: "Schulentlassene/r mit Studienabsicht",
    schulentlassen_freiwilligendienst: "Schulentlassene/r mit Freiwilligendienstabsicht",
    sonstiges: "Sonstiges",
};

export const KUBE_LEBENSUNTERHALT_LABELS: Record<EsskaKubeLebensunterhalt, string> = {
    hauptbeschaeftigung: "Hauptbeschäftigung",
    studium_schule: "Studium/Schule",
    ausbildung: "Ausbildung",
    rente: "Rente",
    selbststaendigkeit: "Selbstständigkeit",
    unterhalt_familie: "Unterhalt durch Familie",
    sonstiges: "Sonstiges",
};

export type EsskaDokumentTyp =
    | "ausweis_vorderseite"
    | "ausweis_rueckseite"
    | "aufenthaltsgenehmigung"
    | "immatrikulation"
    | "schulbescheinigung"
    | "rentenbescheid"
    | "gewerbeanmeldung"
    | "sonstiges";

export const DOKUMENT_TYP_LABELS: Record<EsskaDokumentTyp, string> = {
    ausweis_vorderseite: "Ausweis – Vorderseite",
    ausweis_rueckseite: "Ausweis – Rückseite",
    aufenthaltsgenehmigung: "Aufenthaltsgenehmigung",
    immatrikulation: "Immatrikulationsbescheinigung",
    schulbescheinigung: "Schulbescheinigung",
    rentenbescheid: "Rentenbescheid",
    gewerbeanmeldung: "Gewerbeanmeldung",
    sonstiges: "Sonstiges Dokument",
};

export interface EsskaEmployeeDocument {
    id: string;
    profile_id: string;
    dokument_typ: EsskaDokumentTyp;
    storage_path: string;
    hochgeladen_von: string;
    hochgeladen_am: string;
    gueltig_bis: string | null;
    notiz: string | null;
}

// ---------------------------------------------------------------------------
// Verfuegbarkeit & Schichtplan
// ---------------------------------------------------------------------------

export type EsskaAvailability =
    | "verfuegbar"
    | "nicht_verfuegbar"
    | "nur_vormittag"
    | "nur_nachmittag";

export const AVAILABILITY_LABELS: Record<EsskaAvailability, string> = {
    verfuegbar: "Verfügbar",
    nicht_verfuegbar: "Nicht verfügbar",
    nur_vormittag: "Nur Vormittag",
    nur_nachmittag: "Nur Nachmittag",
};

export interface EsskaAvailabilityRow {
    id: string;
    profile_id: string;
    datum: string;
    status: EsskaAvailability;
    notiz: string | null;
    created_at: string;
    updated_at: string;
}

export interface EsskaShiftWeek {
    id: string;
    center_id: string;
    woche_start: string;
    veroeffentlicht: boolean;
    veroeffentlicht_am: string | null;
    veroeffentlicht_von: string | null;
    notiz: string | null;
    created_at: string;
    updated_at: string;
}

export interface EsskaShift {
    id: string;
    shift_week_id: string;
    center_id: string;
    profile_id: string;
    datum: string;
    start_zeit: string;
    end_zeit: string;
    pause_min: number;
    rolle: string | null;
    notiz: string | null;
    created_at: string;
    updated_at: string;
}

export function isoDatum(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export function montagDerWoche(d: Date): Date {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
}

export function addTage(d: Date, tage: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + tage);
    return x;
}

export function tagKurz(d: Date): string {
    return d.toLocaleDateString("de-DE", { weekday: "short" });
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
