// Schrift fuer alle PDFs der App: Liberation Sans (SIL Open Font License,
// siehe public/fonts/LICENSE-Liberation.txt). Gleiche Zeichenbreiten wie
// Helvetica/Arial, aber mit vollem Zeichensatz - die eingebaute PDF-Schrift
// kann z. B. das tuerkische "İ" nicht darstellen und bricht dann ab.

import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

export type SchriftBytes = { normal: Uint8Array; fett: Uint8Array };

export const SCHRIFT_DATEIEN = {
    normal: "fonts/LiberationSans-Regular.ttf",
    fett: "fonts/LiberationSans-Bold.ttf",
};

/** Im Browser: Schriften von /fonts laden (einmal je Seitenaufruf). */
let browserCache: Promise<SchriftBytes> | null = null;
export function ladeSchriftenBrowser(): Promise<SchriftBytes> {
    if (!browserCache) {
        const hole = async (pfad: string) => {
            const res = await fetch(`/${pfad}`);
            if (!res.ok) throw new Error("Schrift für das PDF konnte nicht geladen werden.");
            return new Uint8Array(await res.arrayBuffer());
        };
        browserCache = Promise.all([hole(SCHRIFT_DATEIEN.normal), hole(SCHRIFT_DATEIEN.fett)])
            .then(([normal, fett]) => ({ normal, fett }))
            .catch((e) => {
                browserCache = null;
                throw e;
            });
    }
    return browserCache;
}

/** Schriften in ein PDF einbetten (nur die benutzten Zeichen). */
export async function schriftenEinbetten(
    doc: PDFDocument,
    bytes: SchriftBytes
): Promise<{ normal: PDFFont; fett: PDFFont }> {
    doc.registerFontkit(fontkit);
    const [normal, fett] = await Promise.all([
        doc.embedFont(bytes.normal, { subset: true }),
        doc.embedFont(bytes.fett, { subset: true }),
    ]);
    return { normal, fett };
}
