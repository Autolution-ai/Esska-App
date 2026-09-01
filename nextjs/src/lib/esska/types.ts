// Esska-spezifische Domain-Typen.
// Halten Datenmodell (Postgres) und TypeScript synchron.

export type EsskaRole = "admin" | "regionalmanager" | "mitarbeiter";

export const ROLE_LABELS: Record<EsskaRole, string> = {
    admin: "Admin",
    regionalmanager: "Regionalmanager",
    mitarbeiter: "Mitarbeiter",
};

export type EsskaFamilienstand = "ledig" | "verheiratet" | "geschieden";

export type EsskaArbeitszeitModell =
    | "vollzeit"
    | "teilzeit"
    | "minijob"
    | "kurzfristig";

// Aktueller Lebens-/Erwerbsstatus des Mitarbeiters – wird vom Mitarbeiter
// im Onboarding angegeben (unabhaengig vom arbeitszeit_modell, das der
// Admin pflegt).
export type EsskaAktuellerStatus =
    | "schueler"
    | "student"
    | "berufstaetig"
    | "rentner"
    | "sonstiges";

export const AKTUELLER_STATUS_LABELS: Record<EsskaAktuellerStatus, string> = {
    schueler: "Schüler/in",
    student: "Student/in",
    berufstaetig: "Berufstätig (Arbeitnehmer/in oder Selbstständig)",
    rentner: "Rentner/in",
    sonstiges: "Sonstiges",
};

export type EsskaKvStatus = "gesetzlich" | "privat";

// O-1: Untergliederung, wenn aktueller_status = 'berufstaetig'
export type EsskaBerufstaetigArt = "minijob" | "teilzeit" | "vollzeit";

export const BERUFSTAETIG_ART_LABELS: Record<EsskaBerufstaetigArt, string> = {
    minijob: "Minijob",
    teilzeit: "Teilzeit",
    vollzeit: "Vollzeit",
};

export type EsskaSteuerklasse = "I" | "II" | "III" | "IV" | "V" | "VI";

export type EsskaKonfession = "evangelisch" | "katholisch" | "keine";

export type EsskaCenterStatus = "in_absprache" | "geplant" | "aktiv" | "abgeschlossen";

export const CENTER_STATUS_LABELS: Record<EsskaCenterStatus, string> = {
    in_absprache: "In Absprache",
    geplant: "Geplant",
    aktiv: "Aktiv",
    abgeschlossen: "Beendet",
};

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
    aktueller_status: EsskaAktuellerStatus | null;
    aktueller_status_sonstiges: string | null;
    stunden_pro_woche: number | null;
    max_schichten_pro_woche: number | null;
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
    // Struktur-Update 31.08.: O-9, O-1, O-16
    geburtsland: string | null;
    berufstaetig_art: EsskaBerufstaetigArt | null;
    sozialleistungen_bezug: boolean | null;
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
    // S-2: zustaendiger Regionalmanager (profiles.id) oder null
    manager_id: string | null;
    status: EsskaCenterStatus;
    notiz: string | null;
    created_at: string;
    updated_at: string;
}

// S-4: Oeffnungstage/-zeiten je Center, ein Datensatz je Wochentag.
// wochentag: 0 = Montag ... 6 = Sonntag (wie im Verfuegbarkeitsraster)
export interface EsskaCenterOpeningHour {
    id: string;
    center_id: string;
    wochentag: number;
    geoeffnet: boolean;
    oeffnet: string | null;
    schliesst: string | null;
}

export const WOCHENTAG_LABELS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"] as const;

// S-5: Zeitraeume je Center als Historie
export type EsskaZeitraumTyp = "miete" | "betrieb" | "verlaengerung";

export const ZEITRAUM_TYP_LABELS: Record<EsskaZeitraumTyp, string> = {
    miete: "Mietzeitraum (Vertrag)",
    betrieb: "Tatsächlicher Betrieb",
    verlaengerung: "Verlängerung",
};

export interface EsskaCenterZeitraum {
    id: string;
    center_id: string;
    typ: EsskaZeitraumTyp;
    von: string;
    bis: string | null;
    notiz: string | null;
    created_at: string;
}

