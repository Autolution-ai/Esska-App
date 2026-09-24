# Kassenbericht-Export: Hinweise für den Steuerberater

Diese Datei ist die Vorlage für die Begleitzeilen, die bei jeder Übergabe
des CSV-Exports mitgeschickt werden sollten. Der Export entsteht in der
Esska-App unter **Umsätze → Export für die Buchhaltung**.

## Textbaustein für die E-Mail

> anbei der Kassenexport für den Zeitraum TT.MM.JJJJ – TT.MM.JJJJ.
>
> Drei Hinweise zum Aufbau der Datei:
>
> 1. Die Spalte **Art** unterscheidet `Bargeld` und `Karte`. Kartenumsätze
>    stehen als eigene Zeilen und sind nicht Teil der Barkasse.
> 2. Die Spalte **Gueltig** unterscheidet gültige Einträge (`ja`) von
>    Fassungen, die durch eine Korrektur ersetzt wurden (`nein`). Zum
>    Summieren bitte auf `Gueltig = ja` filtern. Die ersetzten Zeilen
>    bleiben aus Gründen der Nachvollziehbarkeit enthalten; der Grund der
>    Korrektur steht in der Spalte `Korrektur_Grund`.
> 3. Pro Tag und Center kann es **mehrere Bargeld-Zeilen** geben – je
>    Schicht eine, in der Reihenfolge ihrer Erfassung. Alle diese Zeilen
>    sind reguläre Einnahmen und werden addiert.
>
> Für Rückfragen zu einzelnen Einträgen können wir die zugehörige
> fotografierte Verkaufsliste bereitstellen.

## Aufbau der Datei (20 Spalten)

| Spalte | Inhalt | Pflicht nach § 146 AO / GoBD |
|---|---|---|
| Datum | Tag der Vereinnahmung | ja |
| Center / Stadt / Saison | Betriebsstätte | nein (betrieblich) |
| Art | `Bargeld` oder `Karte` | ja (Trennung der Zahlarten) |
| Startbestand | Kassenbestand zu Schichtbeginn | ja |
| Einnahmen | berechnet, s. u. | ja |
| Ausgaben | aus der Kasse bezahlt | ja |
| Einlagen | in die Kasse gelegt (z. B. Wechselgeld) | ja |
| Endbestand | gezählter Bestand bei Schichtende | ja |
| In_Tresor | Umlagerung Ladenkasse → Tresor | ja (Entnahme) |
| Karteneinnahmen | nur in `Karte`-Zeilen | ja |
| Gueltig | `ja` = maßgeblich, `nein` = ersetzt | ja (Unveränderbarkeit) |
| Korrektur / Korrektur_Grund | Storno-Kennzeichnung | ja |
| Notiz | frei | nein |

## Rechenweg (offene Ladenkasse)

```
Einnahmen = Endbestand − Startbestand + Ausgaben − Einlagen
```

Die Umlagerung in den Tresor erfolgt erst NACH dem Zählen des Endbestands
und geht deshalb nicht in die Rechnung ein. Sie erklärt aber die Differenz
zum Startbestand des Folgetags:

```
Startbestand (Folgetag) = Endbestand (Vortag) − In_Tresor
```

## Was bewusst nicht in der CSV steht

Drei Angaben werden in der App gespeichert, stehen aber nicht im Export, weil
sie in der täglichen Arbeit mit der Liste nur gestört hätten:

| Angabe | Wozu sie im Prüfungsfall dient |
|---|---|
| Zeitpunkt der Erfassung | Nachweis der zeitnahen Erfassung nach GoBD |
| Erfassende Person | Zuordnung eines Eintrags zu einer Schicht |
| Zeitfenster der Schicht | Unterscheidung mehrerer Meldungen am selben Tag |

Alle drei werden bei jedem Eintrag **unveränderbar** in der Datenbank
festgehalten und lassen sich jederzeit nachliefern – bitte in dem Fall kurz
Bescheid geben.

Gibt es an einem Tag mehrere Meldungen für dasselbe Center (zwei Schichten),
stehen sie in der Reihenfolge ihrer Erfassung untereinander. Welche die
frühere ist, zeigt auch der Rechenweg: Der Startbestand der zweiten Meldung
entspricht dem Endbestand der ersten, abzüglich der Tresor-Umlagerung.

## Offene Punkte, die mit dem Steuerberater zu klären sind

1. **Umsatzsteuersaetze:** Die App erfasst keine Aufteilung nach
   Steuersaetzen (§ 22 UStG). Der Inhaber hat am 12.09.2026 bestaetigt, dass
   **ausschliesslich 19 %** anfallen. Damit ist die fehlende Aufteilung
   unproblematisch. Kommen spaeter Artikel mit 7 % dazu, muss die Erfassung
   erweitert werden.
2. **Tresor-Bestandsnachweis:** Die App dokumentiert, was aus der
   Ladenkasse in den Tresor geht. Ob und wie der Tresor selbst als
   Hauptkasse geführt wird (Bank-Einzahlungen, Wechselgeld-Ausgabe),
   liegt ausserhalb der App.
3. **Aufbewahrung:** § 147 AO verlangt 10 Jahre lesbare Verfügbarkeit.
   Empfehlung: nach Saisonende einen vollständigen Export archivieren,
   zusätzlich zu den Backups der Datenbank.
