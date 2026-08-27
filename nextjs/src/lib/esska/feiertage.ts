// Deutsche bundesweite gesetzliche Feiertage + Sonntage.
// Bewegliche Feiertage werden ueber die Gausssche Osterformel berechnet.

function osterSonntag(jahr: number): Date {
    const a = jahr % 19;
    const b = Math.floor(jahr / 100);
    const c = jahr % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const monat = Math.floor((h + l - 7 * m + 114) / 31);
    const tag = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(jahr, monat - 1, tag);
}

function plus(d: Date, tage: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + tage);
    return x;
}

function iso(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const t = d.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${t}`;
}

/** Bundesweite Feiertage Deutschland fuer das Jahr, jeweils mit Label. */
export function feiertageBundesweit(jahr: number): Map<string, string> {
    const map = new Map<string, string>();
    const ostern = osterSonntag(jahr);
    map.set(`${jahr}-01-01`, "Neujahr");
    map.set(iso(plus(ostern, -2)), "Karfreitag");
    map.set(iso(plus(ostern, 1)), "Ostermontag");
    map.set(`${jahr}-05-01`, "Tag der Arbeit");
    map.set(iso(plus(ostern, 39)), "Christi Himmelfahrt");
    map.set(iso(plus(ostern, 50)), "Pfingstmontag");
    map.set(`${jahr}-10-03`, "Tag der Deutschen Einheit");
    map.set(`${jahr}-12-25`, "1. Weihnachtstag");
    map.set(`${jahr}-12-26`, "2. Weihnachtstag");
    return map;
}

/** Gibt das Feiertags-Label fuer einen ISO-Tag zurueck, oder null. */
export function feiertagFuer(datum: string): string | null {
    const jahr = parseInt(datum.slice(0, 4), 10);
    if (Number.isNaN(jahr)) return null;
    return feiertageBundesweit(jahr).get(datum) ?? null;
}

/** Ist der gegebene ISO-Tag ein Sonntag? */
export function istSonntag(datum: string): boolean {
    // Teile selbst zerlegen: new Date("YYYY-MM-DD") liefert UTC-Mitternacht
    // und kippt je nach Zeitzone auf den Vortag (zeigte "Sonntag" bei Montagen).
    const [y, m, t] = datum.split("-").map((x) => parseInt(x, 10));
    return new Date(y, (m || 1) - 1, t || 1).getDay() === 0;
}
