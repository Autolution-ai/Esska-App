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
>    Schicht eine, erkennbar an der Spalte `Zeitfenster`.
>
> Für Rückfragen zu einzelnen Einträgen können wir die zugehörige
> fotografierte Verkaufsliste bereitstellen.

## Aufbau der Datei (20 Spalten)

| Spalte | Inhalt | Pflicht nach § 146 AO / GoBD |
|---|---|---|
| Datum | Tag der Vereinnahmung | ja |
| Center / Kuerzel / Stadt / Saison | Betriebsstätte | nein (betrieblich) |
| Art | `Bargeld` oder `Karte` | ja (Trennung der Zahlarten) |
| Zeitfenster | Schicht von–bis | nein (betrieblich) |
| Startbestand | Kassenbestand zu Schichtbeginn | ja |
| Einnahmen | berechnet, s. u. | ja |
| Ausgaben | aus der Kasse bezahlt | ja |
| Einlagen | in die Kasse gelegt (z. B. Wechselgeld) | ja |
| Endbestand | gezählter Bestand bei Schichtende | ja |
| In_Tresor | Umlagerung Ladenkasse → Tresor | ja (Entnahme) |
| Karteneinnahmen | nur in `Karte`-Zeilen | ja |
| Gueltig | `ja` = maßgeblich, `nein` = ersetzt | ja (Unveränderbarkeit) |
| Erfasst_von | erfassende Person | nein (Prüfungspraxis) |
| Erfasst_am | Zeitpunkt der Erfassung | ja (Zeitnähe) |
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

## Offene Punkte, die mit dem Steuerberater zu klären sind

1. **Umsatzsteuersätze:** Die App erfasst keine Aufteilung nach
   Steuersätzen (§ 22 UStG). Das ist unproblematisch, solange
   ausschließlich 19 % anfallen – bitte einmal bestätigen lassen.
2. **Tresor-Bestandsnachweis:** Die App dokumentiert, was aus der
   Ladenkasse in den Tresor geht. Ob und wie der Tresor selbst als
   Hauptkasse geführt wird (Bank-Einzahlungen, Wechselgeld-Ausgabe),
   liegt ausserhalb der App.
3. **Aufbewahrung:** § 147 AO verlangt 10 Jahre lesbare Verfügbarkeit.
   Empfehlung: nach Saisonende einen vollständigen Export archivieren,
   zusätzlich zu den Backups der Datenbank.
