# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

**Internes Dokument – nicht veröffentlichen.** Muss auf Verlangen der
Aufsichtsbehörde vorgelegt werden können. Bei jeder Änderung an der App
aktualisieren.

## Verantwortlicher

**[FIRMIERUNG]**, [STRASSE HAUSNUMMER], [PLZ ORT]
Vertreten durch: [INHABER]
Kontakt Datenschutz: [DATENSCHUTZ_KONTAKT]
Datenschutzbeauftragter: [DSB ODER: nicht bestellt, da die Voraussetzungen des § 38 BDSG nicht vorliegen]

---

## Verarbeitungstätigkeit 1: Personalverwaltung (Esska-App)

**Zweck:** Begründung, Durchführung und Beendigung von Beschäftigungs-
verhältnissen; Lohnabrechnung; Meldungen an Sozialversicherung und Finanzamt.

**Rechtsgrundlagen:** § 26 Abs. 1 BDSG, Art. 6 Abs. 1 lit. b und c DSGVO

**Betroffene Personen:** Saisonbeschäftigte, Regionalleitungen, Administration

**Datenkategorien:** Stammdaten (Name, Geburtsdatum, Geburtsort/-land,
Staatsangehörigkeit, Familienstand, Anschrift, Kontakt); Beschäftigungsdaten
(Eintritt, Modell, Stunden, Verdienst, weitere Beschäftigungen, Status,
Sozialleistungsbezug); Sozialversicherungs- und Steuerdaten
(RV-Nummer, Krankenkasse, Steuer-ID, Steuerklasse, Kinderfreibetrag,
Konfession); Ausweis- und Nachweisdokumente; Notfallkontakt.

**Besondere Kategorien (Art. 9 DSGVO):** Konfession (für den Kirchensteuerabzug,
§ 26 Abs. 3 BDSG). Ausweisdokumente können weitere Angaben enthalten.

**Empfänger:** [STEUERBERATER]; Sozialversicherungsträger, Minijob-Zentrale,
Finanzbehörden; Auftragsverarbeiter (siehe unten).

**Löschfristen:** Lohn-/Steuerunterlagen [DAUER_LOHN]; Stammdaten ohne
Beschäftigung [DAUER_BEWERBUNG]; Nachweisdokumente Beschäftigungsdauer zzgl.
gesetzlicher Fristen.

**Technische und organisatorische Maßnahmen:** siehe Abschnitt TOM.

---

## Verarbeitungstätigkeit 2: Einsatz- und Schichtplanung

**Zweck:** Erfassung der Verfügbarkeiten, Erstellung und Veröffentlichung der
Wochenpläne, Zuordnung zu Standorten.

**Rechtsgrundlage:** § 26 Abs. 1 BDSG

**Datenkategorien:** Verfügbarkeitsangaben je Tag und Zeitfenster,
Schichtzuweisungen, Center-Zuordnung, Wochenstunden-Limits.

**Empfänger:** intern (Administration, zuständige Regionalleitung)

**Löschfrist:** [DAUER_PLANUNG], Vorschlag 3 Jahre

---

## Verarbeitungstätigkeit 3: Kassenaufzeichnung

**Zweck:** Tägliche Kassenberichte je Standort (offene Ladenkasse),
Karteneinnahmen, Belege der Verkaufslisten.

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. c DSGVO i. V. m. §§ 146, 147 AO,
§ 22 UStG

**Datenkategorien:** Bargeldbestände, Einnahmen, Ausgaben, Einlagen,
Tresor-Umlagerungen, Zeitfenster, erfassende Person, Fotos der Verkaufsliste,
Korrekturbegründungen.

**Besonderheit:** Einträge sind technisch unveränderbar (Trigger in der
Datenbank). Korrekturen erfolgen als neue Einträge mit Verweis und Begründung;
die ursprüngliche Fassung bleibt erhalten. Löschung vor Ablauf der
Aufbewahrungsfrist ist nicht möglich – das ist gesetzlich gefordert und
schränkt das Löschrecht nach Art. 17 Abs. 3 lit. b DSGVO zulässig ein.

**Löschfrist:** 10 Jahre (§ 147 Abs. 3 AO)

---

## Verarbeitungstätigkeit 4: Warenbestellungen

**Zweck:** Nachbestellung von Ware für die Standorte

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO (Betriebsablauf)

**Datenkategorien:** Besteller, Standort, Zeitpunkt, Positionen, Status

**Empfänger:** zuständige Regionalleitung, Lager ([LAGER_EMAIL])

**Löschfrist:** [DAUER_BESTELLUNGEN], Vorschlag 2 Jahre

---

## Verarbeitungstätigkeit 5: Systembetrieb und Protokollierung

**Zweck:** Anmeldung, Nachvollziehbarkeit von Änderungen an Stammdaten,
automatische Erinnerungen an fehlende Verfügbarkeiten

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO

**Datenkategorien:** E-Mail-Adresse, verschlüsseltes Passwort, Zeitstempel,
Änderungsprotokoll (Feld, alter Wert, neuer Wert, ändernde Person)

**Löschfrist:** mit dem Konto; Änderungsprotokoll [DAUER_PROTOKOLL],
Vorschlag 3 Jahre

---

## Auftragsverarbeiter (Art. 28 DSGVO)

| Dienstleister | Leistung | Standort | AVV geschlossen am |
|---|---|---|---|
| Vercel Inc. | Hosting der Anwendung | EU (Frankfurt) | [DATUM_AVV_VERCEL] |
| Supabase Inc. | Datenbank, Authentifizierung, Dateiablage | EU (Frankfurt, AWS) | [DATUM_AVV_SUPABASE] |
| [MAILANBIETER] | Versand von System-E-Mails | [MAIL_STANDORT] | [DATUM_AVV_MAIL] |

---

## Technische und organisatorische Maßnahmen (Art. 32 DSGVO)

**Zutrittskontrolle:** Serverbetrieb ausschließlich in zertifizierten
Rechenzentren der Auftragsverarbeiter innerhalb der EU.

**Zugangskontrolle:** Zugang nur auf Einladung, keine Selbstregistrierung.
Passwortanmeldung mit serverseitiger Verschlüsselung. Zwei-Faktor-
Authentifizierung für Administrationskonten [STATUS_MFA].

**Zugriffskontrolle:** Rollenmodell (Administration / Regionalleitung /
Mitarbeitende) mit Durchsetzung auf Datenbankebene (Row Level Security), nicht
nur in der Oberfläche. Regionalleitungen erhalten eine reduzierte Sicht ohne
Steuer- und Sozialversicherungsdaten. Mitarbeitende sehen ausschließlich die
eigenen Daten.

**Weitergabekontrolle:** Übertragung ausschließlich über TLS-verschlüsselte
Verbindungen. Dokumente liegen in nicht öffentlich zugänglichen Speichern und
werden nur über zeitlich befristete Signaturen ausgeliefert.

**Eingabekontrolle:** Änderungen an Stammdaten werden mit Vorher-/Nachher-Wert
und ändernder Person protokolliert. Kassendaten sind unveränderbar; jede
Korrektur ist als solche erkennbar und begründet.

**Verfügbarkeitskontrolle:** Tägliche Sicherungen durch den Datenbankanbieter
[STATUS_BACKUP]. Wiederherstellung getestet am [DATUM_RESTORE_TEST].

**Trennungskontrolle:** Getrennte Umgebungen für Test und Produktivbetrieb
[STATUS_TRENNUNG].

---

*Stand: [DATUM] · Verantwortlich für die Pflege dieses Verzeichnisses: [INHABER]*
