# Esska-App# Projekt-Briefing: All-in-One-App für Esska Collection

> **Zweck dieses Dokuments:** Dieses Briefing dient als vollständige Kontext- und Auftragsgrundlage für die Planung und Entwicklung der App in Claude Code. Es ist so geschrieben, dass es direkt an ein Planungsmodell (Fabel) übergeben werden kann. Der Auftraggeber (Bruno) hat **keine Vorerfahrung in der App-Entwicklung** – Setup, Architektur und Werkzeugauswahl sind deshalb Teil des Planungsauftrags und müssen erklärt werden, nicht vorausgesetzt.

---

## 1. Der Betrieb

**Esska Collection** ist ein Einzelunternehmen mit Sitz im Raum Dresden. Inhaber und Geschäftsführer ist Jannis Alekhanov, der zugleich alle operativen Aufgaben verantwortet und der betriebliche Betreuer des Praktikanten ist.

Das Geschäftsmodell ist ein reines **Saisongeschäft mit Winterartikeln** (Kaschmir, Pashmina, Schals, Mützen, Strickwaren). Der Verkauf läuft über temporäre Verkaufsflächen (Pop-up-Stände) in deutschen Einkaufszentren – bekannte Standorte sind die Altmarkt-Galerie und Centrum-Galerie in Dresden sowie Flächen in Berlin und Kassel. Die Saison läuft etwa von Mitte/Ende Oktober bis Ende Januar.

Charakteristisch ist damit:

- **Wenige, wechselnde Standorte** (Center), die jährlich neu angemietet und bespielt werden.
- **Saisonales, häufig wechselndes Personal**, das den jeweiligen Centern zugeordnet wird.
- **Eine zentrale Steuerungsperson** (der Inhaber), bei der heute alle Fäden zusammenlaufen.
- **Begrenzte IT-Infrastruktur** – es gibt keine eingespielten digitalen Systeme, kein IT-Personal.

---

## 2. Ausgangslage / Das Problem

Die gesamte operative Steuerung läuft heute **manuell, fragmentiert und personengebunden** über drei Kanäle:

- **Papier** – z. B. handschriftliche Umsatznotizen je Center, Stammdaten, Pläne.
- **Foto** – abfotografierte Notizen und Belege, die per Messenger geteilt werden.
- **WhatsApp** – Kommunikation, Verfügbarkeitsabfragen, Schichtabstimmung, Umsatzmeldungen.

Daraus ergeben sich konkrete Probleme: Informationen liegen verstreut und nicht auswertbar vor, der Inhaber ist Engpass für jede Abstimmung, es gibt keine zentrale und keine historisierte Datenbasis, und Umsatzzahlen lassen sich nicht ohne Weiteres je Center und über die Zeit vergleichen. Die Steuerung hängt vollständig an einer Person und an informellen Kanälen.

---

## 3. Zielbild der App (Endziel)

Eine **All-in-One-App**, die alle bisher manuellen, fragmentierten Saisonprozesse in einer einzigen digitalen Anwendung bündelt. Ziel ist die **Digitalisierung und Zentralisierung** der heute personengebundenen Steuerung – weg von Papier, Foto und WhatsApp, hin zu einer gemeinsamen Datenbasis mit klaren Rollen.

Die App hat **zwei Nutzungsseiten** auf einer gemeinsamen Datenbasis:

### 3.1 Mitarbeiterseite (mobil, Smartphone)

- **Personalstammdatenblatt** in der App pflegen (eigene Stammdaten erfassen und aktualisieren).
- **Center-Zuordnung** einsehen (welchem Standort bin ich zugeordnet).
- **Verfügbarkeit pflegen** (wann kann ich arbeiten – ersetzt die WhatsApp-Abfrage).
- **Veröffentlichte Wochenpläne einsehen** (meine Schichten).

### 3.2 Inhaberseite (Controlling-Tool, Web-Dashboard am Desktop)

- **Jährliche Anlage der Center** (Standorte für die Saison anlegen und verwalten).
- **Zuordnung der Mitarbeiter** zu Centern.
- **Schichtplanung** und Veröffentlichung der Wochenpläne.
- **Tägliches Umsatzreporting je Center** (löst Papier-Notiz, Foto und WhatsApp ab) – inklusive Auswertbarkeit über Zeit und Standort.

### 3.3 Plattform-Entscheidung

Festgelegter Rahmen: **Mitarbeiter nutzen die App mobil auf dem Smartphone, der Inhaber nutzt ein Web-Dashboard am Desktop** – zwei Oberflächen, **eine gemeinsame Datenbasis**. Die konkrete technische Umsetzung dieser Konstellation (native App vs. plattformübergreifendes Framework vs. Progressive Web App mit Dashboard) ist Teil des Planungsauftrags und soll mit Begründung empfohlen werden.

---

## 4. Sicherheit und Datenschutz – höchste Priorität

Dies ist eine **echte Produktiv-App mit echten Mitarbeiter- und Umsatzdaten**. Der Sicherheitsaspekt ist deshalb **nicht optional und nicht nachgelagert**, sondern von Anfang an mitzudenken und in der Architektur zu verankern. Konkret bedeutet das:

