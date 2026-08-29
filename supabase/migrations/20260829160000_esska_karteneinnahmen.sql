-- =====================================================================
-- Esska-App - Kassenbericht: Karteneinnahmen
--
-- Neues Feld karteneinnahmen_cent: die Kartenumsaetze der Schicht laut
-- Tagesabschluss (Z-Bericht) des Kartenterminals. Der Mitarbeiter liest
-- die eine Summe vom Terminal ab und traegt sie ein.
--
-- Die Unveraenderbarkeits-Trigger (GoBD) gelten automatisch mit - sie
-- blockieren UPDATE/DELETE auf der ganzen Zeile, egal welche Spalte.
-- =====================================================================

alter table public.daily_sales
    add column if not exists karteneinnahmen_cent bigint;

alter table public.daily_sales
    drop constraint if exists daily_sales_bargeld_check;
alter table public.daily_sales
    add constraint daily_sales_bargeld_check check (
        (startbestand_cent is null or startbestand_cent >= 0)
        and (einnahmen_cent is null or einnahmen_cent >= 0)
        and (ausgaben_cent is null or ausgaben_cent >= 0)
        and (endbestand_cent is null or endbestand_cent >= 0)
        and (abschoepfung_cent is null or abschoepfung_cent >= 0)
        and (karteneinnahmen_cent is null or karteneinnahmen_cent >= 0)
    );
