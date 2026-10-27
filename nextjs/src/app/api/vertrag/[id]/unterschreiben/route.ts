// Arbeitsvertrag mit dem Finger unterschreiben.
//
// Nur die Person selbst. Der Server fuellt die Vorlage mit den aktuellen
// Stammdaten aus, setzt Ort, Datum und Unterschrift(en) ein, legt das PDF
// im privaten Bucket ab und vermerkt die Unterschrift. Danach ist der
// Vertrag unveraenderbar (Datenbank-Trigger).

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";
import { fuelleVertrag, pngAusDataUrl } from "@/lib/esska/vertragpdf";
import {
    fehlendeAngaben,
    heuteIso,
    ladeVertragsDaten,
    ladeVorlagePdf,
    minderjaehrig,
    vertragsWerte,
} from "@/lib/esska/vertragserver";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const userClient = (await createSSRClient()) as unknown as SupabaseClient;
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

        const db = (await createServerAdminClient()) as unknown as SupabaseClient;
        const d = await ladeVertragsDaten(db, id);
        if (!d || d.vertrag.profile_id !== user.id) {
            return NextResponse.json({ error: "Vertrag nicht gefunden." }, { status: 404 });
        }
        if (d.vertrag.unterschrieben_am) {
            return NextResponse.json({ error: "Dieser Vertrag ist bereits unterschrieben." }, { status: 409 });
        }
        if (!d.layout || !d.vorlage) {
            return NextResponse.json({ error: "Für diese Beschäftigungsart ist noch keine Vertragsvorlage hinterlegt." }, { status: 409 });
        }
        const fehlt = fehlendeAngaben(d);
        if (fehlt.length > 0) {
            return NextResponse.json(
                { error: `Im Vertrag fehlen noch Angaben: ${fehlt.join(", ")}. Bitte zuerst die Stammdaten ergänzen.` },
                { status: 400 }
            );
        }

        const body = await request.json().catch(() => null);
        if (body?.geprueft !== true) {
            return NextResponse.json({ error: "Bitte bestätige, dass du die Angaben geprüft hast." }, { status: 400 });
        }
        let unterschrift: Uint8Array;
        let vertreter: Uint8Array | null = null;
        try {
            unterschrift = pngAusDataUrl(String(body?.unterschrift ?? ""));
            const heute = heuteIso();
            if (minderjaehrig(d.person.geburtsdatum, heute)) {
                if (!body?.vertreter) {
                    return NextResponse.json(
                        { error: "Bei Minderjährigen muss zusätzlich die gesetzliche Vertretung unterschreiben." },
                        { status: 400 }
                    );
                }
                vertreter = pngAusDataUrl(String(body.vertreter));
            }
        } catch (e) {
            return NextResponse.json({ error: e instanceof Error ? e.message : "Ungültige Unterschrift." }, { status: 400 });
        }

        const heute = heuteIso();
        const jetzt = new Date();
        const zeit = new Intl.DateTimeFormat("de-DE", {
            timeZone: "Europe/Berlin",
            dateStyle: "short",
            timeStyle: "short",
        }).format(jetzt);
        const werte = vertragsWerte(d, heute);
        const pdf = await fuelleVertrag({
            vorlage: await ladeVorlagePdf(db, d.vorlage),
            layout: d.layout,
            werte,
            unterschrift,
            vertreter,
            vermerk: `Elektronisch unterschrieben in der Esska-App am ${zeit} Uhr · Vertrags-Nr. ${d.vertrag.id.slice(0, 8)}`,
        });

        const pfad = `${d.vertrag.profile_id}/${d.vertrag.id}.pdf`;
        const { error: upErr } = await db.storage
            .from("arbeitsvertraege-unterschrieben")
            .upload(pfad, pdf, { contentType: "application/pdf", upsert: false });
        if (upErr) throw new Error(`PDF konnte nicht gespeichert werden: ${upErr.message}`);

        const { error: updErr } = await db
            .from("arbeitsvertraege")
            .update({
                unterschrieben_am: jetzt.toISOString(),
                pdf_pfad: pfad,
                angaben: { ...werte, vorlage: d.vorlage.titel, vorlage_id: d.vorlage.id },
                unterschrift_meta: {
                    browser: request.headers.get("user-agent") ?? null,
                    vertretung_unterschrieben: vertreter !== null,
                },
            })
            .eq("id", d.vertrag.id)
            .is("unterschrieben_am", null);
        if (updErr) {
            // Aufraeumen, damit kein verwaistes PDF liegen bleibt
            await db.storage.from("arbeitsvertraege-unterschrieben").remove([pfad]);
            throw new Error(updErr.message);
        }

        return NextResponse.json({ ok: true, unterschrieben_am: jetzt.toISOString() });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Unterschreiben fehlgeschlagen" }, { status: 500 });
    }
}
