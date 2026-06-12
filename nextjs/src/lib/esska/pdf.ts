// PDF-Generierung fuer Esska-Formulare (sauberes Neulayout, Entscheidung D
// aus docs/etappe-1-feinplanung.md). Laeuft komplett im Browser, keine
// Daten verlassen den Client.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { EsskaKubeDeclaration, EsskaProfile } from "@/lib/esska/types";
import {
    KUBE_LEBENSUNTERHALT_LABELS,
    KUBE_STATUS_LABELS,
    centToEuro,
} from "@/lib/esska/types";

const MARGE = 50;
const SEITE_BREITE = 595.28; // A4
const SEITE_HOEHE = 841.89;

const FARBE_TEXT = rgb(0.1, 0.1, 0.1);
const FARBE_LABEL = rgb(0.45, 0.45, 0.45);
const FARBE_LINIE = rgb(0.85, 0.85, 0.85);
const FARBE_AKZENT = rgb(0.62, 0.16, 0.17); // Weinrot der Esska-CI

class PdfBuilder {
    doc!: PDFDocument;
    page!: PDFPage;
    font!: PDFFont;
    fontBold!: PDFFont;
    y = 0;

    static async create(): Promise<PdfBuilder> {
        const b = new PdfBuilder();
        b.doc = await PDFDocument.create();
        b.font = await b.doc.embedFont(StandardFonts.Helvetica);
        b.fontBold = await b.doc.embedFont(StandardFonts.HelveticaBold);
        b.neueSeite();
        return b;
    }

    neueSeite() {
        this.page = this.doc.addPage([SEITE_BREITE, SEITE_HOEHE]);
        this.y = SEITE_HOEHE - MARGE;
    }

    platzPruefen(benoetigt: number) {
        if (this.y - benoetigt < MARGE) this.neueSeite();
    }

    titel(text: string) {
        this.platzPruefen(40);
        this.page.drawText(text, {
            x: MARGE, y: this.y - 20, size: 18, font: this.fontBold, color: FARBE_AKZENT,
        });
        this.y -= 34;
    }

    untertitel(text: string) {
        this.platzPruefen(20);
        this.page.drawText(text, {
            x: MARGE, y: this.y - 12, size: 10, font: this.font, color: FARBE_LABEL,
        });
        this.y -= 22;
    }

    abschnitt(text: string) {
        this.platzPruefen(36);
        this.y -= 10;
        this.page.drawText(text, {
            x: MARGE, y: this.y - 12, size: 12, font: this.fontBold, color: FARBE_TEXT,
        });
        this.y -= 18;
        this.page.drawLine({
            start: { x: MARGE, y: this.y },
            end: { x: SEITE_BREITE - MARGE, y: this.y },
            thickness: 0.8,
            color: FARBE_AKZENT,
        });
        this.y -= 8;
    }

    zeile(label: string, wert: string | null | undefined) {
        this.platzPruefen(18);
        this.page.drawText(label, {
            x: MARGE, y: this.y - 10, size: 9, font: this.font, color: FARBE_LABEL,
        });
        this.page.drawText(wert && wert.length > 0 ? wert : "—", {
            x: MARGE + 200, y: this.y - 10, size: 10, font: this.font, color: FARBE_TEXT,
            maxWidth: SEITE_BREITE - MARGE * 2 - 200,
        });
        this.y -= 16;
        this.page.drawLine({
            start: { x: MARGE, y: this.y },
            end: { x: SEITE_BREITE - MARGE, y: this.y },
            thickness: 0.4,
            color: FARBE_LINIE,
        });
        this.y -= 4;
    }

    absatz(text: string, size = 9) {
        const maxBreite = SEITE_BREITE - MARGE * 2;
        const woerter = text.split(" ");
        let zeile = "";
        const zeilen: string[] = [];
        for (const w of woerter) {
            const test = zeile ? `${zeile} ${w}` : w;
            if (this.font.widthOfTextAtSize(test, size) > maxBreite) {
                zeilen.push(zeile);
                zeile = w;
            } else {
                zeile = test;
            }
        }
        if (zeile) zeilen.push(zeile);
        this.platzPruefen(zeilen.length * (size + 4) + 6);
        for (const z of zeilen) {
            this.page.drawText(z, { x: MARGE, y: this.y - size, size, font: this.font, color: FARBE_TEXT });
            this.y -= size + 4;
        }
        this.y -= 4;
    }

