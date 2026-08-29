// Automatische Erinnerung: Verfuegbarkeiten fuer die naechste Woche eintragen.
//
// Wird von Vercel Cron aufgerufen (Zeitplan in nextjs/vercel.json, samstags).
// Ablauf:
//   1. Naechste Woche bestimmen (Montag bis Sonntag).
//   2. Alle aktiven Mitarbeiter mit abgeschlossenem Onboarding laden.
//   3. Pruefen, wer fuer diese Woche noch KEINE Verfuegbarkeit eingetragen hat.
//   4. Nur diesen Personen eine Erinnerungs-Mail schicken (SMTP, z. B. Gmail).
//
// Absicherung: Vercel schickt bei eingerichtetem CRON_SECRET automatisch
// "Authorization: Bearer <CRON_SECRET>" mit. Ohne gueltigen Header wird die
// Route abgelehnt - niemand kann von aussen Mails ausloesen.
//
// Benoetigte Umgebungsvariablen (in Vercel):
//   CRON_SECRET  - beliebige lange Zufallszeichenfolge
//   SMTP_USER    - vollstaendige Gmail-Adresse (auch Absender)
//   SMTP_PASS    - 16-stelliges Google-App-Passwort (ohne Leerzeichen)
//   SMTP_HOST    - optional, Standard smtp.gmail.com
//   SMTP_PORT    - optional, Standard 587
//   APP_URL      - optional, Standard https://esska-app.vercel.app

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";
import { addTage, isoDatum, montagDerWoche } from "@/lib/esska/types";

export const dynamic = "force-dynamic";

type MiniProfil = {
    id: string;
    vorname: string | null;
    email: string | null;
};

function erinnerungsHtml(vorname: string | null, wochenText: string, appUrl: string): string {
    const anrede = vorname ? `Hallo ${vorname}` : "Hallo";
    return `
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf7ec;padding:32px 12px;font-family:Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;border:1px solid #f0e2c8;">
      <tr>
        <td style="background-color:#9e2a2b;border-radius:12px 12px 0 0;padding:24px;text-align:center;">
          <span style="color:#f7ebd3;font-size:22px;font-weight:bold;letter-spacing:2px;">ESSKA COLLECTION</span>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 28px 8px 28px;">
          <h1 style="margin:0 0 4px 0;font-size:20px;color:#1f1f1f;">Erinnerung: Wochenplan ausfüllen ⏰</h1>
          <p style="margin:0 0 16px 0;font-size:14px;color:#888888;font-style:italic;">Reminder: please fill in your availability</p>
          <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#333333;">
            ${anrede}, für die Woche <strong>${wochenText}</strong> hast du deine Verfügbarkeiten
            noch nicht eingetragen. Bitte trage sie bis zum Wochenende ein, damit der
            Schichtplan erstellt werden kann.
          </p>
          <p style="margin:0 0 24px 0;font-size:13px;line-height:1.6;color:#888888;font-style:italic;">
            You have not yet entered your availability for the week of <strong>${wochenText}</strong>.
            Please fill it in before the weekend so the shift plan can be created.
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 28px 24px 28px;">
          <a href="${appUrl}/app/availability"
             style="display:inline-block;background-color:#9e2a2b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 32px;border-radius:8px;">
            Wochenplan öffnen&nbsp;/&nbsp;Open weekly plan
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px 28px;">
          <p style="margin:0 0 4px 0;font-size:12px;line-height:1.6;color:#999999;">
            Du hast die Verfügbarkeiten gerade eben eingetragen? Dann hat sich diese
            E-Mail überschnitten und du kannst sie ignorieren.
          </p>
          <p style="margin:0;font-size:11px;line-height:1.6;color:#aaaaaa;font-style:italic;">
            Just entered your availability? Then this email crossed paths with you
            and can be ignored.
          </p>
        </td>
      </tr>
      <tr>
        <td style="border-top:1px solid #f0e2c8;padding:18px 28px;text-align:center;">
          <p style="margin:0;font-size:11px;line-height:1.6;color:#999999;">
            Esska Collection · Dornblüthstraße 22 · 01277 Dresden<br>
            Diese E-Mail wurde automatisch von der Esska-App verschickt.<br>
            <span style="font-style:italic;">This email was sent automatically by the Esska app.</span>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>`;
}

