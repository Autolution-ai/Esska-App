# HANDOFF — Esska-App (Session 2)

**Erstellt:** 2026-09-12
**Session-Nr.:** 2 (29.08.–12.09.2026)
**Auslöser:** manuell angefordert (Skill `context-handoff`)
**Vorgänger:** Der Eintrag zu Session 1 (12.06.–06.08.2026) steht **weiter unten in
dieser Datei** — dort finden sich Projektgrundlagen, Template-Wahl, CI-Farben und die
Historie bis August. **Beide Einträge lesen**, dieser hier ergänzt den alten, ersetzt
ihn nicht.

---

## 1. KURZFASSUNG (30 Sekunden)

Die Esska-App (interne Saison-App für Esska Collection, Dresden) ist funktional
**fertig**: Personalakte, Schichtplanung, Kassenerfassung nach GoBD, Bestellwesen,
Buchhaltungs-Exporte, PWA. In dieser Session wurde die komplette Änderungsliste aus
dem Meeting mit Jannis vom 31.08. in sechs Phasen abgearbeitet, ein Code-Review mit
13 Funden durchgeführt (kritische behoben), alle Rechtstexte neu geschrieben und ein
Kosten-Briefing für Jannis erstellt.

**Stand jetzt:** Technisch launch-ready. Blockierend sind nur noch **organisatorische**
Punkte: Jannis' Antworten auf den Fragebogen (Firmendaten für die Rechtstexte), eigene
Domain, Entscheidung über die Tarife, Restore-Test.

**Unmittelbar nächster Schritt:** Auf Jannis' Antwort warten. Parallel kann der
Netlify-Umzug vorbereitet werden — der Nutzer hat danach gefragt, aber **noch kein
Go gegeben**. Letzte Nachricht von mir war das Angebot, die Netlify-Konfiguration
vorzubereiten, ohne das laufende System anzufassen.

---

## 2. PROJEKT-KONTEXT

**Übergeordnetes Ziel:** unverändert (siehe Session 1) — All-in-One-App für die
Saisonverwaltung, rollenbasiert, DSGVO-konform.

**Session-Ziel:** Die 60+ Punkte umfassende Änderungsliste aus dem 89-minütigen
Google-Meet-Durchgang mit Jannis (31.08.2026) umsetzen und die App produktionsreif
machen.

**Stakeholder:**
| Person | Rolle |
|---|---|
| Bruno Hofmann | Praktikant, Entwickler, Nutzer dieser Session (`bruann1008@gmail.com`) |
| Jannis Alekhanov | Inhaber Esska Collection, Auftraggeber |
| Chris Taumann | Test-Mitarbeiter (`taumannchris@gmail.com`) |
| Autolution (Brunos Agentur) | betreibt aktuell noch den Vercel-Account |

---

## 3. TOOL-STACK & UMGEBUNG

Unverändert gegenüber Session 1, mit diesen Ergänzungen:

| Kategorie | Konkret | Begründung |
|---|---|---|
| E-Mail-Versand | **nodemailer** über SMTP (aktuell Gmail) | generisch gehalten, damit ein Wechsel zu Resend reine Konfiguration ist |
| PDF-Erzeugung (Doku) | headless Chromium unter `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` | pandoc/weasyprint nicht installiert |
| PDF-Bearbeitung | `pypdf` (per pip nachinstalliert) | Merkblatt-Seiten extrahieren |
| Icons | `pillow` (per pip nachinstalliert) | PWA-Icons generiert |
| Backups | GitHub Actions (`.github/workflows/backup.yml`) | Supabase Free hat keine Backups |
| MCP | **Supabase-MCP aktiv genutzt** | Migrationen wurden teilweise direkt eingespielt |

**Supabase-Projekt:** `tbkuqvnjywgjqcgzryww`, Region AWS eu-central-1 (Frankfurt).
**Wichtig:** Der Supabase-Account läuft bereits auf **Esska**. Nur der **Vercel-Account
läuft noch über Brunos Agentur** — das ist ein offener organisatorischer Punkt.

**Umfang aktuell:** 14.081 Zeilen TS/TSX, 30 Seiten, 7 API-Routen, 23 Migrationen,
19 Tabellen.

**Befehle die funktionieren:**
```bash
cd /home/user/Esska-App/nextjs && npm run build          # vor jedem Commit
cd /home/user/Esska-App/nextjs && npx tsc --noEmit       # schneller Typcheck
cat ~/Esska-App/supabase/migrations/<DATEI>.sql | pbcopy # Mac: Migration kopieren
```

**Umgebungsvariablen (Namen, keine Werte):**
| Variable | Wofür | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Projekt | gesetzt |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-Key | gesetzt |
| `PRIVATE_SUPABASE_SERVICE_KEY` | Server-Key | gesetzt |
| `SMTP_USER` / `SMTP_PASS` | Gmail-Versand (App-Passwort) | gesetzt, getestet |
| `CRON_SECRET` | schützt die Erinnerungs-Route | gesetzt, getestet |
| `BUCHHALTUNG_EMAIL` | Empfänger der Stammdaten | **muss gesetzt sein, sonst blockiert der Versand** |
| `LAGER_EMAIL` | Empfänger der Bestellungen | **noch nicht gesetzt** (Adresse fehlt von Jannis) |
| `APP_URL` | Links in Erinnerungs-Mails | optional, Standard `https://esska-app.vercel.app` |
| `SUPABASE_DB_URL` (GitHub Secret) | Backup-Verbindung | **noch nicht gesetzt** |
| `BACKUP_PASSWORT` (GitHub Secret) | Backup-Verschlüsselung | **noch nicht gesetzt** |

---

## 4. ARCHITEKTUR — was sich geändert hat

**Rollenmodell ist jetzt dreistufig:** `admin` | `regionalmanager` | `mitarbeiter`.
Durchgesetzt über RLS mit drei SECURITY-DEFINER-Helfern:
- `is_regionalmanager()`
- `manages_center(cid uuid)` — ist der Nutzer Manager dieses Centers?
- `manages_employee(pid uuid)` — betreut er ein Center dieses Mitarbeiters?

**Neue Tabellen (alle mit RLS):**
| Tabelle | Zweck |
|---|---|
| `center_opening_hours` | Öffnungstage/-zeiten je Center und Wochentag (0=Mo…6=So) |
| `center_zeitraeume` | Miete / Betrieb / Verlängerung als Historie |
| `card_revenues` | Karteneinnahmen, erfasst durch Admin (1 Betrag je Center+Tag) |
| `bestell_artikel` | Artikelkatalog mit Packgrößen und Farben |
| `bestellungen` + `bestellung_positionen` | Warenbestellungen |

**Neue View:** `profiles_planung` (security_invoker) — reduzierte Sicht ohne Steuer-ID,
RV-Nummer, Geburtsdatum, Adresse, Verdienst. Wird von der Mitarbeiterliste für alle
außer Admins genutzt.

**Neue Trigger:**
- `profiles_audit_log_trigger` — schreibt jede Stammdatenänderung mit Vorher-/Nachher-Wert
- `profiles_schutz_role_aktiv_trigger` — nur Admins dürfen `role`/`aktiv` ändern
- `daily_sales_vor_insert_trigger` — setzt `erfasst_von` aus der Session, prüft Korrektur-Kette