// C-5: Center-Status automatisch aus den Zeitraeumen ableiten.
// Nur 'in_absprache' bleibt eine manuelle Entscheidung (es gibt noch keine
// Vertragsdaten). Sonst gilt: laeuft heute ein Miet- oder
// Verlaengerungszeitraum -> aktiv; liegt einer in der Zukunft -> geplant;
// sonst -> abgeschlossen ("Beendet").
export function berechneCenterStatus(
    gespeicherterStatus: EsskaCenterStatus,
    zeitraeume: EsskaCenterZeitraum[],
    heute: string = isoDatum(new Date())
): EsskaCenterStatus {
    if (gespeicherterStatus === "in_absprache") return "in_absprache";
    const relevant = zeitraeume.filter((z) => z.typ === "miete" || z.typ === "verlaengerung");
    if (relevant.length === 0) return gespeicherterStatus;
    if (relevant.some((z) => z.von <= heute && (!z.bis || z.bis >= heute))) return "aktiv";
    if (relevant.some((z) => z.von > heute)) return "geplant";
    return "abgeschlossen";
}

// S-7: Karteneinnahmen, erfasst durch den Admin (ein Betrag je Center+Tag)
export interface EsskaCardRevenue {
    id: string;
    center_id: string;
    datum: string;
    betrag_cent: number;
    notiz: string | null;
    erfasst_von: string | null;
    erfasst_am: string;
    updated_at: string;
}

// S-8: Bestellungen
export interface EsskaBestellArtikel {
    id: string;
    name: string;
    kategorie: string | null;
    farben: string[];
    aktiv: boolean;
    sortierung: number;
}

export type EsskaBestellStatus = "offen" | "weitergeleitet" | "erledigt";

export const BESTELL_STATUS_LABELS: Record<EsskaBestellStatus, string> = {
    offen: "Offen",
    weitergeleitet: "Weitergeleitet",
    erledigt: "Erledigt",
};

export interface EsskaBestellung {
    id: string;
    center_id: string;
    besteller_id: string;
    status: EsskaBestellStatus;
    notiz: string | null;
    erstellt_am: string;
    weitergeleitet_am: string | null;
}

