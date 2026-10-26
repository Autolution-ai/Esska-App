// E-Mail an eingeplante Mitarbeiter, sobald ein Wochenplan veroeffentlicht
// wird (Esska-Design, zweisprachig). NUR serverseitig verwenden.

export type SchichtZeile = { datum: string; start: string; ende: string };

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function tag(datum: string): { de: string; en: string } {
    const [y, m, d] = datum.split("-").map((x) => parseInt(x, 10));
    const dt = new Date(y, m - 1, d);
    const kurz = `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.`;
    return { de: `${WT[dt.getDay()]}, ${kurz}`, en: `${WT_EN[dt.getDay()]} ${kurz}` };
}

export function schichtMailBetreff(center: string, woche: string): string {
    return `Dein Schichtplan ${woche} – ${center} / Your shift plan`;
}

export function schichtMailText(o: {
    vorname: string | null;
    center: string;
    woche: string;
    schichten: SchichtZeile[];
    url: string;
}): string {
    const zeilen = o.schichten.map((s) => `  - ${tag(s.datum).de}  ${s.start}–${s.ende} Uhr`).join("\n");
    return (
        `Hallo${o.vorname ? ` ${o.vorname}` : ""},\n\n` +
        `der Schichtplan für ${o.center} (${o.woche}) ist veröffentlicht. Du bist eingeplant:\n\n` +
        `${zeilen}\n\n` +
        `Alle Details findest du in der App unter „Meine Schichten": ${o.url}/app/my-shifts\n\n` +
        `---\n\nThe shift plan for ${o.center} (${o.woche}) has been published. ` +
        `Your shifts are listed above. Details: ${o.url}/app/my-shifts\n\n` +
        `Esska Collection · Dornblüthstraße 22 · 01277 Dresden`
    );
}

export function schichtMailHtml(o: {
    vorname: string | null;
    center: string;
    woche: string;
    schichten: SchichtZeile[];
    url: string;
}): string {
    const anrede = o.vorname ? `Hallo ${esc(o.vorname)}` : "Hallo";
    const zeilen = o.schichten
        .map((s) => {
            const t = tag(s.datum);
            return `<tr>
              <td style="padding:8px 12px;border-bottom:1px solid #f0e2c8;font-size:14px;color:#333333;">
                <strong>${t.de}</strong> <span style="color:#999999;font-style:italic;">/ ${t.en}</span>
              </td>
              <td style="padding:8px 12px;border-bottom:1px solid #f0e2c8;font-size:14px;color:#333333;text-align:right;white-space:nowrap;">
                ${esc(s.start)}–${esc(s.ende)} Uhr
              </td>
            </tr>`;
        })
        .join("");
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
          <h1 style="margin:0 0 4px 0;font-size:20px;color:#1f1f1f;">Dein Schichtplan ist da 📅</h1>
          <p style="margin:0 0 16px 0;font-size:14px;color:#888888;font-style:italic;">Your shift plan has been published</p>
          <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#333333;">
            ${anrede}, der Schichtplan für <strong>${esc(o.center)}</strong> in der Woche
            <strong>${esc(o.woche)}</strong> ist veröffentlicht. Du bist eingeplant:
          </p>
          <p style="margin:0 0 16px 0;font-size:13px;line-height:1.6;color:#888888;font-style:italic;">
            The shift plan for ${esc(o.center)} (${esc(o.woche)}) has been published. Your shifts:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0e2c8;border-radius:8px;">
            ${zeilen}
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:20px 28px 24px 28px;">
          <a href="${esc(o.url)}/app/my-shifts"
             style="display:inline-block;background-color:#9e2a2b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 32px;border-radius:8px;">
            Meine Schichten&nbsp;/&nbsp;My shifts
          </a>
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
