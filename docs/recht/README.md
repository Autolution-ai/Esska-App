# Rechtstexte der Esska-App

## Stand der Platzhalter (12.09.2026)

**Eingesetzt** (Antworten von Jannis, siehe `FRAGEBOGEN-Jannis.md`):
Firmierung `Esska Collection`, Inhaber `Jannis Alekhanov`,
Anschrift `Dornbluethstrasse 22, 01277 Dresden`, Telefon `+49 1512 2544117`,
E-Mail `esska.app@gmail.com` (zugleich Datenschutz-Kontakt),
Aufsichtsbehoerde Sachsen, Mailanbieter Google Ireland,
Loeschfristen fuer Lohn und Kasse (gesetzlich 10 Jahre), Stand-Datum.

**Bewusste Aenderungen:**
- Der Abschnitt *Registereintrag* wurde aus dem Impressum **entfernt**.
  Frage 7 ist unbeantwortet; bei einem Einzelunternehmen wird kein Eintrag
  angenommen. Falls doch einer besteht, muss der Abschnitt zurueck.
- Die USt-IdNr. steht als `wird ergaenzt` im Impressum. Das ist zulaessig,
  solange keine vergeben ist - sobald sie da ist, eintragen.

**Noch offen:**

| Platzhalter | Fehlt aus | Datei |
|---|---|---|
| `[STEUERBERATER]` | Frage 13 | `datenschutz-beschaeftigte.md`, `verarbeitungsverzeichnis.md` |
| `[DAUER_BEWERBUNG]`, `[DAUER_PLANUNG]`, `[DAUER_BESTELLUNGEN]`, `[DAUER_PROTOKOLL]` | Frage 11 | beide |
| `[LAGER_EMAIL]` | Frage 20 | `verarbeitungsverzeichnis.md` |

**Blocker fuer den Live-Gang, der aus den Antworten folgt:** Die
Datenschutzerklaerung nennt fuer alle drei Dienstleister einen AVV. Fuer das
private Google-Konto gibt es keinen. Entweder Google Workspace oder Resend mit
eigener Domain, bevor echte Personaldaten drin sind.

## Wo liegt was?

**Oeffentlich in der App** (unter /legal erreichbar, Quelldateien in
`nextjs/public/terms/`):

| Datei | In der App | Zweck |
|---|---|---|
| `impressum.md` | /legal/impressum | Pflicht nach § 5 DDG |
| `datenschutz.md` | /legal/datenschutz | Datenschutzerklaerung fuer den Seitenaufruf |
| `datenschutz-beschaeftigte.md` | /legal/datenschutz-beschaeftigte | Information nach Art. 13 DSGVO - das wichtigste Dokument |
| `nutzungsregeln.md` | /legal/nutzungsregeln | Regeln fuer Beschaeftigte (ersetzt AGB, s. u.) |

**Intern, nicht veroeffentlichen** (in `docs/recht/`):

| Datei | Zweck |
|---|---|
| `verarbeitungsverzeichnis.md` | Pflicht nach Art. 30 DSGVO, inkl. TOM nach Art. 32 |
| `FRAGEBOGEN-Jannis.md` | Fragebogen fuer die fehlenden Angaben |

## Warum keine AGB?

AGB regeln Vertraege mit Kunden. Die Esska-App ist ein internes Werkzeug fuer
eigene Beschaeftigte - es gibt keinen Vertragsschluss ueber die App, keine
Zahlung, keine Verbraucher. Statt AGB gelten die **Nutzungsregeln** als Teil
der arbeitsvertraglichen Pflichten.

AGB (plus Widerrufsbelehrung und Preisangaben) werden erst noetig, wenn die
App als Software an Dritte verkauft oder vermietet wird.

## Warum kein Cookie-Banner?

