# Feinplanung – Etappe 1: Rollen, Center, Onboarding

> Diese Datei detailliert, was in Etappe 1 konkret gebaut wird. Sie ergänzt `PLAN.md` mit den fachlichen Felddefinitionen aus den Esska-Formularen (Personalstammdatenblatt, KuBe-Bogen, Rentenversicherungs-Befreiung) und der Center-Verträge-Tabelle.

---

## 1. Rollenmodell

Drei Rollen sind sinnvoll (Erweiterung gegenüber `PLAN.md`, bitte bestätigen):

| Rolle | Wer | Darf |
|---|---|---|
| `admin` | Jannis | alles: Center, Mitarbeiter, Pläne, Umsätze |
| `lead` *(optional)* | Stand-Leitung im Center | nur eigene Center: Schichtplan sehen, Tagesumsatz erfassen |
| `mitarbeiter` | reguläres Saisonpersonal | nur eigene Stammdaten + eigene veröffentlichte Schichten |

Die Rolle `lead` ist optional. Wenn Esska heute keine Stand-Leitungen mit erweiterten Rechten kennt, lassen wir sie weg und führen sie später ein, wenn nötig.

---

## 2. Onboarding-Workflow neuer Mitarbeiter

Der Inhaber lädt einen Mitarbeiter per E-Mail-Einladung ein. Der Mitarbeiter durchläuft beim ersten Login einen **dreistufigen Onboarding-Assistenten**, bevor er die App regulär nutzen kann:

```
Schritt 1: Personalstammdatenblatt ausfüllen
Schritt 2: KuBe-Statuserklärung (nur bei kurzfristig Beschäftigten)
Schritt 3: Ausweis-Upload (Vorder- und Rückseite)
   ↳ optional: Rentenversicherungs-Befreiungsantrag (Minijobber)
   ↳ optional: weitere Nachweise (Immatrikulation, Schulbescheinigung, Rentenbescheid…)
```

Nach Abschluss erstellt die App **PDFs im Originallayout** der Esska-Formulare. Diese werden:
- als Datei im Mitarbeiter-Profil gespeichert (Supabase Storage, RLS-geschützt)
- für Jannis sofort herunterladbar (für Personalakte)
- per Pflicht-Häkchen + Zeitstempel + IP digital "unterschrieben"
- bei Minderjährigen zusätzlich druckbar für die Unterschrift des gesetzlichen Vertreters

---

## 3. Datenmodell – Personalstammdatenblatt (`profiles`-Erweiterung)

Felder eins zu eins aus dem Esska-Formular. `*` = nur Pflicht bei nicht-Minijob.

### Persönliche Daten
| Feld | Typ | Pflicht | Notiz |
|---|---|---|---|
| `vorname` | Text | ja | |
| `nachname` | Text | ja | |
| `geburtsdatum` | Datum | ja | |
| `geburtsort` | Text | ja | |
| `staatsangehoerigkeit` | Text | ja | |
| `familienstand` | Enum | ja | ledig / verheiratet / geschieden |
| `kinder` | Liste *(\*)* | nein | je Kind: Name + Geburtsdatum |

### Kontaktdaten
| Feld | Typ | Pflicht |
|---|---|---|
| `anschrift_strasse` | Text | ja |
| `anschrift_plz` | Text | ja |
| `anschrift_ort` | Text | ja |
| `telefon_mobil` | Text | ja |
| `email` | E-Mail | ja *(aus Auth)* |

### Beschäftigungsdaten
| Feld | Typ | Pflicht |
|---|---|---|
| `eintrittsdatum` | Datum | ja, vom Admin gesetzt |
| `arbeitszeit_modell` | Enum | ja: vollzeit / teilzeit / minijob / kurzfristig |
| `stunden_pro_woche` | Zahl | bei Teilzeit |
| `verdienst_monat_eur_cent` | Geld als Cent | bei Teilzeit/Vollzeit |
| `weitere_beschaeftigungen` | Text/Liste | nein |

### Sozialversicherung
| Feld | Typ | Pflicht | Notiz |
|---|---|---|---|
| `rentenversicherungsnummer` | Text (12) | ja | |
| `krankenversicherung_name` | Text | ja | konkrete Kasse |
| `krankenversicherung_status` | Enum | ja | gesetzlich / privat |
| `rentenversicherung_befreit` | Bool | nur Minijob | wenn ja → Antrag-Workflow |

### Steuerdaten *(\*)*
| Feld | Typ | Pflicht | Notiz |
|---|---|---|---|
| `steuer_id` | Text (11) | * | |
| `steuerklasse` | Enum | * | |
| `kinderfreibetrag` | Zahl | * | |
| `konfession` | Enum | * | evangelisch / katholisch / keine |

### Notfallkontakt *(\*)*
| Feld | Typ | Pflicht |
|---|---|---|
| `notfall_name` | Text | * |
| `notfall_beziehung` | Text | * |
| `notfall_telefon` | Text | * |

