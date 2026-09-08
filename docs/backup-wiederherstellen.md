# Backups: Einrichten, Pruefen, Wiederherstellen

## Warum es das gibt

Der kostenlose Supabase-Tarif macht **keine** Backups. Aber auch mit Supabase
Pro gilt die Regel: Eine Sicherung an nur einer Stelle ist keine Sicherung.
Deshalb legt eine taegliche GitHub-Aktion eine zweite, unabhaengige Kopie an -
verschluesselt, mit einem Schluessel, der nur Esska gehoert.

## Einrichtung (einmalig, ca. 10 Minuten)

### 1. Verbindungszeichenfolge holen

Supabase-Dashboard -> Project Settings -> Database -> Connection string ->
Tab **URI**. Die Zeichenfolge sieht so aus:

```
postgresql://postgres.tbkuqvnjywgjqcgzryww:[PASSWORT]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

`[PASSWORT]` durch das echte Datenbank-Passwort ersetzen. Ist es unbekannt,
laesst es sich auf derselben Seite zuruecksetzen (Achtung: danach muessen
andere Verbindungen ggf. angepasst werden).

### 2. Backup-Passwort festlegen

Ein langes, zufaelliges Passwort erzeugen, z. B. im Terminal:

```bash
openssl rand -base64 32
```

**Dieses Passwort unbedingt im Passwortmanager sichern.** Ohne es sind alle
Backups wertlos - es gibt keine Wiederherstellung.

### 3. Beides bei GitHub hinterlegen

Repository -> Settings -> Secrets and variables -> Actions -> New secret:

| Name | Wert |
|---|---|
| `SUPABASE_DB_URL` | die Verbindungszeichenfolge aus Schritt 1 |
| `BACKUP_PASSWORT` | das Passwort aus Schritt 2 |

### 4. Einmal manuell ausloesen

Repository -> Actions -> "Datenbank-Backup" -> "Run workflow". Nach ein bis
zwei Minuten sollte unter dem Lauf ein Artefakt
`esska-backup-JJJJ-MM-TT` liegen.

## Der wichtigste Schritt: Wiederherstellung testen

Ein Backup, dessen Wiederherstellung nie getestet wurde, ist eine Vermutung,
keine Sicherung. **Vor dem Live-Gang einmal durchspielen:**

1. Artefakt aus GitHub herunterladen und entpacken.
2. Entschluesseln:
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 \
     -in esska-backup-2026-09-08.sql.enc \
     -out esska-backup.sql \
     -pass pass:DEIN_BACKUP_PASSWORT
   ```
3. Datei oeffnen und stichprobenartig pruefen: Stehen `create table
   public.profiles`, `daily_sales` und Datenzeilen drin?
4. Fuer den vollstaendigen Test: in Supabase ein **neues, leeres Projekt**
   anlegen und einspielen:
   ```bash
   psql "postgresql://...neues-projekt..." < esska-backup.sql
   ```
   Danach pruefen, ob Center, Profile und Kasseneintraege vorhanden sind -
   und das Testprojekt wieder loeschen.

Ergebnis und Datum des Tests im Verarbeitungsverzeichnis eintragen
(`[DATUM_RESTORE_TEST]`).

## Was gesichert wird - und was nicht

**Enthalten:** alle Tabellen des `public`-Schemas (Profile, Center,
Schichten, Verfuegbarkeiten, Kassendaten, Bestellungen) sowie das
`auth`-Schema mit den Anmeldedaten.

**NICHT enthalten:** die Dateien im Speicher (hochgeladene Ausweise und
Fotos der Verkaufslisten). Die liegen im Supabase-Storage und muessten
separat gesichert werden. Fuer die Aufbewahrungspflicht nach § 147 AO sind
vor allem die Belegfotos relevant - **offener Punkt, vor dem Saisonende
loesen** (Vorschlag: einmal pro Saison manuell exportieren).

## Aufbewahrung

GitHub loescht Artefakte nach **90 Tagen**. Fuer die gesetzlichen
Aufbewahrungsfristen (10 Jahre) reicht das nicht. Deshalb:

- **Nach jedem Saisonende** ein Backup herunterladen und dauerhaft archivieren
  (z. B. verschluesselt auf einer externen Festplatte bei Esska).
- Das Passwort dazu getrennt aufbewahren.

## Kosten

Keine. GitHub Actions ist fuer private Repositories im kostenlosen Kontingent
enthalten (2.000 Minuten/Monat); ein Backup-Lauf dauert unter zwei Minuten.
