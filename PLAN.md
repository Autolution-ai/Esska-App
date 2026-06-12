# Umsetzungsplan – Esska-App

> Dieser Plan baut auf dem Briefing in `README.md` auf. Er beschreibt **wie** wir die App bauen, **womit**, **in welcher Reihenfolge** und **worauf zu achten** ist. Geschrieben für einen Einsteiger – Begriffe werden erklärt, nicht vorausgesetzt.

---

## 1. Technisches Setup (Empfehlung mit Begründung)

### 1.1 Die zentrale Entscheidung: Eine Web-App / Progressive Web App (PWA)

**Keine native iOS-/Android-App.** Stattdessen eine moderne Web-App, die sich am Handy wie eine App anfühlt und am Desktop des Inhabers als vollwertiges Dashboard funktioniert.

**Warum diese Wahl:**

| Vorteil | Bedeutung für Esska |
|---|---|
| Eine Codebasis | Mitarbeiter (Handy) und Inhaber (Desktop) nutzen dieselbe App – weniger Wartung, ein Deployment |
| Kein App-Store-Prozess | Saisonales Personal öffnet einfach einen Link → keine Installation, kein Apple-/Google-Konto nötig |
| Schnelle Updates | Änderungen sind sofort live, keine Store-Review-Zeit |
| Plattformunabhängig | Funktioniert auf iPhone, Android, Windows, Mac gleichermaßen |
| EU-Hosting frei wählbar | DSGVO-konform realisierbar |

### 1.2 Der Stack

| Schicht | Werkzeug | Aufgabe |
|---|---|---|
| **Frontend** | Next.js 15 + React 19 | Die eigentliche App, was Nutzer sehen |
| **UI-Bibliothek** | Tailwind CSS + shadcn/ui + Radix UI | Aussehen, Buttons, Eingabefelder – modern und barrierearm |
| **Charts** | Recharts | Umsatz-Diagramme im Admin-Dashboard |
| **Backend** | Supabase (Frankfurt-Region) | Datenbank, Login, Datei-Speicher, alles in einem |
| **Datenbank** | Postgres (in Supabase enthalten) | Wo Center, Mitarbeiter, Schichten, Umsätze liegen |
| **Authentifizierung** | Supabase Auth (E-Mail + Passwort, später MFA) | Login, Rollen, Sessions |
| **Sicherheit** | Postgres Row Level Security (RLS) | Serverseitig erzwungene Rollen – ein Mitarbeiter kann nie Admin-Daten ziehen |
| **Hosting Frontend** | Vercel (Frankfurt-Region) | Wo die App im Internet läuft |
| **Sprache** | TypeScript | Tippfehler werden vor dem Live-Gang erkannt |

### 1.3 Warum genau dieses Starter-Template

