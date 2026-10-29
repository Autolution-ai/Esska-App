// Kassenbericht als PDF (zusaetzlich zur CSV) fuer Steuerberater und
// Finanzamt. Nur Bargeld-Kasse, ohne Karteneinnahmen. A4 quer, im Browser.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const BREITE = 841.89; // A4 quer
const HOEHE = 595.28;
const RAND = 32;
const ZEILE = 13;
const SCHRIFT = 7.5;

const TEXT = rgb(0.1, 0.1, 0.1);
const GRAU = rgb(0.5, 0.5, 0.5);
const LINIE = rgb(0.85, 0.85, 0.85);
const AKZENT = rgb(0.62, 0.16, 0.17); // Weinrot der Esska-CI

export type KassenberichtZeile = {
    datum: string; // YYYY-MM-DD
    center: string;
    stadt: string;
    startbestand: string;
    einnahmen: string;
    ausgaben: string;
    einlagen: string;
    tresor: string;
    endbestand: string;
    gueltig: boolean;
    korrektur: boolean;
    bemerkung: string; // Korrekturgrund und Notiz
};

type Spalte = { titel: string; breite: number; rechts?: boolean; wert: (z: KassenberichtZeile) => string };

const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

const SPALTEN: Spalte[] = [
    { titel: "Datum", breite: 48, wert: (z) => datumDe(z.datum) },
    { titel: "Center", breite: 150, wert: (z) => `${z.center}, ${z.stadt}` },
    { titel: "Startbestand", breite: 52, rechts: true, wert: (z) => z.startbestand },
    { titel: "Einnahmen", breite: 50, rechts: true, wert: (z) => z.einnahmen },
    { titel: "Ausgaben", breite: 46, rechts: true, wert: (z) => z.ausgaben },
    { titel: "Einlagen", breite: 46, rechts: true, wert: (z) => z.einlagen },
    { titel: "In Tresor", breite: 46, rechts: true, wert: (z) => z.tresor },
    { titel: "Endbestand", breite: 52, rechts: true, wert: (z) => z.endbestand },
    { titel: "Gültig", breite: 40, wert: (z) => (z.gueltig ? "ja" : "ersetzt") },
    { titel: "Korr.", breite: 26, wert: (z) => (z.korrektur ? "ja" : "") },
    { titel: "Bemerkung", breite: 0, wert: (z) => z.bemerkung },
];

/** Text auf maxBreite kuerzen (mit …). */
function kuerzen(font: PDFFont, text: string, groesse: number, maxBreite: number): string {
    if (font.widthOfTextAtSize(text, groesse) <= maxBreite) return text;
    let t = text;
    while (t.length > 0 && font.widthOfTextAtSize(`${t}…`, groesse) > maxBreite) t = t.slice(0, -1);
    return `${t}…`;
}

/** Zeichen, die Helvetica (WinAnsi) nicht kennt, ersetzen statt abzustuerzen. */
function sicher(font: PDFFont, text: string): string {
    const zs = new Set(font.getCharacterSet());
    return [...text.replace(/[\r\n\t]+/g, " ")].map((c) => (zs.has(c.codePointAt(0)!) ? c : "?")).join("");
}

