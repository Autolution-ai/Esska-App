// Personalstammdaten gesammelt an die Buchhaltung mailen.
//
// POST { profileIds: string[] }  (nur Admin)
//   - erzeugt pro ausgewaehltem Mitarbeiter das Stammdaten-PDF
//     (derselbe Personalfragebogen wie der Download auf der Detailseite)
//   - haengt zusaetzlich eine Uebersichts-CSV mit den Kernfeldern an
//   - verschickt EINE E-Mail mit allen Anhaengen an die Buchhaltung
//   - protokolliert den Versand je Mitarbeiter im Aenderungslog
//     (profile_change_log), damit nachvollziehbar bleibt, wessen Daten
//     wann nach extern gegangen sind (DSGVO-Nachweis)
//
// GET  (nur Admin) -> { empfaenger } zur Anzeige im Bestaetigungsdialog.
//
// Empfaenger kommt aus der Vercel-Umgebungsvariable BUCHHALTUNG_EMAIL;
// ohne sie gilt der eingebaute Standard.

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";
import { generiereStammdatenPdf } from "@/lib/esska/pdf";
import type { EsskaProfile } from "@/lib/esska/types";
import { centToEuro } from "@/lib/esska/types";

const STANDARD_EMPFAENGER = "buchhaltung.weinert@gmail.com";

function empfaenger(): string {
    return process.env.BUCHHALTUNG_EMAIL ?? STANDARD_EMPFAENGER;
}

/** Prueft die Admin-Rolle und liefert die User-ID, oder eine Fehler-Response. */
async function adminPruefen(): Promise<NextResponse | { userId: string }> {
    const userClient = await createSSRClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    const { data: profile } = await (userClient as unknown as {
        from: (t: string) => {
            select: (c: string) => {
                eq: (k: string, v: string) => { single: () => Promise<{ data: { role: string } | null }> };
            };
        };
    })
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    if (profile?.role !== "admin") {
        return NextResponse.json({ error: "Diese Aktion ist nur für Admins erlaubt." }, { status: 403 });
    }
    return { userId: user.id };
}

export async function GET() {
    const check = await adminPruefen();
    if (check instanceof NextResponse) return check;
    return NextResponse.json({ empfaenger: empfaenger() });
}

function csvFeld(v: string | number | boolean | null | undefined): string {
    if (v === null || v === undefined) return '""';
    return `"${String(v).replace(/"/g, '""')}"`;
}

function uebersichtsCsv(profile: EsskaProfile[]): string {
    const header = [
        "Nachname", "Vorname", "Geburtsdatum", "Geburtsort", "Staatsangehoerigkeit",
        "Familienstand", "Strasse", "PLZ", "Ort", "Telefon", "E-Mail",
        "Eintrittsdatum", "Arbeitszeit-Modell", "Stunden_pro_Woche", "Verdienst_Monat_EUR",
        "Weitere_Beschaeftigungen", "RV-Nummer", "Krankenkasse", "KV-Status",
        "RV-Befreiung_beantragt", "Steuer-ID", "Steuerklasse", "Kinderfreibetrag", "Konfession",
    ];
    const rows = profile.map((p) => [
        p.nachname, p.vorname, p.geburtsdatum, p.geburtsort, p.staatsangehoerigkeit,
        p.familienstand, p.anschrift_strasse, p.anschrift_plz, p.anschrift_ort,
        p.telefon_mobil, p.email,
        p.eintrittsdatum, p.arbeitszeit_modell, p.stunden_pro_woche,
        p.verdienst_monat_eur_cent !== null ? centToEuro(p.verdienst_monat_eur_cent) : null,
        p.weitere_beschaeftigungen, p.rentenversicherungsnummer,
        p.krankenversicherung_name, p.krankenversicherung_status,
        p.rentenversicherung_befreit ? "ja" : "nein",
        p.steuer_id, p.steuerklasse, p.kinderfreibetrag, p.konfession,
    ]);
    return [header.map(csvFeld).join(";"), ...rows.map((r) => r.map(csvFeld).join(";"))].join("\n");
}

