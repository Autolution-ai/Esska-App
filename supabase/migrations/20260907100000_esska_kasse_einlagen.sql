-- =====================================================================
-- Esska-App - Kassenbericht: Einlagen ergaenzen
--
-- Der Kassenbericht einer offenen Ladenkasse rechnet rueckwaerts:
--   Einnahmen = Endbestand - Startbestand + Ausgaben - Einlagen
--
-- Bisher fehlten die EINLAGEN: Geld, das waehrend der Schicht IN die
-- Kasse gelegt wird (z. B. Wechselgeld-Nachschub aus dem Tresor).
-- Ohne dieses Feld wuerde eine Einlage faelschlich als Einnahme
-- gezaehlt - die gemeldeten Umsaetze waeren zu hoch.
--
-- Die Spalte abschoepfung_cent bleibt technisch bestehen; im UI und im
-- CSV-Export heisst sie jetzt "In den Tresor gelegt", weil genau das
-- gemeint ist (Umlagerung Ladenkasse -> Tresor, keine Privatentnahme).
-- =====================================================================

alter table public.daily_sales
    add column if not exists einlagen_cent bigint;

alter table public.daily_sales
    drop constraint if exists daily_sales_bargeld_check;
alter table public.daily_sales
    add constraint daily_sales_bargeld_check check (
        (startbestand_cent is null or startbestand_cent >= 0)
        and (einnahmen_cent is null or einnahmen_cent >= 0)
        and (ausgaben_cent is null or ausgaben_cent >= 0)
        and (einlagen_cent is null or einlagen_cent >= 0)
        and (endbestand_cent is null or endbestand_cent >= 0)
        and (abschoepfung_cent is null or abschoepfung_cent >= 0)
        and (karteneinnahmen_cent is null or karteneinnahmen_cent >= 0)
    );