### Bestätigung
| Feld | Typ |
|---|---|
| `stammdaten_bestaetigt_am` | Zeitstempel |
| `stammdaten_bestaetigt_ip` | Text |

---

## 4. Datenmodell – KuBe-Statuserklärung (`kube_declarations`)

Eigene Tabelle, weil die KuBe-Statuserklärung **pro Saison neu** ausgefüllt werden muss. Felder kommen aus dem Esska-Formular.

| Feld | Typ | Notiz |
|---|---|---|
| `profile_id` | FK | |
| `saison` | Text | z. B. "26/27" |
| `begrenzung` | Enum | "3_monate" / "70_arbeitstage" |
| `erwerbsstatus` | Enum | schueler / student / azubi / arbeitnehmer_teilzeit / arbeitnehmer_vollzeit / selbststaendig / rentner / hausfrau_hausmann / arbeitssuchend / freiwilligendienst / schulentlassen_ausbildung / schulentlassen_studium / schulentlassen_freiwilligendienst / sonstiges |
| `erwerbsstatus_sonstiges` | Text | nur bei "sonstiges" |
| `bafoeg_bezug` | Bool | nur Schüler/Student |
| `aktueller_arbeitgeber` | Text | nur Arbeitnehmer |
| `aktueller_verdienst_eur_cent` | Geld | nur Arbeitnehmer |
| `arbeitslosen_leistung` | Enum | sgb_iii / sgb_ii / keine (nur Arbeitssuchend) |
| `lebensunterhalt` | Enum | hauptbeschaeftigung / studium_schule / ausbildung / rente / selbststaendigkeit / unterhalt_familie / sonstiges |
| `lebensunterhalt_sonstiges` | Text | |
| `monate_ueber_geringfuegigkeit` | Liste<Monat> | leer = "in keinem Monat" |
| `weitere_kurzfristige_beschaeftigungen` | JSON-Liste | je Eintrag: Arbeitgeber, Zeitraum, Tage, Verdienst |
| `erklaerung_zeitgrenze` | Bool, Pflicht | |
| `erklaerung_nichtberufsmaessig` | Bool, Pflicht | |
| `verpflichtung_mitteilung` | Bool, Pflicht | |
| `nachweis_zustimmung` | Bool, Pflicht | |
| `unterzeichnet_am` | Zeitstempel | |
| `unterzeichnet_ip` | Text | |
| `unterzeichnet_ort` | Text | |
| `unterschrift_minderjaehriger_vorhanden` | Bool | bei Minderjährigen Pflicht |
| `pdf_path` | Text | Pfad zum generierten PDF in Storage |

---

## 5. Datenmodell – Rentenversicherungs-Befreiung (`pension_exemptions`)

Eigene Tabelle, weil das ein separater amtlicher Antrag ist.

| Feld | Typ |
|---|---|
| `profile_id` | FK |
| `rentenversicherungsnummer` | Text |
| `merkblatt_zur_kenntnis_genommen` | Bool, Pflicht |
| `unterzeichnet_am` | Zeitstempel |
| `unterzeichnet_ip` | Text |
| `unterzeichnet_ort` | Text |
| `pdf_path` | Text |

---

## 6. Datenmodell – Dokumenten-Uploads (`employee_documents`)

Generische Tabelle für hochgeladene Nachweise (Ausweis, Immatrikulation, Schulbescheinigung etc.).

| Feld | Typ | Notiz |
|---|---|---|
| `profile_id` | FK | |
| `dokument_typ` | Enum | ausweis_vorderseite / ausweis_rueckseite / aufenthaltsgenehmigung / immatrikulation / schulbescheinigung / rentenbescheid / gewerbeanmeldung / sonstiges |
| `storage_path` | Text | Datei in Supabase Storage |
| `hochgeladen_am` | Zeitstempel | |
| `hochgeladen_von` | FK profile | meist Mitarbeiter selbst, kann auch Admin sein |
| `gueltig_bis` | Datum *(optional)* | z. B. Aufenthaltsgenehmigung |
| `notiz` | Text | |

Storage-Bucket: `employee-documents`, mit RLS so, dass nur eigener User + Admin Zugriff hat.

---

## 7. Datenmodell – Center (`centers`)

Übernommen aus der Esska-Verträge-Tabelle ("Verträge 26/27 (Start)"):

| Feld | Typ | Pflicht | Notiz |
|---|---|---|---|
| `id` | UUID | auto | |
| `saison` | Text | ja | "26/27" |
| `name` | Text | ja | "Ernst-August-Galerie" |
| `stadt` | Text | ja | |
| `kuerzel` | Text(3–6) | ja | "EAGH"; eindeutig pro Saison |
| `kategorie` | Enum | ja | A / B / C |
| `start_datum` | Datum | ja | |
| `end_datum` | Datum | ja | |
| `flaeche_position` | Text | nein | "EG 010 f,g,h,i" |
| `laenge_m` | Dezimal(4,2) | nein | |
| `breite_m` | Dezimal(4,2) | nein | |
| `flaeche_qm` | Dezimal(6,2) | berechnet | aus Länge × Breite, überschreibbar |
| `mietdauer_tage` | Integer | berechnet | aus Start/Ende, überschreibbar |
| `miete_eur_cent` | Integer | ja | gesamte Saisonmiete als Cent |
| `status` | Enum | ja | geplant / aktiv / abgeschlossen |
| `notiz` | Text | nein | |
| `created_at`, `updated_at` | Zeitstempel | auto | |

