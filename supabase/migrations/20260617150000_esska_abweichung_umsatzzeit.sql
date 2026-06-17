-- =====================================================================
-- Esska-App – Aenderungen 17.06.: Abweichungs-Zeiten + Umsatzzeit
-- =====================================================================

-- availabilities: bei Abweichung (Vormittag bis HH:MM / Nachmittag ab HH:MM)
alter table public.availabilities
    add column if not exists abweichung_bis time,
    add column if not exists abweichung_ab  time;

-- daily_sales: separate Umsatzzeit (zusaetzlich zur Arbeitszeit)
alter table public.daily_sales
    add column if not exists umsatz_start time,
    add column if not exists umsatz_ende  time;

-- Konsistenz: Umsatzzeit-Ende muss nach Start liegen (falls beide gesetzt)
alter table public.daily_sales
    drop constraint if exists daily_sales_umsatzzeit_check;
alter table public.daily_sales
    add constraint daily_sales_umsatzzeit_check check (
        (umsatz_start is null and umsatz_ende is null)
        or (umsatz_start is not null and umsatz_ende is not null
            and umsatz_ende > umsatz_start)
    );
