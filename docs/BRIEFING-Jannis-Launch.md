# Esska-App: Stand, offene Punkte und Kosten

Briefing für Jannis · Stand 08.09.2026

---

## Kurzfassung in drei Sätzen

Die App ist funktional fertig: Personalakte, Schichtplanung, Kassenerfassung,
Bestellwesen und die Auswertungen für die Buchhaltung laufen. Bevor echte
Mitarbeiterdaten hineingehen, fehlen noch vier Dinge: eine eigene Domain,
zwei bezahlte Tarife für Backups und kommerzielle Nutzung, deine Angaben für
die Rechtstexte und ein letzter Testlauf. **Laufende Kosten danach:
rund 42 € im Monat.**

---

## 1. Was die App heute kann

**Für die Mitarbeiter (auf dem Handy):**
- Digitale Personalakte: Stammdaten, Ausweis und Nachweise hochladen,
  Rentenversicherungs-Befreiung, KuBe-Erklärung – alles ohne Papier
- Verfügbarkeiten für die kommenden Wochen eintragen, inklusive
  Teil-Verfügbarkeit („nur bis 13 Uhr")
- Eigene Schichten einsehen, Monatsstunden im Blick
- Kassenmeldung nach Schichtende: Kasse zählen, App rechnet die Einnahmen
  aus, Foto der Verkaufsliste dazu – ersetzt WhatsApp
- Ware bestellen

**Für dich und die Regionalleitungen:**
- Center verwalten inklusive Öffnungszeiten, Mietzeiträumen und
  Verlängerungen; der Status (geplant/aktiv/beendet) rechnet sich selbst aus
- Schichtplanung mit Warnung, wenn jemand über seine Verfügbarkeit oder sein
  Stundenlimit hinaus eingeplant wird
- Umsatzübersicht aller Center pro Tag, Karteneinnahmen separat erfassbar
- **CSV-Export für den Steuerberater** über beliebige Zeiträume
- Personalstammdaten per Knopfdruck gesammelt an die Buchhaltung schicken
- Automatische Erinnerung samstags an alle, die ihre Verfügbarkeiten noch
  nicht eingetragen haben

**Rechtlich eingebaut:**
- Kassendaten sind unveränderbar (Vorgabe des Finanzamts, GoBD).
  Korrekturen sind möglich, werden aber als solche festgehalten – mit Grund
  und ohne die alte Fassung zu löschen
- Zugriffstrennung in der Datenbank: Regionalleitungen sehen keine Steuer-
  oder Gehaltsdaten, Mitarbeiter sehen nur sich selbst
- Jede Änderung an Stammdaten wird protokolliert

---

## 2. Was noch fehlt

### Deine Entscheidungen (dafür ist das Gespräch da)

| # | Punkt | Warum |
|---|---|---|
| 1 | **Eigene Domain kaufen** | Die App läuft auf einer Test-Adresse. Eine eigene Domain wirkt seriös, ist Voraussetzung für ordentlichen E-Mail-Versand und gehört euch – Anbieter kann man wechseln, die Adresse bleibt. |
| 2 | **Hosting-Konto auf Esska umstellen** | Die Datenbank läuft schon auf Esska. Der Hosting-Zugang läuft noch über Brunos Agentur-Konto. Das sollte übertragen werden, damit Esska unabhängig ist. |
| 3 | **Zwei bezahlte Tarife freigeben** | Der kostenlose Datenbank-Tarif macht **keine Backups** und schaltet sich nach einer Woche Pause ab. Bei Personal- und Kassendaten mit 10 Jahren Aufbewahrungspflicht geht das nicht. Beim Hosting verbietet der Gratis-Tarif die gewerbliche Nutzung. |
| 4 | **Fragebogen beantworten** | Ohne Firmendaten, Steuernummer und Fristen können Impressum und Datenschutzerklärung nicht fertig werden. Ohne die darf die App keine echten Personaldaten verarbeiten. |
| 5 | **Rechtstexte prüfen lassen?** | Die Entwürfe sind fertig und sorgfältig gemacht, aber von keinem Anwalt geprüft. Bei Personaldaten wäre eine einmalige Durchsicht sinnvoll. |
| 6 | **Regionalmanager: angestellt oder nicht?** | Davon hängt ab, ob sie das Onboarding (Personalfragebogen etc.) durchlaufen müssen. |

### Noch benötigte Zulieferungen

- Logo als Bilddatei (für die E-Mails)
- E-Mail-Adresse des Lagers (für die Warenbestellungen)
- Farben für Kaschmir-Seide, -Wolle und -Viskose einfarbig
- Mützen-Varianten und Packungsgröße
- Beispielfoto einer korrekt ausgefüllten Verkaufsliste

### Technische Restarbeiten (macht Bruno, ca. 1–2 Tage)

- Firmendaten in die Rechtstexte einsetzen, Kenntnisnahme im Onboarding
- E-Mail-Versand von Gmail auf einen richtigen Dienst umstellen
  (professioneller Absender, kein Spam-Problem, kostenlos)
- Restliche Punkte aus der Sicherheitsprüfung
- Testdaten löschen, Wiederherstellung aus dem Backup einmal testen

---

## 3. Was es kostet

### Laufend, während des Betriebs

| Posten | Preis | Wofür |
|---|---|---|
| Hosting (Vercel Pro) | 20 USD/Monat ≈ **19 €** | Betrieb der App, gewerbliche Nutzung erlaubt |
| Datenbank (Supabase Pro) | 25 USD/Monat ≈ **23 €** | Tägliche Backups, keine Zwangspause, mehr Speicher |
| Domain | ca. 15 €/Jahr ≈ **1 €** | Eigene Adresse |
| E-Mail-Versand (Resend) | **0 €** | 3.000 E-Mails/Monat kostenlos – wir brauchen weit weniger |
| **Summe** | | **≈ 43 €/Monat** |

*Preise in US-Dollar schwanken mit dem Wechselkurs. Beide Tarife sind
monatlich kündbar.*

### Zwei Varianten für das Jahr

**Variante A – ganzjährig (empfohlen für das erste Jahr):**
rund **515 € im Jahr**. Die App ist jederzeit erreichbar, auch wenn im
Sommer das Finanzamt oder ein ehemaliger Mitarbeiter etwas wissen will.

**Variante B – nur zur Saison (Oktober bis Januar):**
rund **185 € im Jahr**. Nach der Saison werden die Tarife heruntergestuft.
Das spart 330 €, bedeutet aber: Die Daten müssen vorher exportiert und
archiviert werden, und bei Rückfragen im Sommer dauert es einen Tag, bis
alles wieder läuft. Sinnvoll ab dem zweiten Jahr, wenn der Ablauf eingespielt
ist.

### Einmalig

| Posten | Preis |
|---|---|
| Domain-Registrierung | ca. 15 € |
| Anwaltliche Prüfung der Rechtstexte (optional) | ca. 300–800 € |
| Entwicklung | 0 € (Praktikumsprojekt) |

### Zum Vergleich

Eine vergleichbare Software von der Stange (Personalverwaltung +
Schichtplanung + Kassenerfassung) kostet üblicherweise **3–8 € pro
Mitarbeiter und Monat**. Bei 30 Saisonkräften wären das 90–240 € monatlich –
ohne die Anpassungen an eure Abläufe (Kassenzettel-Logik, Center-Zeiträume,
Bestellvorlage), die hier eingebaut sind.

---

## 4. Zeitplan

Bei Saisonstart Ende Oktober ist genug Luft:

| Wann | Was |
|---|---|
| **Diese Woche** | Fragebogen beantworten, Domain festlegen, Tarife freigeben |
| **Nächste Woche** | Bruno: Domain einrichten, Rechtstexte fertigstellen, E-Mail umstellen |
| **2 Wochen vorher** | Erste Testgruppe (Leipzig oder Hamburg) einladen, Onboarding und Verfügbarkeiten mit echten Leuten durchspielen |
| **1 Woche vorher** | Kassenmeldung und Schichtplanung im Echtbetrieb testen, Testdaten löschen |
| **Saisonstart** | Alle Mitarbeiter einladen |

---

## 5. Was du wissen solltest, ohne dass es dich beunruhigen muss

**Die Daten liegen in Frankfurt.** Datenbank und App laufen auf Servern in
Deutschland. Die beiden Anbieterfirmen sitzen allerdings in den USA und in
Singapur – deshalb haben wir mit beiden die EU-Standardvertragsklauseln
vereinbart, die sie auf europäisches Datenschutzniveau verpflichten. Das ist
der übliche Weg und bei jedem großen Anbieter so.

**Die Kassendaten sind bewusst nicht änderbar.** Auch du als Inhaber kannst
einen einmal gespeicherten Kassenbeitrag nicht mehr löschen. Das ist keine
Einschränkung, sondern genau das, was das Finanzamt verlangt – und es
schützt euch bei einer Prüfung.

**Was noch offen ist und mit dem Steuerberater geklärt werden sollte:**
1. Fallen nur 19 % Umsatzsteuer an, oder auch 7 %?
2. Wird der Tresor als eigene Kasse geführt (mit Aufzeichnung, was rein- und
   rausgeht)? Die App dokumentiert, was aus der Ladenkasse in den Tresor
   geht – was danach passiert, liegt außerhalb.
3. Reicht der CSV-Export als Kassenbericht für die offene Ladenkasse? Ein
   Musterexport liegt bereit.

---

## 6. Die drei Fragen, die das Gespräch beantworten sollte

1. **Geben wir die rund 43 € im Monat frei** – und ganzjährig oder nur zur
   Saison?
2. **Welche Domain**, und wer registriert sie?
3. **Soll ein Anwalt einmal über die Rechtstexte schauen** (ca. 300–800 €),
   oder gehen wir mit den geprüften Entwürfen live?