function dateiname(p: EsskaProfile): string {
    const roh = `${p.nachname ?? "Unbekannt"}_${p.vorname ?? ""}`.trim();
    const sauber = roh
        .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
        .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
        .replace(/[^A-Za-z0-9_-]/g, "_");
    return `Stammdaten_${sauber}.pdf`;
}

export async function POST(request: Request) {
    const check = await adminPruefen();
    if (check instanceof NextResponse) return check;

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass) {
        return NextResponse.json(
            { error: "E-Mail-Versand ist nicht konfiguriert (SMTP_USER / SMTP_PASS fehlen in Vercel)." },
            { status: 500 }
        );
    }

    let profileIds: unknown;
    try {
        const body = await request.json();
        profileIds = body?.profileIds;
    } catch {
        return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }
    if (!Array.isArray(profileIds) || profileIds.length === 0 || profileIds.length > 100
        || !profileIds.every((x) => typeof x === "string")) {
        return NextResponse.json(
            { error: "Bitte mindestens einen und höchstens 100 Mitarbeiter auswählen." },
            { status: 400 }
        );
    }

    try {
        // untypisiert, weil die generierten Database-Typen die Esska-Tabellen
        // nicht kennen (gleiches Muster wie getEsskaClient im Frontend)
        const admin = (await createServerAdminClient()) as unknown as SupabaseClient;
        const { data, error: pErr } = await admin
            .from("profiles")
            .select("*")
            .in("id", profileIds as string[]);
        if (pErr) throw new Error(`Profile laden: ${pErr.message}`);
        const profile = ((data as unknown as EsskaProfile[]) ?? []).sort((a, b) =>
            (a.nachname ?? "").localeCompare(b.nachname ?? "", "de")
        );
        if (profile.length === 0) {
            return NextResponse.json({ error: "Keiner der ausgewählten Mitarbeiter wurde gefunden." }, { status: 404 });
        }

        // Anhaenge: ein PDF pro Person + eine Uebersichts-CSV
        const anhaenge: Array<{ filename: string; content: Buffer }> = [];
        for (const p of profile) {
            const bytes = await generiereStammdatenPdf(p);
            anhaenge.push({ filename: dateiname(p), content: Buffer.from(bytes) });
        }
        const heute = new Date().toLocaleDateString("de-DE");
        anhaenge.push({
            filename: `Uebersicht_Stammdaten_${new Date().toISOString().slice(0, 10)}.csv`,
            content: Buffer.from("﻿" + uebersichtsCsv(profile), "utf-8"),
        });

        const namen = profile.map((p) => `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || (p.email ?? "?"));
        const an = empfaenger();

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST ?? "smtp.gmail.com",
            port: parseInt(process.env.SMTP_PORT ?? "587", 10),
            secure: (process.env.SMTP_PORT ?? "587") === "465",
            auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
            from: `"Esska Collection" <${smtpUser}>`,
            to: an,
            subject: `Esska Collection – Personalstammdaten (${profile.length} Mitarbeiter), ${heute}`,
            text:
                `Guten Tag,\n\n` +
                `anbei die Personalstammdaten der folgenden Mitarbeiter von Esska Collection ` +
                `(je ein PDF pro Person plus eine Übersichts-CSV):\n\n` +
                namen.map((n) => `  - ${n}`).join("\n") +
                `\n\nDiese E-Mail wurde automatisch aus der Esska-App verschickt.\n\n` +
                `Mit freundlichen Grüßen\nEsska Collection\nDornblüthstraße 22, 01277 Dresden`,
            attachments: anhaenge,
        });

        // Versand je Mitarbeiter protokollieren (append-only Aenderungslog)
        const { error: logErr } = await admin.from("profile_change_log").insert(
            profile.map((p) => ({
                profile_id: p.id,
                changed_by: check.userId,
                feld: "stammdaten_versand_buchhaltung",
                alter_wert: null,
                neuer_wert: `Stammdaten-PDF + CSV an ${an} gesendet`,
            }))
        );
        // Ein Log-Fehler soll den erfolgreichen Versand nicht als Fehler melden
        if (logErr) console.error("Versand-Log fehlgeschlagen:", logErr.message);

        return NextResponse.json({ ok: true, verschickt: profile.length, empfaenger: an, namen });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unbekannter Fehler beim Versand." },
            { status: 500 }
        );
    }
}