**Kassenbericht-Formel (offene Ladenkasse):**
```
Einnahmen = Endbestand − Startbestand + Ausgaben − Einlagen
```
Die Tresor-Umlagerung (`abschoepfung_cent`, im UI „In den Tresor gelegt") passiert
NACH dem Zählen und geht deshalb nicht in die Rechnung ein.

---

## 5. GETROFFENE ENTSCHEIDUNGEN

| # | Entscheidung | Begründung | Verworfene Alternative |
|---|---|---|---|
| 1 | Center-Status wird **berechnet**, nur „In Absprache" bleibt manuell | Im Meeting fiel auf, dass Center fälschlich auf „aktiv" standen | Status weiter von Hand pflegen |
| 2 | Regionalmanager sehen **keine** Steuer-/Sozial-/Gehaltsdaten | Datensparsamkeit; für Planung nicht nötig | Volle Profilzeile (war der Zustand vor dem Review) |
| 3 | Mietzeitraum-Sperre bei der Kassenmeldung ist eine **Rückfrage**, keine Sperre | Vor Saisonstart wäre sonst jedes Center gesperrt; Aufbautage brauchen das auch | Harter Block (war zuerst gebaut, vom Tester als Fehler erlebt) |
| 4 | Mehrere Kassenmeldungen pro Tag sind **regulär**, nicht automatisch Korrektur | Zwei Schichten pro Tag sind der Normalfall | Jeder zweite Eintrag = Korrektur (alter Stand) |
| 5 | Karteneinnahmen als **eigene Tabelle**, erfasst vom Admin | Jannis kontrolliert sie ohnehin vor der Weitergabe | Feld im Mitarbeiter-Formular (war eine Woche lang so gebaut, wieder entfernt) |
| 6 | **Keine AGB** erstellt, stattdessen Nutzungsregeln | AGB regeln Kundenverträge; hier gibt es keinen Vertragsschluss über die App | AGB nach Template |
| 7 | **Kein Cookie-Banner** | Nur technisch notwendige Session-Cookies, § 25 Abs. 2 TDDDG | Banner „zur Sicherheit" |
| 8 | RV-Befreiung bleibt **Pflicht für alle** | Ausdrückliche Vorgabe des Nutzers (zweimal bestätigt) | Nur bei Minijob (mein Vorschlag, abgelehnt) |
| 9 | Schicht-Limit über Center-Grenzen: nur **Hinweis** | Ausdrückliche Vorgabe: „nur einen Hinweis hinmachen" | Harte Prüfung/Sperre |
| 10 | Backups über **GitHub Actions**, AES-256-verschlüsselt | Supabase Free hat keine; zweite Kopie ist auch mit Pro sinnvoll | Nur auf Supabase Pro vertrauen |
| 11 | Bei Vercel bleiben empfohlen — **aber Netlify als ernsthafte Option dargestellt** | Netlify Free erlaubt gewerbliche Nutzung, spart 225 €/Jahr | Sofortiger Wechsel ohne Diskussion |
| 12 | Ausweiskopien werden **gelöscht**, nicht aufbewahrt | Keine steuerliche Aufbewahrungspflicht; Datenminimierung Art. 5 DSGVO | „Alles 10 Jahre aufheben" (war meine erste, falsche Darstellung) |

---

## 6. BEREITS ERLEDIGT

### Phasen 1–6 (Meeting-Änderungsliste vom 31.08.)

| Phase | Inhalt | Commit |
|---|---|---|
| 1 | Struktur-Migration: Rollen, Center-Beziehungen, Öffnungszeiten, Zeiträume, Karteneinnahmen, Bestellwesen, Audit-Trigger | `265d035` |
| 2 | Center-Verwaltung, Regionalmanager-Rolle, Einladung mit Center-Zuordnung | `848fa14` |
| 3 | Onboarding (O-1 bis O-16): AOK-Liste, Validierungen, Pflicht-Uploads je Status | `d688a91` |
| 4 | Umsatz-Umbau: berechnete Einnahmen, Foto, Zeitfenster, Karteneinnahmen-Seite | `1567392` |
| 5 | Ware bestellen (B-1 bis B-5) + Verfügbarkeit V-1/V-2 | `10efac5` |
| 6 | PWA, Installations-Anleitung, Domain/Hosting-Empfehlung | `e8d2b55` |

### Migrationen dieser Session (alle eingespielt)

| Datei | Inhalt |
|---|---|
| `20260829120000_esska_view_security_invoker.sql` | Security-Advisor-Fund behoben |
| `20260829160000_esska_karteneinnahmen.sql` | Feld (später durch eigene Tabelle ersetzt) |
| `20260831120000_esska_struktur_enums.sql` | Enum-Werte `regionalmanager`, `in_absprache` |
| `20260831121000_esska_struktur_phase1.sql` | Große Struktur-Migration |
| `20260831122000_esska_rolle_schutz.sql` | Trigger gegen Selbst-Hochstufung |
| `20260901090000_esska_onboarding_phase3.sql` | `selbststaendig`, `eu_staatsbuergerschaft` |
| `20260902100000_esska_sales_fotos_manager.sql` | Foto-Leserecht für Manager |
| `20260902110000_esska_bestell_sortiment.sql` | Echtes Sortiment aus Jannis' Vorlage |
| `20260907100000_esska_kasse_einlagen.sql` | Einlagen-Feld |
| `20260907140000_esska_sicherheit_review.sql` | Review-Blocker behoben |

### Rechtstexte (komplett neu)

**Öffentlich** (`nextjs/public/terms/`, erreichbar unter `/legal/...`):
`impressum.md`, `datenschutz.md`, `datenschutz-beschaeftigte.md`, `nutzungsregeln.md`

**Intern** (`docs/recht/`):
`verarbeitungsverzeichnis.md` (Art. 30 inkl. TOM), `FRAGEBOGEN-Jannis.md` (23 Fragen),
`README.md` (Platzhalter-Zuordnung)

Die drei Template-Dateien (`privacy-notice.md`, `terms-of-service.md`,
`refund-policy.md`) wurden **gelöscht** — sie enthielten „SupaSasS", „Shopify store
analysis", „Paddle" und „Tax number: 1234567890".

**27 Platzhalter** in eckigen Klammern, auffindbar per:
```bash
grep -rn "\[[A-Z_]*\]" nextjs/public/terms/ docs/recht/
```

### Dokumente für Jannis

| Datei | Zweck |
|---|---|
| `docs/BRIEFING-Jannis-Launch.md` + `docs/Esska-App-Briefing.pdf` (6 Seiten) | Stand, offene Punkte, 4 Kostenvarianten |
| `docs/recht/FRAGEBOGEN-Jannis.md` | 23 Fragen, Pflichtangaben markiert — **bereits verschickt** |
| `docs/hosting-domain-empfehlung.md` | Domain/Hosting-Bewertung |
| `docs/kassenbericht-hinweise-steuerberater.md` | Textbaustein für die CSV-Übergabe |
| `docs/backup-wiederherstellen.md` | Backup-Einrichtung und Restore-Test |

### Getestet & verifiziert

| Was | Ergebnis |
|---|---|
| `npm run build` vor jedem Commit | ✅ durchgehend grün |
| E-Mail-Versand über Gmail-SMTP | ✅ nach `535`-Fehlerbehebung |
| Samstags-Erinnerung (manuell per curl ausgelöst) | ✅ `{"ok":true,"verschickt":1}` |
| Deutsche E-Mail-Vorlagen in Supabase | ✅ vom Nutzer eingefügt und geprüft |
| Supabase Security Advisor | ✅ nur noch WARN-Level |
| `euroToCent`-Korrektur | ✅ alle 11 Testfälle korrekt |
| Restore aus dem Backup | ❌ **noch nicht getestet — wichtigster offener Punkt** |
| Kassenmeldung mit echten Nutzern | ❌ noch nicht |

---

## 7. NICHT FUNKTIONIERT / SACKGASSEN

| Ansatz | Warum gescheitert | Fehlermeldung |
|---|---|---|
| Migration mit `manager_id` NACH den Helper-Funktionen | Postgres validiert SQL-Funktionskörper beim Anlegen | `ERROR: 42703: column c.manager_id does not exist` |
| HTML5-`required` auf den Kassenfeldern | Safari blockiert den Submit stumm; auf dem Handy unsichtbar | keine — genau das war das Problem |
| Erste Diagnose „Mietzeitraum-Sperre blockiert das Speichern" | Falsch. Das Test-Center läuft seit 01.09. Die echte Ursache war `required` | — |
| `euroToCent` mit `replace(/\./g, "")` | Entfernte Punkte als Tausendertrenner: `890.40` → 89.040,00 € | — (still, deshalb gefährlich) |
| Supabase-MCP in dieser Session | Verbindung riss mehrfach ab; Werkzeuge kamen zeitweise nicht an | — |
| PDF-Kopf mit `margin: -16mm` + `padding: 24px` | Text ragte über den Seitenrand, „Die" wurde abgeschnitten | — |

> **Nicht erneut versuchen:** `required` auf Feldern, die wir selbst validieren.
> Enum-Werte und ihre Verwendung in derselben Migration.

---

## 8. OFFENE PUNKTE

### Blockierend für den Live-Gang

| # | Punkt | Wer |
|---|---|---|
| 1 | **Fragebogen-Antworten** → 27 Platzhalter in den Rechtstexten füllen | Jannis (verschickt, Antwort ausstehend) |
| 2 | **Eigene Domain** kaufen und verbinden | Jannis / Bruno |
| 3 | **Tarif-Entscheidung** (4 Varianten, 290–515 €/Jahr) | Jannis |
| 4 | **Vercel-Account auf Esska** übertragen (läuft über Autolution) | Jannis / Bruno |
| 5 | **Restore-Test** aus dem Backup | Bruno |
| 6 | GitHub-Secrets `SUPABASE_DB_URL` und `BACKUP_PASSWORT` setzen | Bruno |
| 7 | Testdaten löschen vor der ersten echten Einladung | Bruno |

### Offene Entscheidungen

| # | Frage | Tendenz |
|---|---|---|
| 1 | **Netlify statt Vercel?** Spart 225 €/Jahr, Umbau ~halber Tag | Nutzer hat gefragt, **kein Go gegeben**. Ich habe angeboten vorzubereiten. Empfehlung: jetzt oder gar nicht diese Saison |
| 2 | Müssen Regionalmanager das Onboarding durchlaufen? | Hängt davon ab, ob sie angestellt sind — Frage 19 im Fragebogen |
| 3 | Anwaltliche Prüfung der Rechtstexte? | Vom Nutzer **aus dem Briefing gestrichen** |
| 4 | Ganzjährig oder saisonal? | Empfehlung Variante D (290 €): Netlify + Supabase ganzjährig |

### Bekannte Lücken (nicht blockierend)

| # | Punkt | Ort |
|---|---|---|
| 1 | **Storage-Backup fehlt** — Verkaufslisten-Fotos (10 Jahre Pflicht!) sind nicht im Datenbank-Export | `.github/workflows/backup.yml` |
| 2 | Kein Aufräumlauf für abgelaufene Ausweiskopien | — |
| 3 | Kenntnisnahme-Häkchen der Datenschutzhinweise im Onboarding fehlt | `nextjs/src/app/app/onboarding/page.tsx` |
| 4 | `karteneinnahmen_cent` in `daily_sales` ist tot (0 Datensätze betroffen) | `daily_sales` |
| 5 | Tages-CSV und Zeitraum-CSV erfassen unterschiedliche Center-Mengen | `nextjs/src/app/app/sales/page.tsx:~200` |
| 6 | `center_zeitraeume`, `center_opening_hours`, `bestell_artikel` für alle Angemeldeten lesbar | Migration `20260831121000` |
| 7 | Gmail erlaubt **keinen AVV** → Wechsel zu Resend nötig | — |
| 8 | MFA für Admins nicht aktiviert, Leaked-Password-Schutz aus | Supabase-Dashboard |
| 9 | Kaschmir-Farben, Mützen-Varianten, Lager-Mail, Logo fehlen | von Jannis |

---

## 9. NUTZER-PRÄFERENZEN & CONSTRAINTS

**Arbeitsweise:**
- Nutzt häufig **Spracheingabe** → Tippfehler in Nachrichten („Würzel"/„Wörsel" = Vercel,
  „Janusz"/„Janis" = Jannis, „Netly Fine" = Netlify, „Rechtsextremismus" = Rechtstexte-Prüfung).
  **Inhaltlich interpretieren**, bei echter Mehrdeutigkeit die Interpretation offenlegen.
- Will **Fortschritt sehen**: umsetzen + erklären statt lange Rückfragen.
- Erwartet nach jedem Push die Anleitung, was **er** tun muss.
- Keine Entwicklererfahrung → Begriffe erklären, klar zwischen *Terminal auf dem Mac*
  und *Supabase SQL-Editor im Browser* unterscheiden.

**Sprache & Format:**
- Alles auf **Deutsch** — UI, Fehlermeldungen, Commit-Messages, Doku.
- Mitarbeiter-Formulare zusätzlich **englisch** (kursiv, grau darunter).
- Commit-Messages: ausführlich mit Begründung, **ohne Umlaute** (ae/oe/ue).
- Fehlermeldungen müssen konkret sagen, **welches Feld** fehlt.

**Explizite Vorgaben aus dieser Session:**
- „beim Schichtlimit arbeitet nur einen Hinweis hinmachen" → keine Sperre
- „RV Befreiung soll bei allen auf jeden Fall bleiben"
- Anwaltliche Prüfung und Logo aus dem Briefing entfernen
- Kassendaten unveränderbar (GoBD) — gilt weiter
- Keine Agent-Tools/Workflows ohne Aufforderung
- Keine PRs ohne ausdrückliche Aufforderung
- Kein Tracking/Analytics

---

## 10. FOKUS BEIM ABBRUCH

**Zuletzt gearbeitet an:** `docs/BRIEFING-Jannis-Launch.md` und dem daraus erzeugten
PDF `docs/Esska-App-Briefing.pdf` (6 Seiten).

**Unterbrochen bei:** Nichts Halbfertiges. Commit `331a63b` ist gepusht, Arbeitsbaum
sauber, Build grün.

**Gedanklicher Stand:** Die letzte inhaltliche Frage des Nutzers war, ob man statt
Vercel auch **Netlify** nehmen könnte (kostenlos, gewerbliche Nutzung erlaubt). Ich
habe das bejaht, in Variante D ins Briefing aufgenommen (290 €/Jahr) und angeboten,
den Umzug vorzubereiten — Konfiguration und umgebauter Erinnerungs-Job, ohne am
laufenden System etwas zu ändern. **Auf dieses Angebot steht die Antwort noch aus.**

Ebenfalls in dieser letzten Runde korrigiert: Ausweiskopien dürfen **nicht** dauerhaft
aufbewahrt werden (keine Aufbewahrungspflicht, Datenminimierung) — nur die
Verkaufslisten-Fotos müssen 10 Jahre bleiben. Diese Korrektur ist in
`datenschutz-beschaeftigte.md`, `verarbeitungsverzeichnis.md` und
`backup-wiederherstellen.md` eingearbeitet.

---

## 11. NÄCHSTE SCHRITTE (PRIORISIERT)

1. **Auf Jannis' Fragebogen-Antwort warten.** Sobald da: die 27 Platzhalter in
   `nextjs/public/terms/*.md` und `docs/recht/verarbeitungsverzeichnis.md` ersetzen
   (Zuordnung Frage→Platzhalter steht in `docs/recht/README.md`).
2. **Netlify-Umzug** — falls der Nutzer Go gibt. Konkret: `netlify.toml` anlegen,
   `@netlify/plugin-nextjs` einbinden, den Cron aus `nextjs/vercel.json`
   (`0 9 * * 6` auf `/api/cron/availability-reminder`) als Netlify Scheduled Function
   nachbauen, Umgebungsvariablen übertragen, testen.
3. **Storage-Backup ergänzen** in `.github/workflows/backup.yml`: Bucket
   `sales-receipts` wöchentlich exportieren (steuerlich aufbewahrungspflichtig).
   Bucket `employee-documents` braucht kein Langzeitarchiv.
4. **GitHub-Secrets setzen** (`SUPABASE_DB_URL`, `BACKUP_PASSWORT`) und den
   **Restore-Test** nach `docs/backup-wiederherstellen.md` durchführen.
5. **Kenntnisnahme-Häkchen** für die Datenschutzhinweise im Onboarding einbauen
   (`nextjs/src/app/app/onboarding/page.tsx`, beim Abschluss-Schritt).
6. **Resend statt Gmail** einrichten, sobald die Domain steht — löst zugleich das
   fehlende AVV-Problem. Code ist vorbereitet: `nextjs/src/lib/esska/mail.ts` spricht
   generisches SMTP, nur `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` ändern.
7. **In Supabase:** MFA für Admin-Konten, Leaked-Password-Schutz an,
   Subprocessor-Benachrichtigungen abonnieren, Sicherheits-Mailadresse prüfen.
8. **Testdaten löschen**, dann erste echte Gruppe (Leipzig oder Hamburg) einladen.

---

## 12. EMPFOHLENE SKILLS / TOOLS FÜR DIE NÄCHSTE SESSION

- **Supabase-MCP** — hat sich bewährt, Migrationen direkt einspielen und Logs/Advisors
  abfragen. Achtung: Verbindung riss in dieser Session mehrfach ab, dann auf den
  `pbcopy`-Weg ausweichen.
- **`code-review` Skill** — hat 13 echte Funde geliefert, darunter den
  `euroToCent`-Bug. Vor dem Live-Gang nochmal laufen lassen.
- Für PDFs: headless Chromium (Pfad siehe Abschnitt 3), **kein** pandoc/weasyprint.
- Kein weiterer Skill zwingend nötig.

---

## 13. DATEIEN DIE ZUERST GELESEN WERDEN SOLLTEN

| Priorität | Pfad | Warum |
|---|---|---|
| 1 | `docs/handoff/HANDOFF.md` | Session 1: Projektgrundlagen, CI, Template-Entscheidungen |
| 2 | `docs/BRIEFING-Jannis-Launch.md` | Aktueller Stand in nicht-technischer Sprache, Kostenvarianten |
| 3 | `docs/recht/README.md` | Welche Rechtstexte es gibt, welcher Platzhalter woher kommt |
| 4 | `nextjs/src/lib/esska/types.ts` | Alle Domain-Typen, Geld-Helfer (`parseEuro`!), Status-Berechnung |
| 5 | `supabase/migrations/20260831121000_esska_struktur_phase1.sql` | Das neue Datenmodell samt RLS |
| 6 | `supabase/migrations/20260907140000_esska_sicherheit_review.sql` | Die Sicherheits-Härtung |
| 7 | `nextjs/src/app/app/sales/new/page.tsx` | Kassenformular — die komplexeste Seite |
| 8 | `docs/backup-wiederherstellen.md` | Backup-Konzept und die Aufbewahrungsregeln |


---
---

# ═══ ÄLTERER EINTRAG (Session 1) ═══

# HANDOFF — Esska-App (Saison-App für Esska Collection)

**Erstellt:** 2026-08-06 (Session-Ende)
**Session-Nr.:** 1 (durchgehende Konversation über mehrere Kalendertage, 12.06.–06.08.2026)
**Auslöser:** manuell angefordert, Kontextlänge sehr hoch

---

## 1. KURZFASSUNG (30 Sekunden)

Die Esska-App ist eine interne Web-App (Next.js + Supabase) für **Esska Collection**, ein saisonales Einzelunternehmen aus Dresden, das Winterartikel (Kaschmir, Schals, Mützen) über Pop-up-Stände in deutschen Einkaufszentren verkauft. Sie ersetzt die bisherige Steuerung über Papier, Fotos und WhatsApp: Personalstammdaten, Center-Verwaltung, Verfügbarkeit/Schichtplanung und Kassenmeldung laufen jetzt über eine gemeinsame Datenbasis mit Rollentrennung (Admin = Inhaber Jannis, Mitarbeiter = Saisonpersonal).

**Stand jetzt:** Alle vier geplanten Etappen sind funktional umgesetzt und live auf Vercel (`esska-app.vercel.app`). In der letzten Session wurden das Kassen-Modul auf reine Bargeld-Erfassung umgestellt, GoBD-konforme Unveränderbarkeit eingebaut und die öffentliche Startseite von Template-Marketing auf eine mitarbeiterfreundliche Anmeldeseite umgebaut.

**Unmittelbar nächster Schritt:** Migration `20260806100000_esska_kasse_unveraenderbar.sql` im Supabase SQL-Editor einspielen (siehe Abschnitt 8, blockierend). Erst danach funktioniert das neue Kassenformular.

---

## 2. PROJEKT-KONTEXT

**Übergeordnetes Ziel:**
Eine All-in-One-App, die alle bisher manuellen, fragmentierten Saisonprozesse bündelt. Zwei Nutzungsseiten auf einer Datenbasis: Mitarbeiter mobil auf dem Smartphone, Inhaber als Admin (gleiche App, andere Ansicht je nach Rolle). Security und DSGVO-Konformität sind laut Briefing nicht optional, sondern von Anfang an in der Architektur verankert.

**Session-Ziel:**
Von null (leeres Repo mit README) bis zur testbaren, live deployten App. Wurde erreicht und deutlich überschritten — inkl. mehrerer Iterationen nach Feedback des Inhabers.

**Auftraggeber / Stakeholder:**

| Person | Rolle | Kontakt / Account |
|---|---|---|
| **Bruno Hofmann** | Praktikant, baut die App, Ansprechpartner in dieser Konversation | `bruann1008@gmail.com` (privat/Test), `info@autolution.ai` (Admin-Account in der App) |
| **Jannis Alekhanov** | Inhaber Esska Collection, Auftraggeber, betrieblicher Betreuer | wird Admin der Produktiv-App |
| Chris Taumann | Test-Mitarbeiter-Account | `taumannchris@gmail.com` |

**Betriebliche Rahmendaten:**
- Firmensitz: Dornblüthstraße 22, 01277 Dresden
- Saison: ca. Ende Oktober bis Anfang Januar
- Saison 26/27: 10 Center in Leipzig, Hamburg (3×), Kiel, Magdeburg, Schwerin, Norderstedt, Bremen, Wolfsburg
- Personal: saisonal wechselnd, geschätzt 10–30 Personen

---

## 3. TOOL-STACK & UMGEBUNG

| Kategorie | Konkret | Begründung |
|---|---|---|
| Framework | Next.js 15.5.7 (App Router), React 19, TypeScript | Aus dem gewählten Starter-Template; eine Codebasis für Mobil + Desktop |
| Styling | Tailwind CSS, shadcn/ui, Radix UI, lucide-react (Icons) | Template-Vorgabe, gut anpassbar |
| Datenbank / Auth / Storage | Supabase (Postgres), Region **AWS EU Central (Frankfurt)** | DSGVO: EU-Hosting; RLS erlaubt serverseitig erzwungene Rollentrennung; Auth+Storage+DB aus einer Hand |
| Supabase Projekt-ID | `tbkuqvnjywgjqcgzryww` → `https://tbkuqvnjywgjqcgzryww.supabase.co` | — |
| Hosting | Vercel, Projekt `esska-app`, Live-URL `https://esska-app.vercel.app` | Auto-Deploy bei Push auf `main` |
| PDF-Erzeugung | `pdf-lib` ^1.17.1, clientseitig | Keine Datenübertragung an Dritte |
| Diagramme | `recharts` ^2.15.0 | **Aktuell ungenutzt** — war im alten Umsatz-Dashboard, wurde entfernt |
| Package Manager | **npm** (nicht yarn) | `yarn.lock` wurde bewusst gelöscht, Vercel warnte vor gemischten Lock-Files |
| Repo | `github.com/Autolution-ai/Esska-App`, Branch **`main`** | Der Branch `claude/kind-galileo-z76p7q` ist ein toter Überrest vom Sessionstart — **nicht verwenden** |
| Basis-Template | [Razikus/supabase-nextjs-template](https://github.com/Razikus/supabase-nextjs-template) | Siehe Entscheidung #2 |

**Wichtige Befehle die funktionieren:**

```bash
# Lokal (Mac des Nutzers, Projekt liegt in ~/Esska-App)
cd ~/Esska-App && git pull
cd ~/Esska-App/nextjs && npm install && npm run dev   # localhost:3000

# Build-Prüfung (wird vor jedem Commit gemacht)
cd nextjs && npm run build

# Migration in die Zwischenablage holen (Mac) — danach in Supabase SQL Editor einfügen
cat ~/Esska-App/supabase/migrations/<DATEINAME>.sql | pbcopy
```

**Umgebungsvariablen (Namen, keine Werte) — in `nextjs/.env.local` lokal, in Vercel als Environment Variables:**

| Variable | Wofür |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tbkuqvnjywgjqcgzryww.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Öffentlicher Client-Key, [REDACTED] |
| `PRIVATE_SUPABASE_SERVICE_KEY` | Service-Role-Key, **nur serverseitig**, [REDACTED] |
| `NEXT_PUBLIC_PRODUCTNAME` | Wert: `Esska` |
| `NEXT_PUBLIC_THEME` | Wert: `theme-sass` (überschrieben mit Esska-Farben) |
| `NEXT_PUBLIC_SSO_PROVIDERS` | **Bewusst nicht gesetzt** — Vercel akzeptiert keine leeren Werte, Variable einfach weglassen |

**Vercel-Einstellungen (waren Fehlerquelle, siehe Abschnitt 7):**
- **Root Directory: `nextjs`** (nicht Repo-Root!)
- **Framework Preset: Next.js**
- Node 24.x

**Supabase Auth → URL Configuration:**
- Site URL: `https://esska-app.vercel.app`
- Redirect URLs müssen enthalten: `https://esska-app.vercel.app/**` und `http://localhost:3000/**`

**MCP-Server:** In der Session waren viele verbunden (github, Vercel, Supabase-nahe Tools, Miro, Canva u.a.), aber **keiner wurde produktiv genutzt** — alles lief über Bash/git und manuelle Schritte des Nutzers im Supabase-Dashboard.

**Zusätzliches Werkzeug (nicht Teil des Projekts):**
`/home/user/tools/ecc` — Klon von [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code), bewusst **außerhalb** des Projekt-Repos abgelegt, da es Claude-Code-Konfiguration ist und kein App-Code. Wurde bisher nicht aktiv eingesetzt.

---

## 4. KONZEPTION / ARCHITEKTUR

```
┌──────────────────────────────────────────────┐
│  Browser (Handy Mitarbeiter / Desktop Admin) │
└───────────────────┬──────────────────────────┘
                    │ HTTPS
                    ▼
┌──────────────────────────────────────────────┐
│  Vercel — Next.js App Router                 │
│  • /            öffentliche Startseite       │
│  • /auth/*      Login, Einladung annehmen    │
│  • /app/*       geschützt (Middleware)       │
│  • /api/*       Server-Routen (Service-Key)  │
└───────────────────┬──────────────────────────┘
                    │ supabase-js
                    ▼
┌──────────────────────────────────────────────┐
│  Supabase (Frankfurt)                        │
│  • Postgres mit RLS auf JEDER Tabelle        │
│  • Auth (E-Mail/Passwort, MFA möglich)       │
│  • Storage: employee-documents, sales-receipts│
└──────────────────────────────────────────────┘
```

**Rollenmodell:** Zwei Rollen in `profiles.role`: `admin` | `mitarbeiter`. Die Rollentrennung wird **in der Datenbank** über RLS-Policies erzwungen, nicht nur im UI. Helper-Funktion `public.is_admin()` (SECURITY DEFINER, verhindert Rekursion auf `profiles`).

**Middleware-Gates** (`nextjs/src/lib/supabase/middleware.ts`):
1. Nicht angemeldet + Pfad `/app/*` → Redirect `/auth/login`
2. Rolle `mitarbeiter` + `onboarding_abgeschlossen = false` + Pfad `/app/*` (außer `/app/onboarding`) → Redirect `/app/onboarding`

**Datenbank-Tabellen (12):**

| Tabelle | Zweck | Besonderheit |
|---|---|---|
| `profiles` | Personalstammdaten, 1:1 zu `auth.users` | Trigger legt Profil bei Registrierung automatisch an |
| `profile_kinder` | Kinder (1:n) | |
| `profile_change_log` | Audit-Log Stammdatenänderungen | append-only, kein UPDATE/DELETE |
| `centers` | Standorte je Saison | UNIQUE (saison, kuerzel); Trigger berechnet `flaeche_qm` + `mietdauer_tage` automatisch |
| `center_assignments` | Mitarbeiter ↔ Center | |
| `availabilities` | Wunsch pro Tag **und Slot** | Enum `esska_wunsch`: kann_nicht / koennte / **wuensche** (= im UI "Abweichung"!) |
| `shift_weeks` | Wochenplan-Container je Center | `veroeffentlicht` steuert Sichtbarkeit für Mitarbeiter |
| `shifts` | Einzelschichten | UNIQUE (center_id, datum, slot) |
| `daily_sales` | Kassenbericht je Center/Tag | **append-only, siehe Entscheidung #8** |
| `kube_declarations` | KuBe-Statuserklärung | 1 pro Profil und Saison |
| `pension_exemptions` | RV-Befreiungsantrag | |
| `employee_documents` | Ausweis + Nachweise (Metadaten) | Dateien liegen im Storage |

**Storage-Buckets (beide privat, Zugriff nur über Signed URLs):**
- `employee-documents` — Pfad `{user_id}/{dokument_typ}/{timestamp}.{ext}`
- `sales-receipts` — Pfad `{center_id}/{datum}/{timestamp}.{ext}` — **aktuell ungenutzt**, Foto-Upload wurde aus dem Kassenformular entfernt

**Geldbeträge:** grundsätzlich als `BIGINT` in **Cent**, nie als Float. Helper `euroToCent()` / `centToEuro()` in `nextjs/src/lib/esska/types.ts`.

**Slot-Logik Schichtplan:** Zwei feste Slots pro Tag, Standardzeiten in `SLOT_DEFAULT_ZEITEN`:
- `vormittag` 09:00–15:00
- `nachmittag` 15:00–20:30
Zeiten sind je Schicht inline überschreibbar.

---

## 5. GETROFFENE ENTSCHEIDUNGEN

| # | Entscheidung | Begründung | Verworfene Alternative |
|---|---|---|---|
| 1 | **Web-App / PWA** statt nativer App | Eine Codebasis, kein App-Store-Prozess, saisonales Personal öffnet einfach einen Link | Native App über Expo (Template enthält `supabase-expo-template/`, bislang ungenutzt) |
| 2 | Basis: **Razikus-Template** | Auth + RLS + User-Management fertig, kein SaaS-Ballast, MIT-Lizenz | Makerkit Lite (SaaS/Multi-Tenancy-Overkill, Pro kostenpflichtig); offizielles Supabase-Template (zu minimal, kein User-Management) |
| 3 | **ECC-Repo separat** unter `/home/user/tools/ecc` | Ist Claude-Code-Werkzeug, kein App-Code — würde das Projekt-Repo aufblähen | Ins Projekt-Repo legen (vom Nutzer ursprünglich als Link committet) |
| 4 | **Geld als Cent-Integer** | Rundungsfehler bei Float-Summen vermeiden | numeric/float |
| 5 | **RLS statt UI-Prüfung** | UI-Buttons ausblenden ist keine Sicherheit; Datenbank verweigert Anfragen serverseitig | Nur Prüfung im Frontend |
| 6 | **Beschäftigungsart (Vollzeit/Teilzeit/Minijob/Kurzfristig) pflegt der Admin**, nicht der Mitarbeiter | Mitarbeiter kennt seinen sozialversicherungsrechtlichen Status oft nicht korrekt; steuert aber, welche Formulare Pflicht sind | Mitarbeiter wählt selbst im Onboarding (war ursprünglich so gebaut) |
| 7 | **RV-Befreiung ist Pflicht für alle**, nicht nur Minijobber | Explizite Anweisung: „Wir machen's bei allen, auch wenn's nicht zur Anwendung kommt. Wir brauchen das Dokument, falls wir es brauchen." | Nur bei `arbeitszeit_modell = minijob` einblenden (war meine Empfehlung) |
| 8 | **Kassendaten unveränderbar (GoBD)** — append-only Journal mit Storno-Prinzip | Steuerlich relevante Daten dürfen nachträglich nicht still verändert werden. Korrektur = neuer Datensatz mit Pflicht-Begründung, alter bleibt erhalten | (a) nur UI-Warnung ohne technische Sperre → untauglich; (c) zusätzlich Hash-Kette/WORM-Storage → für Betriebsgröße überdimensioniert, aber nachrüstbar |
| 9 | **Mitarbeiter erfassen keine Umsatzbeträge** | Wörtlich: „Jannis vertraut da nicht auf die Mitarbeiter, dass diese das richtig eintragen." Zuerst nur Foto der Verkaufsliste, dann komplett auf Bargeld-Kassenzählung umgestellt | Betrag + Belege durch Mitarbeiter erfassen (war Etappe-3-Stand) |
| 10 | **Selbstregistrierung deaktiviert** | Interne App mit Personal- und Kassendaten — ein offenes Formular hätte jedem mit der URL ein Konto ermöglicht | Offene Registrierung (Template-Standard) |
| 11 | **Rolle `lead` (Stand-Leitung) weggelassen** | Einfacher Start, später ergänzbar | Dritte Rolle mit eingeschränkten Admin-Rechten |
| 12 | Kontingent-Prüfung bei Schichtplanung als **Soft-Warnung**, kein harter Block | Explizit gewünscht: „praktisch auch einem Minijobber mehr Stunden zuteilen, aber es gibt einen Hinweis" | Hartes Blockieren bei Limit-Überschreitung |
| 13 | **Datum nie in der Zukunft** wählbar (Kassenmeldung) | `max={isoDatum(new Date())}` am Date-Input | — |

---

## 6. BEREITS ERLEDIGT

### Migrations (Reihenfolge = Dateiname-Sortierung, alle in `supabase/migrations/`)

| Datei | Inhalt | Eingespielt? |
|---|---|---|
| `2025…_MFA.sql`, `…example_storage`, `…storage_policies`, `…todo_list` | aus dem Template | ✅ (Template-Basis) |
| `20260612160000_esska_core_schema.sql` | profiles (alle Stammdatenfelder), profile_kinder, profile_change_log, centers, center_assignments, Enums, Trigger, `is_admin()`, RLS | ✅ |
| `20260612170000_esska_onboarding_schema.sql` | kube_declarations, pension_exemptions, employee_documents, Bucket `employee-documents` + Policies | ✅ |
| `20260612210000_esska_shifts_schema.sql` | Schichtplan v1 — **durch v2 ersetzt**, nicht mehr relevant | ✅ (aber überschrieben) |
| `20260612230000_esska_sales_schema.sql` | daily_sales | ✅ |
| `20260614160000_esska_shifts_v2_schema.sql` | **droppt** shifts + availabilities und legt sie mit Slot-Logik neu an; `profiles.max_schichten_pro_woche`; View `shifts_per_employee_week` | ✅ |
| `20260616160000_esska_onboarding_refactor_sales_fotos.sql` | `profiles.aktueller_status`, daily_sales Arbeitszeit/Foto, Bucket `sales-receipts` | ✅ |
| `20260617150000_esska_abweichung_umsatzzeit.sql` | `availabilities.abweichung_bis/_ab`, `daily_sales.umsatz_start/_ende` | ✅ |
| `20260805200000_esska_bargeld_bestand.sql` | startbestand_cent, ausgaben_cent, endbestand_cent | ⚠️ **unklar — bitte prüfen** |
| `20260806100000_esska_kasse_unveraenderbar.sql` | einnahmen_cent, abschoepfung_cent, korrigiert_eintrag_id, korrektur_grund, UNIQUE-Constraint entfernt, Trigger gegen UPDATE/DELETE, RLS-Policies entfernt | ❌ **NOCH NICHT eingespielt** |

**Seed:** `docs/seeds/centers-2627.sql` — 10 Center für Saison 26/27, idempotent per `ON CONFLICT (saison, kuerzel)`. Miete überall auf `0` als Platzhalter. Status unklar ob eingespielt.

### App-Seiten

| Pfad | Rolle | Funktion |
|---|---|---|
| `/` | öffentlich | Startseite: Anmelden-Button + Einladungs-Hinweis + 3 Orientierungs-Kacheln |
| `/auth/login` | öffentlich | deutsch, ohne Registrieren-Link |
| `/auth/register` | öffentlich | **gesperrt** — erklärt Einladungs-Weg |
| `/auth/accept-invite` | öffentlich | liest Token aus URL-Fragment, setzt Session, Passwort setzen → `/app/onboarding` |
| `/app` | beide | Dashboard mit rollenabhängigen Kacheln |
| `/app/onboarding` | Mitarbeiter | 3–4 Schritte: Stammdaten → RV-Befreiung → ggf. KuBe → Ausweis/Nachweise |
| `/app/availability` | Mitarbeiter | Wochenplan Tag × Slot mit Könnte/Abweichung/Kann nicht, Feiertage markiert |
| `/app/my-shifts` | Mitarbeiter | nur veröffentlichte Schichten |
| `/app/my-centers` | Mitarbeiter | **existiert noch, aber aus dem Menü entfernt** |
| `/app/sales/new` | beide | Kassenmeldung (Center, Datum, Bargeld ×5, Notiz) |
| `/app/sales` | Admin | Tagesübersicht aller Center, offen/erfasst, Korrekturhistorie, CSV |
| `/app/centers`, `/new`, `/[id]`, `/[id]/edit` | Admin | Center-CRUD inkl. Löschen |
| `/app/employees`, `/invite`, `/[id]` | Admin | Liste, Einladen, Detail mit Stammdaten-Edit, Erneut einladen, Löschen, Center-Zuordnung, PDF-Downloads |
| `/app/shifts`, `/[centerId]/[woche]` | Admin | Wochenplan-Editor im Layout des Esska-Sheets, Veröffentlichen |
| `/app/user-settings` | beide | Stammdaten, Passwort, MFA |

### API-Routen (alle mit `requireAdmin()` aus `nextjs/src/lib/esska/server.ts`)
- `POST /api/employees/invite` — Einladung per `inviteUserByEmail`, Redirect auf `/auth/accept-invite`
- `POST /api/employees/[id]/reinvite` — frischer Link per `generateLink({type:'invite'})`
- `DELETE /api/employees/[id]` — löscht Auth-User (Cascade räumt alles ab); Schutz gegen Selbstlöschung
- `GET /api/auth/callback` — Template-Route für Code-Exchange

### Eigene Bibliothek (`nextjs/src/lib/esska/`)
| Datei | Inhalt |
|---|---|
| `types.ts` | Alle Domain-Typen, Enums, Label-Maps, Geld- und Datums-Helper |
| `errors.ts` | `friendlyError()` — übersetzt Postgres-Fehlercodes (23505, 23503, 23514, 23502, 42501, PGRST…) in verständliche deutsche Sätze, constraint-spezifisch |
| `client.ts` | `getEsskaClient()` — untypisierter Supabase-Client, weil die generierten `Database`-Typen die Esska-Tabellen nicht kennen |
| `server.ts` | `requireAdmin()`, `origin()` für API-Routen |
| `pdf.ts` | `generiereStammdatenPdf()`, `generiereKubePdf()`, `pdfHerunterladen()` — pdf-lib, clientseitig |
| `feiertage.ts` | Bundesweite Feiertage inkl. beweglicher per Gaußscher Osterformel |

### CI / Design
Esska-Farben aus dem Preisschild abgeleitet, in `nextjs/src/app/globals.css` unter `.theme-sass` überschrieben:
- Primary (Weinrot): `#9e2a2b`, Verlauf 50–900
- Secondary (Beige/Creme): `#f7ebd3` / `#fbf7ec`
- Body-Hintergrund: `#fbf7ec`

### Dokumentation
| Datei | Inhalt |
|---|---|
| `README.md` | Projekt-Briefing (vom Nutzer erstellt, von mir zweimal präzisiert) |
| `PLAN.md` | Umsetzungsplan, Etappen 0–3 als abgeschlossen markiert |
| `docs/etappe-1-feinplanung.md` | Felddefinitionen aus den Esska-Originalformularen |
| `docs/Datensicherheit-fuer-Jannis.pdf` | Nicht-technische Erklärung für den Inhaber |
| `docs/seeds/centers-2627.sql` | Center-Seed |

### Getestet & verifiziert

| Was | Wie | Ergebnis |
|---|---|---|
| Build | `npm run build` vor jedem Commit | ✅ durchgehend grün |
| Lokaler Start + Login | Nutzer im Browser | ✅ |
| Vercel-Deployment | Live-URL aufgerufen | ✅ nach Framework-Preset-Fix |
| Center anlegen | Nutzer | ✅ |
| Ausweis-Foto hochladen | Nutzer am Handy | ✅ (nach Einspielen der Bucket-Migration) |
| Onboarding abschließen | Nutzer | ✅ nach Bugfix (siehe Abschnitt 7) |
| Doppeltes Kürzel → Fehlermeldung | Nutzer | ✅ zeigt jetzt Klartext |
| Kassenmeldung mit Bargeld-Feldern | — | ❌ **noch nicht getestet** (Migration fehlt) |
| Neue Startseite | — | ❌ **noch nicht gesichtet** |

---

## 7. NICHT FUNKTIONIERT / SACKGASSEN

> Diese Ansätze **nicht erneut versuchen**.

| Ansatz | Warum gescheitert | Fehlermeldung (Wortlaut) |
|---|---|---|
| PDF-Dateien per `@"/root/.claude/uploads/…"`-Pfad übergeben | Kommt nur als Hinweis „PDF file read: …" an, Inhalt ist nicht lesbar. **Passierte 4×** (Personalstammdatenblatt, KuBe-Formular, Änderungsliste 17.06.) | — |
| Sprachnachrichten transkribieren | Keine Audio-Verarbeitung verfügbar | — |
| `auth.users` per SQL-INSERT anlegen | Supabase-Auth erwartet interne Felder, die manuell nicht korrekt gesetzt werden | `Database error querying schema` beim Login |
| Vercel-Deploy mit Framework Preset „Other" | Production-Deployment behielt den alten Preset trotz korrigierter Project Settings | `404: NOT_FOUND / Code: NOT_FOUND / ID: fra1::…` auf **allen** URLs |
| `router.push('/app')` nach Onboarding-Abschluss | GlobalContext + Middleware hatten noch den alten DB-Wert → Endlosschleife zurück ins Onboarding | — |
| Terminal-Befehle im Supabase SQL-Editor ausführen | Passierte 3× (`cd ~/Esska-App`, `cat … \| pbcopy`) | `ERROR: 42601: syntax error at or near "cd"` |
| `git pull` mit lokal geänderten Lock-Files | npm install hatte `yarn.lock` verändert und `package-lock.json` erzeugt | `error: Your local changes to the following files would be overwritten by merge: nextjs/yarn.lock` → Fix: `git checkout -- nextjs/yarn.lock && rm nextjs/package-lock.json` |
| Einladungs-Redirect auf `/auth/login` bzw. `/api/auth/callback` | Der Invite-Token kommt als **URL-Fragment** (`#access_token=…`), das serverseitig nicht lesbar ist | Nutzer landete auf Login ohne Session → `Invalid login credentials` |

**Bekannte Umgebungs-Eigenheiten:**
- Der Container wird zwischen Sessions neu aufgesetzt: `nextjs/node_modules` fehlt dann, `npm install` nötig. Beim Neustart ist außerdem der Branch `claude/kind-galileo-z76p7q` ausgecheckt → **immer zuerst `git checkout main`**.
- Supabase Free-Tier: **Mail-Limit ca. 2/Stunde** — blockierte mehrfach das Testen des Einladungs-Flows.

---

## 8. OFFENE PUNKTE

### Blockierend

| # | Punkt | Wer/Was wird gebraucht |
|---|---|---|
| 1 | **Migration `20260806100000_esska_kasse_unveraenderbar.sql` einspielen** | Nutzer, Supabase SQL-Editor. Ohne sie schlägt jedes Speichern im Kassenformular fehl (Spalten `einnahmen_cent`, `abschoepfung_cent`, `korrigiert_eintrag_id`, `korrektur_grund` fehlen) |
| 2 | Prüfen, ob `20260805200000_esska_bargeld_bestand.sql` eingespielt wurde | Falls nein, zuerst diese, dann #1 |

### Offene Entscheidungen

| # | Frage | Optionen | Aktuelle Tendenz |
|---|---|---|---|
| 1 | Bedeutung der Center-**Kategorie A/B/C** | Größe? Umsatzpotenzial? Vertragsart? | Jannis fragen. Feld bleibt vorerst als Enum A/B/C bestehen (Anweisung: „Lasse es drinne") |
| 2 | „**Starttermine**" im Verfügbarkeits-Modul | Saisonstart-Sperre? Vertraglicher Eintritt pro Mitarbeiter? | Spezifikation fehlt, wurde im PDF vom 17.06. nur als Randnotiz erwähnt |
| 3 | Korrektur-**Zeitfenster** für Kassendaten | Aktuell: sofort final. Alternative: 15 Min frei korrigierbar, danach Storno | Nach Praxistest entscheiden |
| 4 | **PWA einrichten** (Icon, Manifest, „Zum Home-Bildschirm") | ~1–2 Std Aufwand | Empfohlen, Nutzer wollte es wissen für das Gespräch mit Jannis. **Noch nicht gemacht.** |
| 5 | Foto der Verkaufsliste doch wieder einblenden? | DB-Spalten + Bucket existieren noch | Nach Praxistest. Wiederherstellung ohne Migration möglich |

### Bekannte offene Baustellen (nicht kritisch)

| # | Punkt | Fundstelle |
|---|---|---|
| 1 | `/app/my-centers` existiert noch, ist aber aus der Navigation entfernt | `nextjs/src/app/app/my-centers/page.tsx` |
| 2 | Vorlage-Platzhalter „Beispielbild folgt" — obsolet, da Foto-Upload entfernt | war in `sales/new`, jetzt raus |
| 3 | `recharts` als Dependency ungenutzt | `nextjs/package.json` |
| 4 | Lohnabgleich Schritt 2+3 (Mitarbeiter-Stundeneingabe, Plan-vs-Ist) | in `PLAN.md` als spätere Etappe vermerkt |
| 5 | `npm audit`: 13 Vulnerabilities (7 moderate, 6 high) in Build-Abhängigkeiten | vor Live-Gang prüfen, nicht überstürzt fixen |
| 6 | E-Mail-Templates in Supabase sind englisch | Authentication → Email Templates |

### Rechtliche To-dos vor dem echten Live-Gang (aus der Datenschutz-Analyse)

| # | Punkt | Aufwand |
|---|---|---|
| 1 | **Datenschutzerklärung für Beschäftigte** (Art. 13 DSGVO) — Rechtsgrundlage ist § 26 BDSG (Beschäftigungsverhältnis), **keine Einwilligung nötig**, aber nachweisbare Kenntnisnahme | Entwurf schreiben + prüfen lassen |
| 2 | **AVV/DPA mit Supabase und Vercel** abschließen | je ~10 Min Klickarbeit |
| 3 | **Verarbeitungsverzeichnis** (Art. 30 DSGVO) | 1–2 Seiten |
| 4 | **Löschregeln** festlegen (Entscheidung von Jannis) | — |
| 5 | Kenntnisnahme-Häkchen im Onboarding + `/legal/privacy` mit echtem Text füllen | Code, ~1 Std |
| 6 | **MFA für Admin-Account aktivieren**, Leaked-Password-Protection in Supabase einschalten | je 5 Min |
| 7 | **Getrennte Prod-Datenbank** + Supabase Pro (~23 €/Monat, wegen Backups) | ~1 Std |
| 8 | **Account-Übergabe an Esska** (Supabase, Vercel, Domain laufen aktuell auf Bruno privat) | vor Saisonstart |
| 9 | Eigener SMTP-Anbieter (Resend, 3.000 Mails/Monat gratis) gegen das Rate-Limit | ~30 Min |

---

## 9. NUTZER-PRÄFERENZEN & CONSTRAINTS

**Arbeitsweise:**
- Bruno hat **keine Entwicklererfahrung**. Begriffe erklären, nicht voraussetzen. Bei jedem Schritt klar sagen: *Terminal auf dem Mac* vs. *Supabase SQL-Editor im Browser* — diese Verwechslung passierte mehrfach.
- Arbeitet schnell und iterativ, will Fortschritt sehen. Bevorzugt: umsetzen + erklären, statt lange Rückfragen. Bei mehreren offenen Punkten: sinnvolle Defaults wählen, Entscheidung dokumentieren, weitermachen.
- Wörtlich: „wenn noch was brauchst, iwelche Infos, gib bescheid"
- Nach jedem Push erwartet er die Anleitung, was **er** tun muss (git pull, Migration einspielen, testen).

**Sprache & Format:**
- Alles auf **Deutsch** — UI, Fehlermeldungen, Commit-Messages, Doku.
- Mitarbeiter-Formulare zusätzlich mit **englischer Übersetzung** (kursiv unter dem deutschen Text) — explizit gewünscht wegen internationalem Saisonpersonal.
- Commit-Messages: ausführlich, mit Begründung, ohne Umlaute (ae/oe/ue).
- Fehlermeldungen müssen **konkret sagen was schiefging** — explizite Anweisung: „wenn etwas nicht funktioniert, dann soll angezeigt werden wo das Problem ist".

**Explizite Verbote / Einschränkungen:**
- **Keine Agent-Tools / Workflows** verwenden, außer explizit angefordert (System-Vorgabe).
- **Keine PRs erstellen** ohne ausdrückliche Aufforderung.
- Kein Tracking, keine Analytics (Vercel Analytics + Google Analytics wurden bewusst entfernt — Datensparsamkeit).
- Keine Selbstregistrierung.

**Kommunikationsstil des Nutzers:** Diktiert oft per Spracheingabe → Nachrichten enthalten Tippfehler, abgebrochene Sätze, „Dennis"/"Janusz" statt „Jannis". Inhaltlich interpretieren, bei echter Mehrdeutigkeit nachfragen statt raten.

---

## 10. FOKUS BEIM ABBRUCH

**Zuletzt gearbeitet an:** Öffentliche Startseite und Auth-Seiten — `nextjs/src/app/page.tsx`, `nextjs/src/components/AuthAwareButtons.tsx`, `nextjs/src/app/auth/login/page.tsx`, `nextjs/src/app/auth/register/page.tsx`.

**Unterbrochen bei:** Nichts Halbfertiges. Commit `323a4b5` ist gepusht, Build grün, Vercel baut. Der Nutzer hat die neue Startseite **noch nicht im Browser gesehen**.

**Gedanklicher Stand:** Die App ist funktional vollständig für den geplanten Testlauf. Der Anlass für die Startseiten-Überarbeitung war ein Screenshot mit den englischen Template-Buttons („Get Started", „Start Building Free"). Beim Umbau fiel auf, dass diese Buttons zu einem **offenen Registrierungsformular** führten — das wurde als Sicherheitsproblem mitbehoben.

Direkt davor (gleiche Sitzung) kam Feedback vom Ansprechpartner: zwei neue Kassenfelder (Einnahmen, Abschöpfung) plus die Anforderung, dass Einträge fürs Finanzamt unveränderbar sein müssen. Beides ist im Code umgesetzt, **die zugehörige Migration ist aber noch nicht in der Datenbank**.

---

## 11. NÄCHSTE SCHRITTE (PRIORISIERT)

1. **Migration einspielen** — im Terminal `cat ~/Esska-App/supabase/migrations/20260806100000_esska_kasse_unveraenderbar.sql | pbcopy`, dann Supabase SQL-Editor → New query → Cmd+V → Run. Vorher prüfen, ob `20260805200000_esska_bargeld_bestand.sql` schon drin ist (Spalte `startbestand_cent` in `daily_sales` vorhanden?).
2. **Kassenformular testen** — `/app/sales/new`: einen Eintrag speichern, dann für denselben Center+Tag erneut speichern → es muss das Feld „Grund der Korrektur" erscheinen und ein zweiter Datensatz entstehen. In `/app/sales` prüfen, ob „1 frühere Fassung" aufklappbar ist.
3. **Neue Startseite sichten** — `https://esska-app.vercel.app` am Handy, prüfen ob Anmelden-Button und Einladungs-Hinweis verständlich sind.
4. **PWA einrichten** (falls gewünscht) — `nextjs/public/manifest.json`, App-Icons in mehreren Größen, `<link rel="manifest">` in `nextjs/src/app/layout.tsx`, kurze Anleitung „Zum Home-Bildschirm hinzufügen" für die Mitarbeiter.
5. **Center-Seed einspielen** falls noch nicht geschehen — `docs/seeds/centers-2627.sql`.
6. **Rechtliche To-dos** aus Abschnitt 8 abarbeiten, bevor echte Mitarbeiterdaten erfasst werden.
7. **Alten Branch aufräumen** — `git push origin --delete claude/kind-galileo-z76p7q` (enthält nur überholte README-Änderungen).

---

## 12. EMPFOHLENE SKILLS / TOOLS FÜR DIE NÄCHSTE SESSION

- **Kein Skill zwingend nötig.** Die Arbeit läuft über Read/Write/Edit/Bash direkt am Repo.
- Falls PDFs erzeugt werden sollen (wie `docs/Datensicherheit-fuer-Jannis.pdf`): HTML schreiben und mit headless Chromium rendern — `pandoc`/`weasyprint` sind **nicht** installiert:
  ```bash
  /opt/pw-browsers/chromium-1194/chrome-linux/chrome --headless --disable-gpu --no-sandbox \
    --print-to-pdf="ziel.pdf" --print-to-pdf-no-header "file://$(pwd)/quelle.html"
  ```
  (die dbus-Fehlermeldungen dabei sind harmlos)
- Der `pdf`-Skill wäre eine Alternative für PDF-Aufgaben, wurde in dieser Session aber nicht gebraucht.
- MCP-Server (github, Vercel) sind verbunden, waren aber nie nötig — Bash + git reicht.

---

## 13. DATEIEN DIE ZUERST GELESEN WERDEN SOLLTEN

| Priorität | Pfad | Warum |
|---|---|---|
| 1 | `PLAN.md` | Etappenplan, Datenmodell-Skizze, Sicherheitskonzept, Kostenrahmen |
| 2 | `nextjs/src/lib/esska/types.ts` | Alle Domain-Typen, Enums und Label-Maps an einer Stelle — schnellster Überblick über das Datenmodell |
| 3 | `supabase/migrations/20260806100000_esska_kasse_unveraenderbar.sql` | Die noch nicht eingespielte Migration + die GoBD-Logik |
| 4 | `docs/etappe-1-feinplanung.md` | Felddefinitionen aus den Esska-Originalformularen (Personalfragebogen, KuBe) |
| 5 | `nextjs/src/app/app/sales/new/page.tsx` | Aktuellster Stand des Kassenformulars inkl. Korrektur-Logik |
| 6 | `nextjs/src/lib/supabase/middleware.ts` | Die beiden Zugriffs-Gates (Login + Onboarding-Pflicht) |
| 7 | `README.md` | Ursprüngliches Briefing des Auftraggebers |
