-- =====================================================================
-- Esska-App – Bargeld-Kassenbestand beim Umsatz melden
--
-- Drei Felder je Tageseintrag, alle als Cent-Integer:
--   startbestand_cent  – Bargeld in der Kasse zu Schichtbeginn
--   ausgaben_cent      – Bargeld, das waehrend der Schicht ausgegeben wurde
--   endbestand_cent    – Bargeld in der Kasse zu Schichtende
--
-- Ausschliesslich Bargeld. Kartenzahlungen laufen separat und werden hier
-- bewusst NICHT erfasst.
-- =====================================================================

alter table public.daily_sales
    add column if not exists startbestand_cent bigint,
    add column if not exists ausgaben_cent     bigint,
    add column if not exists endbestand_cent   bigint;

-- Betraege duerfen nicht negativ sein (NULL = noch nicht erfasst)
alter table public.daily_sales
    drop constraint if exists daily_sales_bargeld_check;
alter table public.daily_sales
    add constraint daily_sales_bargeld_check check (
        (startbestand_cent is null or startbestand_cent >= 0)
        and (ausgaben_cent is null or ausgaben_cent >= 0)
        and (endbestand_cent is null or endbestand_cent >= 0)
    );
