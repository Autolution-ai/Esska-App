// E-Mail mit den Zugangsdaten fuer neu angelegte Mitarbeiter
// (Esska-Design wie die Samstags-Erinnerung, zweisprachig).
// NUR serverseitig verwenden.

export type ZugangsDaten = { url: string; email: string; passwort: string };

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function zugangsMailBetreff(): string {
    return "Dein Zugang zur Esska-App / Your access to the Esska app";
}

export function zugangsMailText(z: ZugangsDaten): string {
    return (
        `Hallo,\n\n` +
        `für dich wurde ein Zugang zur Esska-App angelegt.\n\n` +
        `Adresse: ${z.url}/auth/login\n` +
        `E-Mail:  ${z.email}\n` +
        `Passwort: ${z.passwort}\n\n` +
        `Nach der ersten Anmeldung führt dich die App durch die Angaben für deine Personalakte.\n` +
        `Tipp: Speichere die App auf deinem Startbildschirm – die Anleitung findest du nach dem Login.\n\n` +
        `---\n\n` +
        `Hello,\n\nan account for the Esska app has been created for you.\n` +
        `Address: ${z.url}/auth/login · Email: ${z.email} · Password: ${z.passwort}\n` +
        `After your first login, the app guides you through the details for your personnel file.\n\n` +
        `Esska Collection · Dornblüthstraße 22 · 01277 Dresden`
    );
}

export function zugangsMailHtml(z: ZugangsDaten): string {
    const url = esc(z.url);
    const email = esc(z.email);
    const pw = esc(z.passwort);
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
          <h1 style="margin:0 0 4px 0;font-size:20px;color:#1f1f1f;">Dein Zugang zur Esska-App</h1>
          <p style="margin:0 0 16px 0;font-size:14px;color:#888888;font-style:italic;">Your access to the Esska app</p>
          <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#333333;">
            Hallo, für dich wurde ein Zugang angelegt. Damit meldest du dich an:
          </p>
          <p style="margin:0 0 16px 0;font-size:13px;line-height:1.6;color:#888888;font-style:italic;">
            Hello, an account has been created for you. Use these details to log in:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf7ec;border:1px solid #f0e2c8;border-radius:8px;">
            <tr><td style="padding:14px 16px;font-size:14px;line-height:1.9;color:#333333;">
              <span style="color:#888888;">E-Mail:</span> <strong>${email}</strong><br>
              <span style="color:#888888;">Passwort / Password:</span>
              <strong style="font-family:Menlo,Consolas,monospace;font-size:15px;letter-spacing:1px;">${pw}</strong>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:20px 28px 24px 28px;">
          <a href="${url}/auth/login"
             style="display:inline-block;background-color:#9e2a2b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 32px;border-radius:8px;">
            Zur App&nbsp;/&nbsp;Open the app
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px 28px;">
          <p style="margin:0 0 4px 0;font-size:13px;line-height:1.6;color:#555555;">
            Nach der ersten Anmeldung führt dich die App durch die Angaben für deine Personalakte.
            Tipp: Speichere die App auf deinem Startbildschirm – die Anleitung findest du nach dem Login.
          </p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:#999999;font-style:italic;">
            After your first login, the app guides you through the details for your personnel file.
            Tip: add the app to your home screen – instructions are shown after logging in.
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
