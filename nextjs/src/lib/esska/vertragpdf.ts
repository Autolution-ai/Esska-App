// Fuellt eine Vertragsvorlage (PDF) mit den Angaben eines Mitarbeiters und
// setzt - falls vorhanden - die Unterschrift(en) als Bild ein.
// Laeuft serverseitig (API-Routen); pdf-lib funktioniert aber auch im Browser.

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { Rechteck, VertragsFeld, VertragsLayout } from "@/lib/esska/vertragslayouts";

export type VertragsWerte = Partial<Record<VertragsFeld, string>>;

const SCHRIFT = 10;
const MIN_SCHRIFT = 6.5;

/** Groesste Schriftgroesse <= SCHRIFT, bei der der Text in maxBreite passt. */
function passendeGroesse(font: PDFFont, text: string, maxBreite: number, start = SCHRIFT): number {
    let g = start;
    while (g > MIN_SCHRIFT && font.widthOfTextAtSize(text, g) > maxBreite) g -= 0.25;
    return g;
}

/** PNG (data-URL oder Bytes) in ein Rechteck einpassen, Seitenverhaeltnis
 *  bleibt erhalten, unten links ausgerichtet (sitzt auf der Linie). */
async function bildEinpassen(pdf: PDFDocument, png: Uint8Array, r: Rechteck) {
    const bild = await pdf.embedPng(png);
    const faktor = Math.min(r.breite / bild.width, r.hoehe / bild.height);
    const breite = bild.width * faktor;
    const hoehe = bild.height * faktor;
    pdf.getPages()[r.seite].drawImage(bild, { x: r.x, y: r.y, width: breite, height: hoehe });
}

export async function fuelleVertrag(o: {
    vorlage: Uint8Array;
    layout: VertragsLayout;
    werte: VertragsWerte;
    unterschrift?: Uint8Array | null;
    vertreter?: Uint8Array | null;
    /** Kleiner Vermerk unten auf der letzten Seite (Nachweis der Unterschrift) */
    vermerk?: string;
}): Promise<Uint8Array> {
    const pdf = await PDFDocument.load(o.vorlage);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const seiten = pdf.getPages();

    for (const a of o.layout.abdecken ?? []) {
        seiten[a.seite].drawRectangle({ x: a.x, y: a.y, width: a.breite, height: a.hoehe, color: rgb(1, 1, 1) });
    }

    for (const f of o.layout.felder) {
        const text = (o.werte[f.feld] ?? "").trim();
        if (!text) continue;
        const groesse = passendeGroesse(font, text, f.maxBreite, f.groesse ?? SCHRIFT);
        seiten[f.seite].drawText(text, { x: f.x, y: f.y, size: groesse, font, color: rgb(0.05, 0.1, 0.35) });
    }

    if (o.unterschrift) await bildEinpassen(pdf, o.unterschrift, o.layout.unterschrift);
    if (o.vertreter && o.layout.vertreter) await bildEinpassen(pdf, o.vertreter, o.layout.vertreter);

    if (o.vermerk) {
        const letzte = seiten[seiten.length - 1];
        letzte.drawText(o.vermerk, { x: 58, y: 40, size: 7, font, color: rgb(0.4, 0.4, 0.4), maxWidth: 500 });
    }

    pdf.setTitle(o.layout.titel);
    pdf.setProducer("Esska-App");
    return pdf.save();
}

/** data:image/png;base64,... -> Bytes. Prueft Typ und Groesse. */
export function pngAusDataUrl(dataUrl: string, maxBytes = 400_000): Uint8Array {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!m) throw new Error("Die Unterschrift ist kein gültiges Bild.");
    const bytes = Uint8Array.from(Buffer.from(m[1], "base64"));
    if (bytes.length > maxBytes) throw new Error("Die Unterschrift ist zu groß.");
    // PNG-Signatur pruefen
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (!sig.every((b, i) => bytes[i] === b)) throw new Error("Die Unterschrift ist kein gültiges Bild.");
    return bytes;
}

// Datumsformat im Vertrag: 31.01.2027
export function datumDe(iso: string | null | undefined): string {
    if (!iso) return "";
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}.${m}.${y}`;
}

// Betrag im Vertrag: 14 bzw. 14,50 (ohne "€" - das steht in der Vorlage)
export function betragDe(cent: number | null | undefined): string {
    if (cent === null || cent === undefined) return "";
    return cent % 100 === 0
        ? String(cent / 100)
        : (cent / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Stunden: 15 bzw. 12,5
export function stundenDe(h: number | null | undefined): string {
    if (h === null || h === undefined) return "";
    return Number.isInteger(h) ? String(h) : String(h).replace(".", ",");
}