- **Personenbezogene Daten** (Personalstammdaten der Mitarbeiter) und **geschäftskritische Daten** (Umsätze je Center) müssen sicher gespeichert und übertragen werden. Es gelten die Anforderungen der **DSGVO**.
- **Sichere Datenspeicherung** ist eine Kernanforderung: verschlüsselte Speicherung sensibler Daten, Verschlüsselung der Datenübertragung (TLS/HTTPS durchgängig), keine Ablage von Klartext-Geheimnissen.
- **Authentifizierung und Autorisierung** mit klarer Rollentrennung: Mitarbeiter sehen und bearbeiten ausschließlich eigene Daten und für sie veröffentlichte Pläne; der Inhaber hat Steuerungs- und Auswertungsrechte. Ein Mitarbeiter darf niemals fremde Stammdaten oder Umsatzdaten anderer Center sehen.
- **Serverstandort und Auftragsverarbeitung**: Bevorzugt Hosting/Datenhaltung in der EU; sofern externe Dienste (z. B. Backend-as-a-Service, Datenbank-Hosting) genutzt werden, ist die DSGVO-Konformität und ein Auftragsverarbeitungsvertrag zu beachten.
- **Sichere Verwaltung von Zugangsdaten und Schlüsseln** (Secrets, API-Keys, Datenbank-Zugänge) – niemals im Quellcode, niemals im öffentlichen Repository.
- **Datensparsamkeit und Löschkonzept**: nur erforderliche Daten erheben; saisonal ausgeschiedene Mitarbeiterdaten müssen gelöscht oder anonymisiert werden können.
- **Backups** der zentralen Datenbasis, damit Umsatzhistorie und Stammdaten nicht verloren gehen.

Das gewählte Setup muss diese Punkte tragen können. Eine Architektur, die Security erst später „nachrüstet", ist ausdrücklich nicht akzeptabel.

---

## 5. Rahmenbedingungen

- **Kein Entwickler-Hintergrund**: Der Auftraggeber baut die App erstmals und braucht ein nachvollziehbar erklärtes Setup. Begriffe, Werkzeuge und Schritte sind zu erläutern, nicht vorauszusetzen.
- **Saisonaler Charakter**: Der reale Einsatz ist an die Wintersaison (Okt–Jan) gebunden. Das beeinflusst, welche Funktionen zuerst gebraucht werden (Center anlegen, Mitarbeiter zuordnen, Verfügbarkeit, Schichtplan, Umsatzreporting).
- **Kleiner Betrieb, wenige Nutzer**: Die Lösung muss nicht für tausende Nutzer skalieren, aber zuverlässig, wartbar und sicher sein. Komplexität ist zu vermeiden, wo sie keinen Mehrwert bringt.
- **Wartbarkeit durch eine Einzelperson**: Das Setup sollte so gewählt sein, dass es von einem Einsteiger gepflegt werden kann.

---

## 6. Auftrag an Fabel (Planungsschritt)

Auf Basis dieses Briefings soll ein **Umsetzungsplan** erstellt werden. Da keine Entwicklungserfahrung vorliegt, muss der Plan besonders auf das *Wie anfangen* und *Worauf achten* eingehen. Erwartet werden:

1. **Empfehlung des technischen Setups** mit Begründung – Frontend (mobil für Mitarbeiter + Web-Dashboard für Inhaber), Backend, Datenbank, Authentifizierung, Hosting. Die Wahl ist an den Rahmenbedingungen aus Abschnitt 4 und 5 zu messen (Security-first, DSGVO/EU, einsteigerfreundlich, wartbar).

2. **Ein passendes GitHub-Starter-Repository finden und vorschlagen**, das als solide, sichere Grundlage für genau diese Art von App dient (z. B. ein gepflegtes Starter-Kit/Boilerplate mit bereits integrierter Authentifizierung, Rollen, sicherer Datenhaltung und sauberer Projektstruktur). Auswahlkriterien: aktiv gepflegt, gute Dokumentation, etablierte Sicherheits-Defaults, geeignet für mobile App + Web-Dashboard auf gemeinsamer Datenbasis, anfängertauglich. Mehrere Optionen kurz gegenüberstellen und eine begründete Empfehlung aussprechen, die dann tatsächlich genutzt werden kann.

3. **Worauf man im Vorfeld achten muss** – die typischen Einsteiger-Fallstricke (Secrets-Verwaltung, Umgang mit personenbezogenen Daten, Rollen/Zugriffsrechte, Datenbank-Migrationen, Backups, Deployment), jeweils mit konkreter Handlungsempfehlung.

4. **Schrittweiser Umsetzungsfahrplan** vom leeren Projekt bis zur ersten lauffähigen Version – in nachvollziehbaren Etappen, mit klarem MVP-Schnitt (welche Funktionen zuerst, welche später).

5. **Sicherheitskonzept als fester Bestandteil des Plans**, nicht als Anhang: Wie werden Daten gespeichert, übertragen, zugriffsgeschützt und gesichert.

---

### Kurzfassung in einem Satz

Gebaut wird eine sichere, DSGVO-konforme All-in-One-App für ein saisonales Einzelhandels-Einzelunternehmen, die die heute über Papier, Foto und WhatsApp verstreute Steuerung von Personal, Schichtplanung und Umsatzreporting auf einer gemeinsamen, zugriffsgeschützten Datenbasis zusammenführt – mobil für die Mitarbeiter, als Web-Dashboard für den Inhaber.
