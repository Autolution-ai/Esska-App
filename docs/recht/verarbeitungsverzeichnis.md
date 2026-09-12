# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

**Internes Dokument – nicht veröffentlichen.** Muss auf Verlangen der
Aufsichtsbehörde vorgelegt werden können. Bei jeder Änderung an der App
aktualisieren.

## Verantwortlicher

**Esska Collection**, Dornblüthstraße 22, 01277 Dresden
Vertreten durch: Jannis Alekhanov
Kontakt Datenschutz: Jannis Alekhanov, esska.app@gmail.com
Datenschutzbeauftragter: nicht bestellt, da die Voraussetzungen des § 38 BDSG nicht vorliegen

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

**Löschfristen:** Lohn-/Steuerunterlagen 10 Jahre; Stammdaten ohne
Beschäftigung [DAUER_BEWERBUNG].

Für die hochgeladenen Dokumente gelten unterschiedliche Regeln – das wird in
der Praxis oft falsch gemacht:

| Dokument | Frist | Grundlage |
|---|---|---|
| Ausweiskopien (deutsch/EU) | **löschen, sobald die Anmeldung erfolgt ist**, spätestens nach Saisonende | keine Aufbewahrungspflicht; Datenminimierung nach Art. 5 Abs. 1 lit. c DSGVO |
| Aufenthaltstitel | Dauer der Beschäftigung | § 4a Abs. 5 AufenthG |
| Immatrikulations-, Schul-, Rentenbescheinigung | bis Ende der Beschäftigung | Nachweiszweck |
| Fotos der Verkaufslisten | 10 Jahre | § 147 Abs. 1 Nr. 4 AO (Buchungsbelege) |

**Offener Punkt:** Ein jährlicher Aufräumlauf, der abgelaufene
Ausweiskopien löscht, ist noch nicht eingerichtet.

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

| Dienstleister | Leistung | Speicherort | Unternehmenssitz | AVV / Transfergrundlage |
|---|---|---|---|---|
| Vercel Inc. | Hosting der Anwendung | EU (Frankfurt) | USA | DPA + SCCs, gilt mit Annahme der Nutzungsbedingungen; Abschluss im Dashboard noch zu bestaetigen |
| Supabase Pte. Ltd. | Datenbank, Authentifizierung, Dateiablage | EU (Frankfurt, AWS) | Singapur | DPA vom 08.09.2026 geprueft, SCCs Modul 2 enthalten (s. u.) |
| Google Ireland Limited (Gmail) | Versand von System-E-Mails | EU und USA | Irland (Konzernmutter USA) | **offen** - privates Google-Konto, kein AVV moeglich; Wechsel zu einem Anbieter mit AVV vor dem Produktivbetrieb |

### Details zum Supabase-DPA (geprueft am 08.09.2026)

- **Vertragspartner:** Supabase Pte. Ltd., 65 Chulia Street #38-02/03,
  OCBC Centre, Singapur 049513. Datenschutzkontakt: privacy@supabase.io
- **Rollen:** Supabase ist Auftragsverarbeiter, Esska ist Verantwortlicher
  (DPA Ziffer 2).
- **Abschluss:** Die Annahme der Supabase-Nutzungsbedingungen gilt zugleich
  als Unterzeichnung der Standardvertragsklauseln (DPA Ziffer 12.2). Eine
  gesonderte Unterschrift ist nicht erforderlich - der Nachweis erfolgt ueber
  die Kontoeroeffnung und diese Dokumentation.
- **Transfergrundlage:** EU-Standardvertragsklauseln (2021/914), **Modul 2**
  (Verantwortlicher an Auftragsverarbeiter). Anwendbares Recht: irisches
  Recht, Gerichtsstand Irland (DPA Schedule 2, Ziffern 1.5 und 1.6).
- **Regionsbindung:** Supabase sichert zu, dass Daten in der vom Kunden
  gewaehlten Region gespeichert und primaer verarbeitet werden (DPA Ziffer
  6.1). Gewaehlte Region: **AWS eu-central-1, Frankfurt**.
- **Unterauftragsverarbeiter:** allgemeine Genehmigung erteilt; Aenderungen
  werden mit 30 Tagen Vorlauf angekuendigt, Widerspruch binnen 5 Tagen
  moeglich (DPA Ziffer 6.2/6.3).
  **TO DO:** Benachrichtigungen abonnieren unter
  https://supabase.com/legal/customer-resources/subprocessor-list
- **Meldung von Sicherheitsvorfaellen:** unverzueglich, nach Moeglichkeit
  binnen 48 Stunden an die im Konto hinterlegte Adresse (DPA Ziffer 10).
  **TO DO:** sicherstellen, dass dort eine gelesene Adresse hinterlegt ist.
- **Loeschung nach Vertragsende:** 30 Tage Frist zum Datenexport, danach
  Loeschung aller Daten (DPA Ziffer 11.2).
- **Sicherungen:** taegliche, verschluesselte Backups (DPA Schedule 1,
  "Availability and backup") - im kostenlosen Tarif jedoch eingeschraenkt.
  Weiteres Argument fuer Supabase Pro.
- **Verschluesselung:** AES-256 im Ruhezustand inkl. Backups, TLS 1.2+ bei
  der Uebertragung (DPA Schedule 1).
- **Pruefrechte:** Zertifikate/Berichte auf Anfrage; eigene Audits einmal
  jaehrlich mit 30 Tagen Vorlauf (DPA Ziffer 9).

**Wichtige Auflage aus dem DPA (Ziffer 4 d):** Fuer besondere Kategorien
personenbezogener Daten (Art. 9 DSGVO) verlangt Supabase vertraglich, dass
der Kunde die Betroffenen informiert und die erforderlichen Einwilligungen
eingeholt hat. In der App betrifft das die **Konfession** (Kirchensteuer)
sowie moegliche Angaben auf hochgeladenen Ausweisdokumenten.

Datenschutzrechtlich stuetzen wir diese Verarbeitung auf § 26 Abs. 3 BDSG
(keine Einwilligung erforderlich). Um die vertragliche Auflage von Supabase
dennoch zu erfuellen, weisen wir in den Datenschutzhinweisen fuer
Beschaeftigte ausdruecklich auf diese Datenkategorien hin und dokumentieren
die Kenntnisnahme. **Mit dem Steuerberater/Anwalt abstimmen.**

---

## Technische und organisatorische Maßnahmen (Art. 32 DSGVO)

**Zutrittskontrolle:** Serverbetrieb ausschließlich in zertifizierten
Rechenzentren der Auftragsverarbeiter innerhalb der EU.

**Zugangskontrolle:** Zugang nur auf Einladung, keine Selbstregistrierung.
Passwortanmeldung mit serverseitiger Verschlüsselung. Zwei-Faktor-
Authentifizierung für Administrationskonten ist derzeit **nicht aktiviert**
(offener Punkt, vor dem Produktivbetrieb einzurichten).

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

**Verfügbarkeitskontrolle:** Zusätzlich zu den Sicherungen des Datenbank-
anbieters wird die Datenbank **täglich automatisch exportiert und mit AES-256
verschlüsselt abgelegt** (GitHub Actions, Aufbewahrung 90 Tage).
Wiederherstellung getestet am: **noch ausstehend** (offener Punkt).

**Trennungskontrolle:** Derzeit wird **eine** Umgebung betrieben; Testdaten
werden vor der ersten echten Einladung vollständig gelöscht. Eine getrennte
Testumgebung ist nicht eingerichtet.

---

*Stand: 12. September 2026 · Verantwortlich für die Pflege dieses Verzeichnisses: Jannis Alekhanov*
