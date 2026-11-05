// Schriften fuer PDFs in API-Routen (vom Dateisystem). NUR serverseitig.
// Die Dateien liegen in public/fonts; next.config.ts nimmt sie in die
// Serverless-Funktionen mit auf.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { SCHRIFT_DATEIEN, type SchriftBytes } from "@/lib/esska/pdfschrift";

let cache: Promise<SchriftBytes> | null = null;
export function ladeSchriftenServer(): Promise<SchriftBytes> {
    if (!cache) {
        const hole = async (pfad: string) =>
            new Uint8Array(await readFile(path.join(process.cwd(), "public", pfad)));
        cache = Promise.all([hole(SCHRIFT_DATEIEN.normal), hole(SCHRIFT_DATEIEN.fett)]).then(([normal, fett]) => ({
            normal,
            fett,
        }));
        cache.catch(() => {
            cache = null;
        });
    }
    return cache;
}
