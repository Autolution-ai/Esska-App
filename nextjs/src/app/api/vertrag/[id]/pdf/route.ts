// Vertrag als PDF: vor der Unterschrift eine ausgefuellte Vorschau, danach
// das unterschriebene Original. Zugriff wie beim Lesen des Vertrags:
// die Person selbst, Admin, zustaendiger Regionalmanager (Datenbankregel).

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";
import { fuelleVertrag } from "@/lib/esska/vertragpdf";
import { heuteIso, ladeVertragsDaten, ladeVorlagePdf, vertragsWerte } from "@/lib/esska/vertragserver";

function pdfAntwort(bytes: Uint8Array, dateiname: string, herunterladen: boolean) {
    return new NextResponse(Buffer.from(bytes), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `${herunterladen ? "attachment" : "inline"}; filename="${dateiname}"`,
            "Cache-Control": "private, no-store",
        },
    });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const herunterladen = new URL(request.url).searchParams.has("download");
        const userClient = (await createSSRClient()) as unknown as SupabaseClient;
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

        // Darf diese Person den Vertrag sehen? Die Datenbankregel entscheidet.
        const { data: sichtbar } = await userClient.from("arbeitsvertraege").select("id").eq("id", id).maybeSingle();
        if (!sichtbar) return NextResponse.json({ error: "Vertrag nicht gefunden." }, { status: 404 });

        const db = (await createServerAdminClient()) as unknown as SupabaseClient;
        const d = await ladeVertragsDaten(db, id);
        if (!d) return NextResponse.json({ error: "Vertrag nicht gefunden." }, { status: 404 });

        const name = `${d.person.nachname ?? "Vertrag"}_${d.person.vorname ?? ""}`.replace(/[^A-Za-z0-9_-]/g, "_");

        if (d.vertrag.unterschrieben_am && d.vertrag.pdf_pfad) {
            const { data, error } = await db.storage.from("arbeitsvertraege-unterschrieben").download(d.vertrag.pdf_pfad);
            if (error || !data) return NextResponse.json({ error: "PDF nicht gefunden." }, { status: 404 });
            return pdfAntwort(new Uint8Array(await data.arrayBuffer()), `Arbeitsvertrag_${name}.pdf`, herunterladen);
        }

        if (!d.layout || !d.vorlage) {
            return NextResponse.json({ error: "Für diese Beschäftigungsart ist noch keine Vertragsvorlage hinterlegt." }, { status: 404 });
        }
        const vorschau = await fuelleVertrag({
            vorlage: await ladeVorlagePdf(db, d.vorlage),
            layout: d.layout,
            werte: vertragsWerte(d, heuteIso()),
            vermerk: "VORSCHAU – noch nicht unterschrieben",
        });
        return pdfAntwort(vorschau, `Arbeitsvertrag_Vorschau_${name}.pdf`, herunterladen);
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
    }
}