export interface EsskaBestellungPosition {
    id: string;
    bestellung_id: string;
    artikel_id: string;
    farbe: string | null;
    menge: number;
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

export interface EsskaPensionExemption {
    id: string;
    profile_id: string;
    rentenversicherungsnummer: string;
    merkblatt_zur_kenntnis_genommen: boolean;
    unterzeichnet_am: string | null;
    unterzeichnet_ip: string | null;
    unterzeichnet_ort: string | null;
    pdf_path: string | null;
    created_at: string;
    updated_at: string;
}

export type EsskaDokumentTyp =
    | "ausweis_vorderseite"
    | "ausweis_rueckseite"
    | "aufenthaltsgenehmigung"
    | "immatrikulation"
    | "sonstiges";

export const DOKUMENT_TYP_LABELS: Record<EsskaDokumentTyp, string> = {
    ausweis_vorderseite: "Ausweis – Vorderseite",
    ausweis_rueckseite: "Ausweis – Rückseite",
    aufenthaltsgenehmigung: "Aufenthaltsgenehmigung",
    immatrikulation: "Immatrikulationsbescheinigung",
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
// Verfuegbarkeit & Schichtplan (Slot-basiert)
// ---------------------------------------------------------------------------

export type EsskaShiftSlot = "vormittag" | "nachmittag";

export const SLOT_LABELS: Record<EsskaShiftSlot, string> = {
    vormittag: "Vormittag",
    nachmittag: "Nachmittag",
};

// Esska-Standardzeiten je Slot (Mall-typisch). Werden beim Neuanlegen
// einer Schicht als Default eingetragen und sind je Schicht ueberschreibbar.
export const SLOT_DEFAULT_ZEITEN: Record<EsskaShiftSlot, { start: string; ende: string }> = {
    vormittag: { start: "09:00", ende: "15:00" },
    nachmittag: { start: "15:00", ende: "20:30" },
};

// Dreistufige Wunsch-Aussage des Mitarbeiters pro Tag/Slot
export type EsskaWunsch = "kann_nicht" | "koennte" | "wuensche";

// Semantik im UI:
//   koennte    -> "Könnte" (voll verfuegbar)
//   wuensche   -> "Abweichung" (eingeschraenkt: Vormittag bis HH:MM oder Nachmittag ab HH:MM)
//   kann_nicht -> "Kann nicht"
// Wir behalten den DB-Enum-Wert 'wuensche' und nutzen ihn als Speicher fuer 'abweichung'.
export const WUNSCH_LABELS: Record<EsskaWunsch, string> = {
    kann_nicht: "Kann nicht",
    koennte: "Könnte",
    wuensche: "Abweichung",
};

export const WUNSCH_ICON: Record<EsskaWunsch, string> = {
    kann_nicht: "✕",
    koennte: "✓",
    wuensche: "",
};

export interface EsskaAvailabilityRow {
    id: string;
    profile_id: string;
    datum: string;
    slot: EsskaShiftSlot;
    wunsch: EsskaWunsch;
    abweichung_bis: string | null;
    abweichung_ab: string | null;
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
    slot: EsskaShiftSlot;
    start_zeit: string;
    end_zeit: string;
    pause_min: number;
    rolle: string | null;
    notiz: string | null;
    created_at: string;
    updated_at: string;
}

// Berechnet Brutto-Stunden einer Schicht (vor Pause)
export function bruttoStunden(start: string, ende: string): number {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = ende.split(":").map(Number);
    return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

// Netto-Stunden (mit Pausenabzug)
export function nettoStunden(start: string, ende: string, pauseMin: number): number {
    return Math.max(0, bruttoStunden(start, ende) - pauseMin / 60);
}

// HH:MM aus PG-time-Strings (kann auch "HH:MM:SS" sein)
export function zeitKurz(t: string): string {
    return t.slice(0, 5);
}

export function isoDatum(d: Date): string {
    // WICHTIG: lokale Datumsteile verwenden, NICHT toISOString().
    // toISOString() rechnet nach UTC um – fuer deutsche Nutzer (UTC+1/+2)
    // wird aus "Montag 00:00" dadurch der Sonntag davor. Das fuehrte zu
    // falschen Wochentagen ("Sonntag" unter "Mo") und um einen Tag
    // verschobenen Datumsangaben in Verfuegbarkeit und Schichtplan.
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const t = d.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${t}`;
}

// ISO-Datum ("YYYY-MM-DD") als LOKALES Datum parsen.
// new Date("2026-08-24") wuerde UTC-Mitternacht liefern und je nach
// Zeitzone auf den Vortag kippen – deshalb die Teile selbst zerlegen.
export function parseIsoDatum(s: string): Date {
    const [y, m, t] = s.split("-").map((x) => parseInt(x, 10));
    return new Date(y, (m || 1) - 1, t || 1);
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

// ---------------------------------------------------------------------------
// Tagesumsaetze
// ---------------------------------------------------------------------------

export interface EsskaDailySale {
    id: string;
    center_id: string;
    datum: string;
    betrag_cent: number | null;
    anzahl_belege: number | null;
    notiz: string | null;
    arbeitszeit_start: string | null;
    arbeitszeit_ende: string | null;
    umsatz_start: string | null;
    umsatz_ende: string | null;
    beleg_foto_path: string | null;
    // Bargeld-Kassenbestand (nur Bargeld, Kartenzahlungen laufen separat)
    startbestand_cent: number | null;
    einnahmen_cent: number | null;
    ausgaben_cent: number | null;
    endbestand_cent: number | null;
    abschoepfung_cent: number | null;
    // Kartenumsaetze laut Tagesabschluss (Z-Bericht) des Kartenterminals
    karteneinnahmen_cent: number | null;
    // Korrektur-Kette: verweist auf den Eintrag, der hiermit ersetzt wird
    korrigiert_eintrag_id: string | null;
    korrektur_grund: string | null;
    erfasst_von: string;
    erfasst_am: string;
    aktualisiert_am: string;
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
    // Reine Datumsstrings lokal parsen (sonst Zeitzonen-Verschiebung),
    // Timestamps normal ueber Date.
    const date = iso.length === 10 ? parseIsoDatum(iso) : new Date(iso);
    return date.toLocaleDateString("de-DE");
}
