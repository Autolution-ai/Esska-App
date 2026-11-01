// Server-seitiger Mail-Versand ueber die konfigurierte SMTP-Strecke
// (aktuell Gmail; ein Wechsel zu Resend o. ae. ist reine Konfiguration).
// NUR in API-Routen verwenden - nie im Browser.

import nodemailer from "nodemailer";

export function smtpKonfiguriert(): boolean {
    return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Ist ein eigenes Absender-Postfach fuer Warenbestellungen hinterlegt? */
export function bestellKontoKonfiguriert(): boolean {
    return !!(process.env.BESTELL_SMTP_USER && process.env.BESTELL_SMTP_PASS);
}

export async function sendeMail(optionen: {
    an: string;
    betreff: string;
    text: string;
    /** Optionale HTML-Fassung; der Text bleibt fuer Mailprogramme ohne HTML. */
    html?: string;
    /** "bestellung": ueber das eigene Bestell-Postfach senden
     *  (BESTELL_SMTP_USER / BESTELL_SMTP_PASS), falls hinterlegt -
     *  sonst ueber das normale App-Postfach. */
    konto?: "standard" | "bestellung";
}): Promise<void> {
    const bestellKonto = optionen.konto === "bestellung" && bestellKontoKonfiguriert();
    const smtpUser = bestellKonto ? process.env.BESTELL_SMTP_USER : process.env.SMTP_USER;
    const smtpPass = bestellKonto ? process.env.BESTELL_SMTP_PASS : process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass) {
        throw new Error("E-Mail-Versand ist nicht konfiguriert (SMTP_USER / SMTP_PASS fehlen in Vercel).");
    }
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT ?? "587", 10),
        secure: (process.env.SMTP_PORT ?? "587") === "465",
        auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
        from: `"Esska Collection" <${smtpUser}>`,
        to: optionen.an,
        subject: optionen.betreff,
        text: optionen.text,
        ...(optionen.html ? { html: optionen.html } : {}),
    });
}