Die App setzt ausschliesslich technisch notwendige Session-Cookies fuer die
Anmeldung. Nach § 25 Abs. 2 TDDDG ist dafuer keine Einwilligung erforderlich.
Tracking und Analyse wurden bewusst entfernt. Ein Banner waere hier nicht nur
ueberfluessig, sondern irrefuehrend.

## Platzhalter ersetzen

Alle Platzhalter stehen in ECKIGEN KLAMMERN und GROSSBUCHSTABEN, z. B.
`[FIRMIERUNG]`. Alle auf einmal finden:

```bash
grep -rn "\[[A-Z_]*\]" nextjs/public/terms/ docs/recht/
```

Zuordnung Fragebogen -> Platzhalter:

| Frage | Platzhalter |
|---|---|
| 1 Firmierung | `[FIRMIERUNG]`, `[INHABER]` |
| 2 Anschrift | `[STRASSE HAUSNUMMER]`, `[PLZ ORT]` |
| 3 E-Mail | `[EMAIL]` |
| 4 Telefon | `[TELEFON]` |
| 5/6 Steuer | `[USTIDNR ODER: Steuernummer STEUERNUMMER]` |
| 7 Handelsregister | `[REGISTER]` |
| 9 Datenschutz-Kontakt | `[DATENSCHUTZ_KONTAKT]` |
| 10 DSB | `[DSB ...]` |
| 11 Fristen | `[DAUER_LOHN]`, `[DAUER_KASSE]`, `[DAUER_BEWERBUNG]`, `[DAUER_PLANUNG]`, `[DAUER_BESTELLUNGEN]`, `[DAUER_PROTOKOLL]` |
| 13 Steuerberater | `[STEUERBERATER]` |
| 20 Lager | `[LAGER_EMAIL]` |
| - Mailanbieter | `[MAILANBIETER]`, `[MAIL_STANDORT]` |
| - Aufsichtsbehoerde | `[AUFSICHTSBEHOERDE]` (Sachsen: Saechsische Datenschutz- und Transparenzbeauftragte, Devrientstr. 5, 01067 Dresden) |
| - Datum | `[DATUM]` |
| - Status-Felder im Verzeichnis | `[STATUS_MFA]`, `[STATUS_BACKUP]`, `[STATUS_TRENNUNG]`, `[DATUM_RESTORE_TEST]`, `[DATUM_AVV_*]` |

## Noch zu erledigen (nicht schreibbar, muss abgeschlossen werden)

1. **AVV mit Vercel** - Dashboard, Settings -> Legal -> DPA
2. ~~AVV mit Supabase~~ - **erledigt.** Das Supabase-DPA gilt automatisch mit
   Annahme der Nutzungsbedingungen (DPA Ziffer 12.2) und enthaelt die
   EU-Standardvertragsklauseln, Modul 2. Geprueft und dokumentiert im
   Verarbeitungsverzeichnis. Offen bleiben zwei Kleinigkeiten:
   - Benachrichtigungen zur Unterauftragsverarbeiter-Liste abonnieren
   - pruefen, ob im Supabase-Konto eine regelmaessig gelesene E-Mail-Adresse
     hinterlegt ist (dorthin gehen Meldungen ueber Sicherheitsvorfaelle)
3. **AVV mit dem Mailanbieter** - bei Google Workspace ueber die
   Admin-Konsole; bei einem privaten Gmail-Konto ist KEIN AVV moeglich -
   das ist ein Argument fuer den Wechsel zu Resend mit eigener Domain
4. **Anwaltliche Pruefung** der Texte vor dem Live-Gang, insbesondere der
   Beschaeftigten-Information

## Wichtiger Hinweis

Diese Texte sind sorgfaeltig erstellte Entwuerfe, aber keine Rechtsberatung.
Vor dem produktiven Einsatz mit echten Personaldaten sollte ein Anwalt oder
der Steuerberater/Datenschutzbeauftragte einmal daraufschauen. Der Aufwand
dafuer ist gering, weil die Struktur steht - es geht nur noch um Pruefung.