    haken(text: string, checked: boolean) {
        this.platzPruefen(16);
        this.page.drawText(checked ? "[X]" : "[ ]", {
            x: MARGE, y: this.y - 10, size: 10, font: this.fontBold,
            color: checked ? FARBE_AKZENT : FARBE_LABEL,
        });
        this.page.drawText(text, {
            x: MARGE + 28, y: this.y - 10, size: 9, font: this.font, color: FARBE_TEXT,
            maxWidth: SEITE_BREITE - MARGE * 2 - 28,
        });
        this.y -= 16;
    }

    fusszeile(text: string) {
        const seiten = this.doc.getPages();
        seiten.forEach((p, i) => {
            p.drawText(`${text} · Seite ${i + 1} von ${seiten.length}`, {
                x: MARGE, y: 28, size: 8, font: this.font, color: FARBE_LABEL,
            });
        });
    }

    async fertig(): Promise<Uint8Array> {
        return this.doc.save();
    }
}

function datum(d: string | null | undefined): string {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("de-DE");
}

function datumZeit(d: string | null | undefined): string {
    if (!d) return "—";
    return new Date(d).toLocaleString("de-DE");
}

export async function generiereStammdatenPdf(p: EsskaProfile): Promise<Uint8Array> {
    const b = await PdfBuilder.create();

    b.titel("Personalfragebogen");
    b.untertitel(`Esska Collection · Dornblüthstraße 22, 01277 Dresden · erstellt am ${new Date().toLocaleDateString("de-DE")}`);

    b.abschnitt("Persönliche Daten");
    b.zeile("Vorname, Nachname", `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim());
    b.zeile("Geburtsdatum", datum(p.geburtsdatum));
    b.zeile("Geburtsort", p.geburtsort);
    b.zeile("Staatsangehörigkeit", p.staatsangehoerigkeit);
    b.zeile("Familienstand", p.familienstand);

    b.abschnitt("Kontaktdaten");
    b.zeile("Anschrift", p.anschrift_strasse ? `${p.anschrift_strasse}, ${p.anschrift_plz ?? ""} ${p.anschrift_ort ?? ""}` : null);
    b.zeile("Telefon (mobil)", p.telefon_mobil);
    b.zeile("E-Mail", p.email);

    b.abschnitt("Beschäftigungsdaten");
    b.zeile("Eintrittsdatum", datum(p.eintrittsdatum));
    b.zeile("Arbeitszeit-Modell", p.arbeitszeit_modell);
    b.zeile("Stunden / Woche", p.stunden_pro_woche?.toString() ?? null);
    b.zeile("Verdienst pro Monat", p.verdienst_monat_eur_cent ? `${centToEuro(p.verdienst_monat_eur_cent)} EUR` : null);
    b.zeile("Weitere Beschäftigungen", p.weitere_beschaeftigungen);

    b.abschnitt("Sozialversicherungsdaten");
    b.zeile("Rentenversicherungsnummer", p.rentenversicherungsnummer);
    b.zeile("Krankenversicherung", p.krankenversicherung_name);
    b.zeile("Mitgliedsstatus", p.krankenversicherung_status);
    b.zeile("RV-Befreiung beantragt", p.rentenversicherung_befreit ? "ja" : "nein");

    b.abschnitt("Steuerdaten");
    b.zeile("Steuer-ID", p.steuer_id);
    b.zeile("Steuerklasse", p.steuerklasse);
    b.zeile("Kinderfreibetrag", p.kinderfreibetrag?.toString() ?? null);
    b.zeile("Konfession", p.konfession);

    b.abschnitt("Notfallkontakt");
    b.zeile("Name", p.notfall_name);
    b.zeile("Beziehung", p.notfall_beziehung);
    b.zeile("Telefonnummer", p.notfall_telefon);

    b.abschnitt("Bestätigung");
    b.absatz(
        "Ich versichere, dass die vorstehenden Angaben der Wahrheit entsprechen. Ich verpflichte mich, " +
        "meinem Arbeitgeber alle Änderungen, insbesondere in Bezug auf weitere Beschäftigungen (Art, Dauer, " +
        "Entgelt) oder Adressänderungen, unverzüglich mitzuteilen."
    );
    b.zeile("Digital bestätigt am", datumZeit(p.stammdaten_bestaetigt_am));

    b.fusszeile(`Personalfragebogen · ${p.vorname ?? ""} ${p.nachname ?? ""}`.trim());
    return b.fertig();
}

export async function generiereKubePdf(k: EsskaKubeDeclaration, p: EsskaProfile): Promise<Uint8Array> {
    const b = await PdfBuilder.create();

    b.titel("Statuserklärung zur kurzfristigen Beschäftigung");
    b.untertitel("gemäß § 8 Abs. 1 Nr. 2 SGB IV · Arbeitgeber: Esska Collection, Dornblüthstraße 22, 01277 Dresden");

    b.abschnitt("Angaben zur beschäftigten Person");
    b.zeile("Name, Vorname", `${p.nachname ?? ""}, ${p.vorname ?? ""}`.replace(/^, |, $/g, ""));
    b.zeile("Geburtsdatum", datum(p.geburtsdatum));
    b.zeile("Anschrift", p.anschrift_strasse ? `${p.anschrift_strasse}, ${p.anschrift_plz ?? ""} ${p.anschrift_ort ?? ""}` : null);
    b.zeile("Saison", k.saison);

    b.abschnitt("Geplante kurzfristige Beschäftigung");
    b.haken("maximal 3 Monate", k.begrenzung === "3_monate");
    b.haken("maximal 70 Arbeitstage", k.begrenzung === "70_arbeitstage");

    b.abschnitt("Aktueller Erwerbs- bzw. Lebensstatus");
    b.zeile("Status", KUBE_STATUS_LABELS[k.erwerbsstatus] + (k.erwerbsstatus_sonstiges ? `: ${k.erwerbsstatus_sonstiges}` : ""));
    if (k.bafoeg_bezug !== null) b.zeile("BAföG-Bezug", k.bafoeg_bezug ? "ja" : "nein");
    if (k.aktueller_arbeitgeber) b.zeile("Aktueller Arbeitgeber", k.aktueller_arbeitgeber);
    if (k.aktueller_verdienst_eur_cent) b.zeile("Monatlicher Verdienst", `${centToEuro(k.aktueller_verdienst_eur_cent)} EUR`);
    if (k.arbeitslosen_leistung) {
        const labels = { sgb_iii: "Leistungen nach SGB III (ALG I)", sgb_ii: "Leistungen nach SGB II (Bürgergeld)", keine: "keine Leistungen" };
        b.zeile("Leistungsbezug", labels[k.arbeitslosen_leistung]);
    }

    b.abschnitt("Bestreitung des überwiegenden Lebensunterhalts");
    b.zeile("Lebensunterhalt durch", KUBE_LEBENSUNTERHALT_LABELS[k.lebensunterhalt] + (k.lebensunterhalt_sonstiges ? `: ${k.lebensunterhalt_sonstiges}` : ""));

    b.abschnitt("Beschäftigungen über der Geringfügigkeitsgrenze im Kalenderjahr");
    const monatsnamen = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
    b.zeile(
        "Monate",
        k.monate_ueber_geringfuegigkeit.length === 0
            ? "In keinem Monat"
            : k.monate_ueber_geringfuegigkeit.map((m) => monatsnamen[m - 1]).join(", ")
    );

    b.abschnitt("Weitere kurzfristige Beschäftigungen im laufenden Kalenderjahr");
    if (k.weitere_kurzfristige_beschaeftigungen.length === 0) {
        b.zeile("Vorbeschäftigungen", "Keine");
    } else {
        for (const v of k.weitere_kurzfristige_beschaeftigungen) {
            b.zeile(v.arbeitgeber, `${v.zeitraum} · ${v.arbeitstage} Arbeitstage · ${centToEuro(v.verdienst_eur_cent)} EUR`);
        }
    }

    b.abschnitt("Erklärungen");
    b.haken("Erklärung zur Zeitgrenze (3 Monate / 70 Arbeitstage pro Kalenderjahr) zur Kenntnis genommen", k.erklaerung_zeitgrenze);
    b.haken("Erklärung zur Nicht-Berufsmäßigkeit abgegeben", k.erklaerung_nichtberufsmaessig);
    b.haken("Verpflichtung zur Mitteilung weiterer Beschäftigungen und Statusänderungen", k.verpflichtung_mitteilung);
    b.haken("Einverständnis zur Vorlage von Statusnachweisen auf Anforderung", k.nachweis_zustimmung);

    b.abschnitt("Unterzeichnung");
    b.zeile("Ort", k.unterzeichnet_ort);
    b.zeile("Digital unterzeichnet am", datumZeit(k.unterzeichnet_am));
    if (k.unterschrift_minderjaehriger_vorhanden) {
        b.zeile("Unterschrift gesetzl. Vertreter", "liegt vor (Minderjährige/r)");
    }

    b.fusszeile(`KuBe-Statuserklärung ${k.saison} · ${p.vorname ?? ""} ${p.nachname ?? ""}`.trim());
    return b.fertig();
}

export function pdfHerunterladen(bytes: Uint8Array, dateiname: string) {
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = dateiname;
    a.click();
    URL.revokeObjectURL(url);
}