Verwendet wird: **[Razikus/supabase-nextjs-template](https://github.com/Razikus/supabase-nextjs-template)**

Ausschlaggebend:

- ✅ **Auth + User-Management komplett vorhanden** (Registrierung, Login, Passwort-Reset, MFA-fähig)
- ✅ **RLS-Policies vorbereitet** → genau die in `README.md §4` geforderte serverseitige Rollentrennung
- ✅ **Next.js 15, React 19, TypeScript** – aktueller Stand
- ✅ **Kein SaaS-Ballast** (keine erzwungene Stripe-/Multi-Tenant-Komplexität)
- ✅ **Aktiv gepflegt**, Open Source (MIT-Lizenz)
- ✅ **Bonus:** Es gibt eine zusätzliche `supabase-expo-template/`-Variante als Grundlage, falls wir später doch eine native Mitarbeiter-App wollen – auf derselben Datenbank

> Hinweis: Wir entfernen die Paddle-/Bezahl-Integration des Templates, weil Esska in der App nichts verkauft. Das ist ein kleiner Aufräumschritt in Etappe 1.

---

## 2. Datenmodell (Skizze)

So sollen die Daten später in der Datenbank organisiert sein. Jede Tabelle bekommt RLS-Policies, die genau festlegen, wer welche Zeile sehen oder ändern darf.

```
profiles (1 pro User)
  ├─ user_id           ← Verbindung zum Login
  ├─ role              ← "admin" | "mitarbeiter"
  ├─ vorname, nachname
  ├─ telefon, adresse, … (Personalstammdatenblatt)
  └─ aktiv             ← saisonal ein/aus

centers (Standorte je Saison)
  ├─ id
  ├─ name              ← z. B. "Altmarkt-Galerie Dresden"
  ├─ stadt
  ├─ saison_jahr       ← z. B. 2026
  ├─ start_datum, end_datum
  └─ status            ← "geplant" | "aktiv" | "abgeschlossen"

center_assignments (Mitarbeiter ↔ Center)
  ├─ center_id
  ├─ profile_id
  └─ rolle_im_center   ← optional: "Stand-Leitung" o. ä.

availabilities (Verfügbarkeit pflegen)
  ├─ profile_id
  ├─ datum
  └─ verfügbar         ← true/false oder Zeitfenster

shifts (Schichten / Wochenplan)
  ├─ center_id
  ├─ profile_id
  ├─ datum, start_zeit, end_zeit
  └─ veröffentlicht    ← erst sichtbar für MA, wenn true

daily_sales (täglicher Umsatz je Center)
  ├─ center_id
  ├─ datum
  ├─ betrag_cent       ← Geldbeträge IMMER als Cent (Integer), nie als Kommazahl
  ├─ erfasst_von       ← profile_id (welcher User hat eingetragen)
  └─ notiz
```

**Wichtige Regel:** Geld nie als Float speichern, sondern in Cent als Integer (39,99 € = `3999`). Sonst kommt es bei Summen zu Rundungsfehlern.

---

## 3. MVP-Schnitt (Etappen-Plan)

Die App wird in **vier Etappen** gebaut. Jede Etappe ist für sich lauffähig und nutzbar. Wir gehen erst zur nächsten, wenn die aktuelle steht.

### Etappe 0 – Fundament steht (1–2 Tage) ✅ ABGESCHLOSSEN (12.06.2026)
**Ziel:** Lokal lauffähige App auf eigenem Rechner, Login funktioniert.

- Supabase-Projekt in **Frankfurt-Region** anlegen
- `.env.local` mit Keys einrichten (lokal, **nie** committen)
- Template-Dependencies installieren (`npm install`)
- Datenbank-Migrations einspielen
- Paddle-/SaaS-Reste aus dem Template entfernen
- Erste eigene Anmeldung erfolgreich

**Definition of Done:** Du kannst dich lokal einloggen und siehst eine leere Startseite.

### Etappe 1 – Rollen & Center-Verwaltung (2–4 Tage)
**Ziel:** Inhaber kann Center anlegen, Mitarbeiter einladen, Rollen vergeben.

- Tabelle `profiles` um Rolle (`admin`/`mitarbeiter`) und Stammdaten-Felder erweitern
- RLS-Policies: Admin sieht alles, Mitarbeiter nur sich selbst
- Admin-Ansicht: Center-Liste, Center anlegen/bearbeiten
- Admin-Ansicht: Mitarbeiter-Liste, Mitarbeiter zu Centern zuordnen
- Mitarbeiter-Ansicht: Eigenes Stammdatenblatt pflegen, eigene Center-Zuordnung sehen
- Rollen-basierte Navigation (Admin sieht andere Menüpunkte als Mitarbeiter)

**Definition of Done:** Jannis legt Center "Altmarkt-Galerie 2026" an, ordnet 3 Mitarbeiter zu, jeder Mitarbeiter sieht nur die für ihn relevanten Daten.

### Etappe 2 – Verfügbarkeit & Schichtplan (3–5 Tage) ✅ ABGESCHLOSSEN (12.06.2026)
**Ziel:** WhatsApp-Verfügbarkeitsabfrage ist abgelöst.

- Mitarbeiter-Ansicht: Kalender, Verfügbarkeit pro Tag/Zeitfenster eintragen
- Admin-Ansicht: Wochenplan-Editor je Center (welcher MA an welchem Tag)
- Admin-Ansicht: Plan veröffentlichen-Funktion (vorher nur Entwurf, sichtbar nur für Admin)
- Mitarbeiter-Ansicht: "Meine Schichten" – nur veröffentlichte Pläne, nur eigene Schichten

**Definition of Done:** Mitarbeiter pflegt Verfügbarkeit, Jannis erstellt Plan, veröffentlicht ihn, Mitarbeiter sieht seine Schichten.

### Etappe 3 – Tägliches Umsatzreporting (2–4 Tage) ✅ ABGESCHLOSSEN (12.06.2026)
**Ziel:** Papier-Notiz und WhatsApp-Foto sind abgelöst.

- Eingabemaske: Tagesumsatz je Center erfassen (durch Mitarbeiter mit Center-Zuordnung **oder** Admin)
- Admin-Dashboard: Umsatz-Übersicht je Center und Zeitraum (Tag/Woche/Monat/Saison)
- Diagramme (mit Recharts): Vergleich Center, Vergleich Vorjahr (wenn Daten da), Trend
- Export als CSV für externe Buchhaltung

**Definition of Done:** Mitarbeiter trägt abends seinen Center-Umsatz ein, Jannis sieht am Desktop alle Center im Vergleich.

### Vor dem Live-Gang (nach Etappe 3, vor Saisonstart)
**Account-Übergabe an Esska:** Entwicklung läuft auf den privaten Accounts des Praktikanten (Supabase „esska-dev", Vercel). Vor dem Produktivbetrieb mit echten Daten:
- Esska-eigene Accounts anlegen (E-Mail des Inhabers) für Supabase, Vercel und Domain
- Produktions-Supabase-Projekt (Frankfurt) im Esska-Account aufsetzen, AVV/DPA dort abschließen
- Vercel-Projekt in den Esska-Account übertragen bzw. dort neu mit dem GitHub-Repo verbinden
- Zugangsdaten dokumentiert an den Inhaber übergeben (Passwort-Manager)

### Spätere Erweiterungen (nicht MVP)
- Push-Benachrichtigungen bei neuem Schichtplan (PWA-Feature)
- Native Mobile-App aus dem Expo-Template (falls gewünscht)
- Belege/Fotos je Umsatztag anhängen (Storage steht bereits)
- Lohn-/Stunden-Reporting

---

## 4. Sicherheitskonzept

Wie in `README.md §4` festgelegt: Security ist **Pflicht von Anfang an**, kein Anhang.

### 4.1 Authentifizierung
- **E-Mail + Passwort** (Supabase Auth), Mindestlänge 10 Zeichen erzwungen
- **MFA optional aktivierbar** für den Admin (vom Template bereits unterstützt)
- **Passwort-Reset-Flow** vorhanden
- **Session-Cookies** sicher konfiguriert (HttpOnly, Secure, SameSite=Lax)

### 4.2 Autorisierung (Wer-darf-was)
**Niemals nur im UI prüfen – immer in der Datenbank erzwingen.** Das bedeutet RLS-Policies in Postgres, die jede Datenabfrage filtern:

- Mitarbeiter darf nur sein eigenes Profil lesen/ändern
- Mitarbeiter darf nur Schichten lesen, die `veröffentlicht = true` UND `profile_id = sein_id` sind
- Mitarbeiter darf Umsätze nur für Center eintragen, denen er zugeordnet ist
- Admin darf alles in Tabellen, die zum Betrieb gehören

Diese Regeln liegen als SQL-Migrations im `supabase/`-Ordner und sind unter Versionskontrolle.

### 4.3 Datenschutz / DSGVO
- **Region:** Supabase-Projekt **AWS EU-Central (Frankfurt)** – Pflicht bei Anlage zu wählen
- **Auftragsverarbeitungsvertrag (AVV/DPA)** mit Supabase abschließen (kostenlos im Pro-Plan)
- **AVV mit Vercel** ebenfalls abschließen
- **Datenschutzhinweise in der App** (für Mitarbeiter sichtbar bei Registrierung)
- **Löschkonzept:** Saisonale Stammdaten von Ex-Mitarbeitern müssen über einen Admin-Button anonymisierbar/löschbar sein (vor Ende der gesetzlichen Aufbewahrungsfristen für Umsatzdaten getrennt behandeln)

### 4.4 Secrets / Zugangsdaten
- **`.env.local`** liegt lokal, ist in `.gitignore`, kommt **niemals** ins Repo
- Produktiv-Keys liegen in Vercel-Environment-Variables und Supabase-Dashboard
- **Zwei getrennte Supabase-Projekte:** eines für Entwicklung/Test, eines produktiv – damit Tests nie echte Mitarbeiterdaten berühren
- Service-Role-Key (Admin-Zugriff zur DB) nur serverseitig nutzen, nie im Browser

### 4.5 Backups
- **Tägliche automatische Backups** durch Supabase Pro (7 Tage Retention)
- Zusätzlich: Einmal pro Monat manueller Export der zentralen Tabellen als SQL-Dump
- Backup-Restore mindestens einmal vor Saisonbeginn testen

### 4.6 Transport-Verschlüsselung
- HTTPS überall – wird durch Vercel und Supabase automatisch erzwungen
- HTTP-Aufrufe werden nicht akzeptiert

---

## 5. Einsteiger-Fallstricke (mit Handlungsempfehlung)

| Fallstrick | Wie verhindern |
|---|---|
| **Secrets versehentlich committen** | `.gitignore` schützt `.env*`. Vor jedem Commit kurz prüfen: was wird hochgeladen? Niemals Keys in den Code schreiben. |
| **RLS nur im UI prüfen** | Niemals "Admin-Button ausblenden = sicher" denken. Jede Tabelle braucht RLS-Policies. Tests mit zwei Browsern (Admin und Mitarbeiter) durchspielen. |
| **Migrations nicht versionieren** | Jede Datenbank-Änderung als SQL-Datei in `supabase/migrations/`. Nie direkt im Supabase-Dashboard "klick-klick" Tabellen ändern, sonst weiß die Versionskontrolle nichts davon. |
| **Geld als Float speichern** | Immer Integer in Cent. `3999` statt `39.99`. |
| **Mit Echtdaten testen** | Niemals. Zwei Supabase-Projekte: Entwicklung mit Fake-Daten, Produktion live. |
| **Region versehentlich US** | Bei der Anlage des Supabase-Projekts **Frankfurt** wählen. Spätere Migration ist Aufwand. |
| **Fehlende Backups** | Pro-Plan ab Live-Gang. Restore vor Saisonbeginn üben. |
| **Updates blind übernehmen** | Dependencies (`package.json`) regelmäßig prüfen, aber Major-Updates erst testen, dann live. |
| **Nichts dokumentieren** | Datenmodell-Änderungen kurz in `PLAN.md` oder einer `CHANGELOG.md` festhalten. |

---

## 6. Corporate Identity / Design

Basierend auf dem Preisschild-Beispiel aus dem Esska-Sortiment.

### 6.1 Farbpalette

| Rolle | Hex | Verwendung |
|---|---|---|
| Beige/Creme (Hintergrund) | `#F7EBD3` | App-Hintergrund, Karten |
| Weinrot (Akzent) | `#9E2A2B` | Primär-Buttons, wichtige Zahlen, Highlights |
| Tiefes Schwarz | `#1A1A1A` | Standard-Text, Überschriften |
| Dunkelbraun-Schwarz | `#2A2018` | Linien, Rahmen |
| Gedämpftes Gold | `#C9A961` | Dezente Hinweise (optional) |

Kontraste erfüllen WCAG-AA (Schwarz auf Beige ≈ 14:1, Weinrot auf Beige ≈ 6:1).

### 6.2 Typografie

- **Überschriften:** Serifenschrift mit Kapitälchen-Charakter (z. B. *Cormorant Garamond* oder *Cinzel*, kostenlos via Google Fonts)
- **Lauftext / UI:** ruhige, gut lesbare Schrift (z. B. *Inter* oder *Source Sans 3*)
- **Zahlen (Umsätze, Preise):** Serifenschrift, ggf. mit Unterstreichung als Stilmittel

### 6.3 Stilrichtlinie

Klassisch, ruhig, hochwertig – wie das Preisschild. Viel Weißraum, klare Rahmungen, keine knalligen Tech-Farben. Tailwind-Theme entsprechend konfigurieren.

---

## 7. Kosten

| Position | Während Entwicklung | Im Live-Betrieb |
|---|---|---|
| Supabase | 0 € (Free) | ~23 €/Monat (Pro, Frankfurt) |
| Vercel | 0 € (Hobby) | 0 € (Hobby reicht für unsere Größe) |
| Domain (z. B. esska-app.de) | – | ~1 €/Monat |
| **Summe** | **0 €** | **~24 €/Monat** |

Außerhalb der Saison (Feb–Sep) kann das Supabase-Projekt pausiert werden → effektive Jahreskosten ≈ 100 €.

---

## 8. Schritt-für-Schritt-Fahrplan (was als Nächstes zu tun ist)

### Vorbereitung (du)
1. **GitHub-Konto** bereits vorhanden ✅
2. **Supabase-Konto** anlegen unter <https://supabase.com> (mit Geschäfts-E-Mail)
3. **Vercel-Konto** anlegen unter <https://vercel.com> (mit demselben GitHub verknüpfen)
4. **Node.js (LTS)** auf dem Entwicklungsrechner installieren – falls noch nicht da

### Etappe 0 (gemeinsam – ich führe durch)
5. Supabase-Projekt **"esska-dev"** anlegen, Region **Frankfurt**
6. API-Keys in `.env.local` eintragen
7. Migrations des Templates anpassen und einspielen
8. Paddle-/Bezahl-Reste entfernen
9. App lokal starten, erstes Login testen

### Etappe 1 ff.
10. Datenmodell für `profiles`, `centers`, … als Migrations schreiben
11. RLS-Policies für jede neue Tabelle definieren
12. Admin- und Mitarbeiter-Ansichten umsetzen
13. CI-Theming (Beige/Weinrot) in Tailwind anpassen

---

## 9. Was dieser Plan **nicht** enthält

- Detaillierte UI-Mockups (kommen, wenn Etappe 1 startet)
- Lohn-/Stundenabrechnung (bewusst ausgelagert, da steuerlich komplex)
- Kundenseitige Funktionen (Esska verkauft im Center, nicht in der App)
- Lagerverwaltung (bewusst nicht im MVP)

---

**Status:** Plan freigegeben → Etappe 0 kann starten.