---

## 8. RLS-Policies (serverseitige Rollentrennung)

### `profiles`
- `SELECT`: eigene Zeile **oder** `admin`
- `UPDATE`: eigene Zeile (Mitarbeiter darf eigene Stammdaten pflegen) **oder** `admin`
- `INSERT`: nur per Admin-Einladungs-Flow (Trigger erzeugt Profil bei Auth-Registrierung)
- `DELETE`: nur `admin`

### `centers`
- `SELECT`: alle eingeloggten User (jeder darf wissen, welche Center es gibt – nötig für Zuordnung & Verfügbarkeit)
- `INSERT` / `UPDATE` / `DELETE`: nur `admin`

### `center_assignments`
- `SELECT`: eigene Zuordnungen **oder** `admin`
- alles andere: nur `admin`

### `kube_declarations`, `pension_exemptions`, `employee_documents`
- `SELECT`: eigene Zeilen **oder** `admin`
- `INSERT`/`UPDATE`: eigene Zeilen (für Onboarding) **oder** `admin`
- `DELETE`: nur `admin`

Storage-Bucket `employee-documents`:
- Pfad-Konvention: `{user_id}/{dokument_typ}/{filename}`
- Policy: nur `user_id = auth.uid()` oder `role = admin`

---

## 9. UI-Screens (Etappe 1)

### Admin
1. **Mitarbeiter-Liste** – mit Status (Onboarding offen / komplett), Filter nach Center, Suche
2. **Mitarbeiter einladen** – E-Mail + Rolle + optional direkte Center-Zuordnung; Einladungslink wird per Mail verschickt
3. **Mitarbeiter-Detail** – Stammdaten, KuBe-Status, hochgeladene Dokumente, Center-Zuordnungen; PDF-Download je Formular
4. **Center-Liste** – Saison-Filter, Tabelle wie im Esska-Sheet (mit berechneten Spalten)
5. **Center anlegen / bearbeiten** – Formular mit Live-Berechnung von Fläche & Tagen
6. **Center-Detail** – Übersicht, zugeordnete Mitarbeiter, Notizen

### Mitarbeiter
1. **Onboarding-Assistent** (dreistufig, beim ersten Login automatisch)
2. **Meine Stammdaten** – einsehen und ändern; Änderungen erfordern erneute Bestätigung
3. **Meine Center** – Liste der Center, denen ich zugeordnet bin
4. **Meine Dokumente** – hochgeladene Nachweise einsehen und nachreichen

---

## 10. PDF-Generierung

Für jedes der drei Formulare (Personalstammdaten, KuBe, Rentenversicherungs-Befreiung) gibt es eine PDF-Vorlage, die mit den eingegebenen Daten gefüllt wird. Layout soll dem Original-Esska-Formular nahekommen, damit Jannis es ohne Umgewöhnung in die Personalakte legen kann.

Technisch: serverseitige PDF-Erzeugung mit einer Library wie `@react-pdf/renderer` oder `pdf-lib`. Die Original-PDFs nutzen wir als Vorlage und füllen die Formularfelder.

---

## 11. Entscheidungen (Defaults, jederzeit revidierbar)

| Frage | Entscheidung | Begründung |
|---|---|---|
| A. Rolle `lead` | **Nein** – nur `admin` + `mitarbeiter` | Einfacher Start, später ergänzbar wenn Esska Stand-Leitungen mit Sonderrechten braucht |
| B. Fläche & Tage Center | **automatisch berechnen, manuell überschreibbar** | Reduziert Tippfehler, deckt Sonderfälle ab |
| C. Unterschrift | **digital als Standard** (Pflicht-Häkchen + Zeitstempel + IP), bei Minderjährigen druckbare PDF | Rechtlich tragfähig für Volljährige, Minderjährige brauchen Erziehungsberechtigten-Unterschrift |
| D. PDF-Layout | **erst sauberes neues Layout**, später ggf. Esska-Original 1:1 nachbauen | Schneller im MVP, in Etappe 2/3 kann verfeinert werden |
| E. Stammdaten-Änderung | **Mitarbeiter darf selbst ändern**, mit Protokoll-Tabelle `profile_change_log` | Entlastet Jannis, Nachvollziehbarkeit gewahrt |
| F. Sprache | **nur Deutsch im MVP** | i18n nicht im MVP-Scope; Esska-Personal ist deutschsprachig |