export async function generiereKassenberichtPdf(o: {
    zeitraum: string; // z. B. "01.09.2026 – 30.09.2026"
    zeilen: KassenberichtZeile[];
    summen: { einnahmen: string; tresor: string };
}): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fett = await doc.embedFont(StandardFonts.HelveticaBold);
    const erstellt = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

    // Restbreite fuer die Bemerkung
    const fest = SPALTEN.reduce((s, sp) => s + sp.breite, 0);
    const spalten = SPALTEN.map((sp) => (sp.breite ? sp : { ...sp, breite: BREITE - 2 * RAND - fest }));

    let seite: PDFPage = doc.addPage([BREITE, HOEHE]);
    let y = 0;

    const kopf = (erste: boolean) => {
        y = HOEHE - RAND;
        if (erste) {
            seite.drawText("ESSKA COLLECTION", { x: RAND, y: y - 12, size: 14, font: fett, color: AKZENT });
            seite.drawText(`Kassenbericht ${o.zeitraum}`, { x: RAND, y: y - 30, size: 12, font: fett, color: TEXT });
            seite.drawText(
                `Esska Collection · Dornblüthstraße 22 · 01277 Dresden · erstellt am ${erstellt} Uhr aus der Esska-App`,
                { x: RAND, y: y - 44, size: 8, font, color: GRAU }
            );
            y -= 62;
        } else {
            seite.drawText(`Kassenbericht ${o.zeitraum} (Fortsetzung)`, { x: RAND, y: y - 10, size: 9, font: fett, color: TEXT });
            y -= 24;
        }
        // Tabellenkopf
        let x = RAND;
        seite.drawRectangle({ x: RAND, y: y - 4, width: BREITE - 2 * RAND, height: ZEILE + 2, color: rgb(0.97, 0.94, 0.88) });
        for (const sp of spalten) {
            const t = kuerzen(fett, sp.titel, SCHRIFT, sp.breite - 4);
            const w = fett.widthOfTextAtSize(t, SCHRIFT);
            seite.drawText(t, { x: sp.rechts ? x + sp.breite - 4 - w : x + (x === RAND ? 2 : 8), y, size: SCHRIFT, font: fett, color: TEXT });
            x += sp.breite;
        }
        y -= ZEILE + 2;
    };

    kopf(true);
    for (const z of o.zeilen) {
        if (y < RAND + 30) {
            seite = doc.addPage([BREITE, HOEHE]);
            kopf(false);
        }
        const farbe = z.gueltig ? TEXT : GRAU;
        let x = RAND;
        for (const sp of spalten) {
            const t = kuerzen(font, sicher(font, sp.wert(z) ?? ""), SCHRIFT, sp.breite - 10);
            const w = font.widthOfTextAtSize(t, SCHRIFT);
            seite.drawText(t, { x: sp.rechts ? x + sp.breite - 4 - w : x + (x === RAND ? 2 : 8), y, size: SCHRIFT, font, color: farbe });
            x += sp.breite;
        }
        if (!z.gueltig) {
            // ersetzte Fassung sichtbar durchstreichen - bleibt aber lesbar
            seite.drawLine({ start: { x: RAND, y: y + 2.5 }, end: { x: x - spalten[spalten.length - 1].breite, y: y + 2.5 }, thickness: 0.4, color: GRAU });
        }
        seite.drawLine({ start: { x: RAND, y: y - 3.5 }, end: { x: BREITE - RAND, y: y - 3.5 }, thickness: 0.3, color: LINIE });
        y -= ZEILE;
    }

    // Summen (nur gueltige Eintraege)
    if (y < RAND + 70) {
        seite = doc.addPage([BREITE, HOEHE]);
        y = HOEHE - RAND;
    }
    y -= 14;
    seite.drawText("Summen (nur gültige Einträge)", { x: RAND, y, size: 9, font: fett, color: TEXT });
    y -= 14;
    for (const [k, v] of [
        ["Einnahmen", o.summen.einnahmen],
        ["In Tresor gelegt", o.summen.tresor],
    ]) {
        seite.drawText(k, { x: RAND, y, size: 9, font, color: TEXT });
        const t = `${v} €`;
        seite.drawText(t, { x: RAND + 180 - font.widthOfTextAtSize(t, 9), y, size: 9, font, color: TEXT });
        y -= 12;
    }
    y -= 6;
    seite.drawText(
        "Beträge in Euro. „Endbestand“ = Bargeld in der Kasse nach dem Einzahlen in den Tresor (= Startbestand des Folgetags). " +
            "Durchgestrichene Zeilen wurden per Korrektur ersetzt und bleiben zur Nachvollziehbarkeit erhalten.",
        { x: RAND, y, size: 7, font, color: GRAU, maxWidth: BREITE - 2 * RAND, lineHeight: 9 }
    );

    // Fusszeile mit Seitenzahlen
    const seiten = doc.getPages();
    seiten.forEach((s, i) => {
        const t = `Seite ${i + 1} von ${seiten.length}`;
        s.drawText(t, { x: BREITE - RAND - font.widthOfTextAtSize(t, 7), y: 16, size: 7, font, color: GRAU });
        s.drawText(`Kassenbericht ${o.zeitraum}`, { x: RAND, y: 16, size: 7, font, color: GRAU });
    });

    doc.setTitle(`Esska Kassenbericht ${o.zeitraum}`);
    doc.setAuthor("Esska Collection");
    doc.setProducer("Esska-App");
    doc.setCreationDate(new Date());
    return doc.save();
}
