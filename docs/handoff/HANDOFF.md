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
