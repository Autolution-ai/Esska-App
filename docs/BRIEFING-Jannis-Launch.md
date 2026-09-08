# Esska-App: Stand, offene Punkte und Kosten

Briefing für Jannis · Stand 08.09.2026

---

## Kurzfassung in drei Sätzen

Die App ist funktional fertig: Personalakte, Schichtplanung, Kassenerfassung,
Bestellwesen und die Auswertungen für die Buchhaltung laufen. Bevor echte
Mitarbeiterdaten hineingehen, fehlen noch vier Dinge: eine eigene Domain,
die Entscheidung über die Tarife, deine Angaben für die Rechtstexte und ein
letzter Testlauf. **Laufende Kosten danach: zwischen 24 und 43 € im Monat,
je nachdem, welche Variante du wählst.**

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
| 5 | **Regionalmanager: angestellt oder nicht?** | Davon hängt ab, ob sie das Onboarding (Personalfragebogen etc.) durchlaufen müssen. |

### Noch benötigte Zulieferungen

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
| E-Mail-Postfach (optional) | **0–3 €** | siehe unten |
| **Summe** | | **≈ 43 €/Monat** |

*Preise in US-Dollar schwanken mit dem Wechselkurs. Beide Tarife sind
monatlich kündbar.*

### Hosting: Bezahlt oder kostenlos?

Der aktuelle Anbieter (Vercel) verlangt für gewerbliche Nutzung 20 USD im
Monat. Es gibt eine ernstzunehmende Alternative: **Netlify**, dessen
kostenloser Tarif gewerbliche Nutzung ausdrücklich erlaubt.

| | Vercel Pro | Netlify (kostenlos) |
|---|---|---|
| Kosten | 20 USD/Monat ≈ 19 € | **0 €** |
| Gewerbliche Nutzung | erlaubt | erlaubt |
| Läuft die App dort? | ja, seit Monaten getestet | ja, nach Umbau |
| Automatische Erinnerungs-E-Mails | eingerichtet | müssen umgebaut werden (halber Tag) |
| Grenzen | keine relevanten | 300 Bau-Minuten und 100 GB Datenverkehr im Monat |

Die genannten Grenzen sind für uns unkritisch: Ein Bauvorgang dauert gut eine
Minute, und der Datenverkehr von 30 Mitarbeitern liegt weit unter der Grenze.
Der Unterschied liegt woanders: Beim kostenlosen Tarif gibt es **keinen
Support**. Fällt etwas aus, gibt es niemanden, den man anrufen kann.

**Ersparnis: rund 225 € im Jahr.**

Zwei mögliche Wege:

- **Jetzt umziehen** – noch sind rund sieben Wochen bis Saisonstart, das
  reicht für Umbau und Test in Ruhe.
- **Diese Saison bei Vercel bleiben, danach umziehen** – das System läuft und
  ist erprobt; ein Wechsel kurz vor der Saison bringt vermeidbares Risiko.

**Empfehlung:** Wenn die Kostenersparnis wichtig ist, jetzt umziehen –
lieber sieben Wochen vor der Saison als mittendrin. Ist Stabilität wichtiger,
diese Saison bezahlt fahren und im Frühjahr wechseln.

### Drei Varianten für das Jahr

**Variante A – alles ganzjährig (empfohlen für das erste Jahr):**
rund **515 € im Jahr**. Die App ist jederzeit voll nutzbar, auch wenn im
Sommer das Finanzamt oder ein ehemaliger Mitarbeiter etwas wissen will.

**Variante B – Hosting und Domain ganzjährig, Datenbank nur zur Saison:**
rund **340 € im Jahr**. Hosting (19 €/Monat) und Domain laufen durch, der
Datenbank-Tarif wird nach der Saison für acht Monate heruntergestuft.
Spart rund 175 €.

**Wichtig dazu:** Ohne Datenbank-Tarif pausiert die Datenbank nach einer
Woche ohne Zugriff. Die App ist dann zwar erreichbar, aber **funktionslos** –
man kann sich nicht anmelden und sieht keine Daten. Die Startseite lädt,
mehr nicht. „Online" heißt in dem Fall also nicht „benutzbar".

Damit das trotzdem sicher ist, muss vor dem Herunterstufen zwingend
passieren:
1. Vollständiger Export der Datenbank **und** der hochgeladenen Dateien
   (Ausweise, Belegfotos – die sind nicht Teil des Datenbank-Exports)
2. Archivierung an einem sicheren Ort bei Esska
3. Alle drei bis vier Monate die Datenbank einmal kurz aufwecken

Der letzte Punkt ist der kritische: Pausierte Projekte im Gratis-Tarif können
nach längerer Inaktivität **gelöscht** werden. Bei einer gesetzlichen
Aufbewahrungspflicht von zehn Jahren wäre das ein ernstes Problem – deshalb
darf das Archiv nicht nur bei Supabase liegen.

**Variante C – alles nur zur Saison:**
rund **185 € im Jahr**, aber die App ist außerhalb der Saison komplett
offline. Nur sinnvoll, wenn im Sommer garantiert niemand darauf zugreifen
muss.