export async function GET(request: Request) {
    // 1) Zugriffsschutz
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return NextResponse.json(
            { error: "CRON_SECRET ist nicht konfiguriert - Erinnerungen sind deaktiviert." },
            { status: 500 }
        );
    }
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Nicht erlaubt" }, { status: 401 });
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass) {
        return NextResponse.json(
            { error: "SMTP_USER / SMTP_PASS fehlen in den Umgebungsvariablen." },
            { status: 500 }
        );
    }

    // 2) Naechste Woche bestimmen (Montag..Sonntag)
    const naechsterMontag = addTage(montagDerWoche(new Date()), 7);
    const von = isoDatum(naechsterMontag);
    const bis = isoDatum(addTage(naechsterMontag, 6));
    const wochenText = `${naechsterMontag.toLocaleDateString("de-DE")} – ${addTage(naechsterMontag, 6).toLocaleDateString("de-DE")}`;

    try {
        const admin = await createServerAdminClient();

        // 3) Aktive Mitarbeiter mit fertigem Onboarding
        const { data: profile, error: pErr } = await admin
            .from("profiles")
            .select("id, vorname, email")
            .eq("role", "mitarbeiter")
            .eq("aktiv", true)
            .eq("onboarding_abgeschlossen", true);
        if (pErr) throw new Error(`Profile laden: ${pErr.message}`);

        // 4) Wer hat fuer die Woche schon etwas eingetragen?
        const { data: vorhanden, error: aErr } = await admin
            .from("availabilities")
            .select("profile_id")
            .gte("datum", von)
            .lte("datum", bis);
        if (aErr) throw new Error(`Verfuegbarkeiten laden: ${aErr.message}`);

        const eingetragen = new Set(
            ((vorhanden as Array<{ profile_id: string }>) ?? []).map((v) => v.profile_id)
        );
        const fehlend = ((profile as MiniProfil[]) ?? []).filter(
            (p) => p.email && !eingetragen.has(p.id)
        );

        if (fehlend.length === 0) {
            return NextResponse.json({
                ok: true,
                woche: `${von} bis ${bis}`,
                verschickt: 0,
                hinweis: "Alle Mitarbeiter haben ihre Verfuegbarkeiten bereits eingetragen.",
            });
        }

        // 5) Mails verschicken (nacheinander, um Gmail nicht zu reizen)
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST ?? "smtp.gmail.com",
            port: parseInt(process.env.SMTP_PORT ?? "587", 10),
            secure: (process.env.SMTP_PORT ?? "587") === "465",
            auth: { user: smtpUser, pass: smtpPass },
        });

        const appUrl = process.env.APP_URL ?? "https://esska-app.vercel.app";
        const ergebnisse: Array<{ email: string; ok: boolean; fehler?: string }> = [];

        for (const p of fehlend) {
            try {
                await transporter.sendMail({
                    from: `"Esska Collection" <${smtpUser}>`,
                    to: p.email!,
                    subject: `Erinnerung: Wochenplan für ${wochenText} ausfüllen / Reminder: fill in your availability`,
                    html: erinnerungsHtml(p.vorname, wochenText, appUrl),
                });
                ergebnisse.push({ email: p.email!, ok: true });
            } catch (err) {
                ergebnisse.push({
                    email: p.email!,
                    ok: false,
                    fehler: err instanceof Error ? err.message : String(err),
                });
            }
        }

        const verschickt = ergebnisse.filter((r) => r.ok).length;
        const fehler = ergebnisse.filter((r) => !r.ok);
        return NextResponse.json({
            ok: fehler.length === 0,
            woche: `${von} bis ${bis}`,
            verschickt,
            fehlgeschlagen: fehler,
        });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
            { status: 500 }
        );
    }
}