**Variante D – kostenloses Hosting (Netlify) plus Datenbank ganzjährig:**
rund **290 € im Jahr**. Spart das Hosting komplett, behält aber die
Datenbank mit Backups durchgehend – aus meiner Sicht das beste Verhältnis
von Kosten zu Sicherheit, wenn der einmalige Umbau eingeplant wird.

**Empfehlung:** Wenn der Umzug jetzt gemacht wird, ist **Variante D** die
beste Wahl: Die Datenbank – wo die eigentlichen Daten liegen – bleibt
durchgehend gesichert, und beim Hosting wird gespart, wo es keinen
Sicherheitsverlust bedeutet. Wenn kein Umzug gewünscht ist, dann Variante A
im ersten Jahr.

### Zur Frage: Müssen die Fotos aufgehoben werden?

Hier ist wichtig, zwei Arten von Bildern zu unterscheiden – für sie gelten
**gegensätzliche** Regeln:

**Fotos der Verkaufslisten: ja, 10 Jahre aufheben.**
Sie sind Belege zu den Kassenaufzeichnungen und fallen damit unter die
Aufbewahrungspflicht für Buchungsbelege (§ 147 AO). Sie dürfen also weder
gelöscht noch nachträglich verändert werden – deshalb kann in der App auch
nur die Geschäftsführung sie entfernen.

**Ausweiskopien: nein – eher das Gegenteil.**
Für Ausweise gibt es *keine* steuerliche Aufbewahrungspflicht. Der
Arbeitgeber muss die Identität prüfen, nicht die Kopie dauerhaft behalten.
Datenschutzrechtlich gilt sogar: Was nicht mehr gebraucht wird, muss weg.

Eine wichtige Ausnahme: Bei Beschäftigten **ohne deutsche oder EU-Staats-
angehörigkeit** muss die Kopie des Aufenthaltstitels für die Dauer der
Beschäftigung aufbewahrt werden (§ 4a Aufenthaltsgesetz).

**Vorschlag für den Umgang damit:**

| Dokument | Aufbewahren | Danach |
|---|---|---|
| Fotos der Verkaufslisten | 10 Jahre | archivieren |
| Aufenthaltstitel | Dauer der Beschäftigung | löschen |
| Ausweiskopien (deutsch/EU) | bis zur Anmeldung geprüft | **zeitnah löschen**, spätestens nach der Saison |
| Immatrikulations-, Schul- und Rentenbescheinigungen | bis zum Ende der Beschäftigung | löschen |

**Wie werden sie gesichert?** Die tägliche automatische Sicherung umfasst
bisher nur die Datenbank, nicht die Bilddateien. Für die Verkaufslisten-Fotos
– die einzige Kategorie mit echter Aufbewahrungspflicht – richten wir eine
zusätzliche wöchentliche Sicherung ein. Am Saisonende kommt beides
verschlüsselt ins Archiv bei Esska.

### Zur Frage: Sind E-Mail-Adressen bei der Domain dabei?

Hier werden zwei Dinge oft verwechselt, die getrennt zu betrachten sind:

**1. Die App verschickt E-Mails** (Einladungen, Passwort-Reset, Erinnerungen).
Dafür braucht es **kein Postfach**, sondern nur einen Versanddienst, der die
Domain nutzen darf. Wir nehmen **Resend – kostenlos** bis 3.000 E-Mails im
Monat. Eingerichtet wird das über ein paar Einträge bei der Domain, mehr
nicht.

**2. Jemand schreibt an Esska zurück** – etwa auf die Adresse im Impressum.
Dafür braucht es tatsächlich ein Postfach oder eine Weiterleitung. Zwei
Möglichkeiten:

| Lösung | Kosten | Wann sinnvoll |
|---|---|---|
| **E-Mail-Weiterleitung** (z. B. info@esska…de → bestehende Adresse) | meist **0 €**, bei den meisten Anbietern inklusive | Reicht völlig fürs Impressum. Antworten kommen dann aber von der alten Adresse. |
| **Echtes Postfach** | ca. 1–3 €/Monat beim Domain-Anbieter, 6–7 €/Monat bei Google Workspace | Wenn unter der Esska-Adresse auch geantwortet werden soll |

Bei Anbietern wie Checkdomain, IONOS oder Netcup sind Weiterleitungen in
der Regel im Domainpreis enthalten; Postfächer kosten extra. **Vor dem Kauf
kurz prüfen**, ob Weiterleitungen inklusive sind – das ist der einzige Punkt,
der den Preis unterscheidet.

**Empfehlung:** Mit einer Weiterleitung starten (0 €). Ein echtes Postfach
lohnt erst, wenn regelmäßig unter der Firmenadresse kommuniziert wird.

### Einmalig

| Posten | Preis |
|---|---|
| Domain-Registrierung | ca. 15 € |
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

1. **Welche Kostenvariante?** Zur Wahl stehen 515 € (alles ganzjährig
   bezahlt), 340 € (Datenbank nur zur Saison) oder 290 € (kostenloses
   Hosting plus Datenbank ganzjährig) im Jahr.
2. **Welche Domain**, und wer registriert sie?
3. **Sollen wir beim jetzigen Hosting bleiben oder auf einen kostenlosen
   Anbieter wechseln** (spart 19 €/Monat, kostet einmalig einen halben Tag
   Umbau)? Details dazu im Abschnitt „Hosting".
