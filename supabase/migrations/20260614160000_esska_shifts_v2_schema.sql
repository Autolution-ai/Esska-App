-- =====================================================================
-- Esska-App – Wochenplan-Modul mit Slot-Logik (Etappe 2, Refactor)
--
-- Strukturierter Wochenplan im Stil des Esska-Sheets:
-- - Pro Tag und Center genau zwei Slots: Vormittag und Nachmittag
-- - Standardzeiten Vormittag 09:00–15:00, Nachmittag 15:00–20:30
-- - Admin kann je Schicht Zeiten inline anpassen (Override)
-- - Mitarbeiter pflegt pro Slot Wunsch (kann_nicht / koennte / wuensche)
-- - Wochenkontingent (Schichten/Woche) als Soft-Hinweis
--
-- ACHTUNG: Diese Migration loescht bestehende shifts und availabilities
-- (Test-Daten). Center, Mitarbeiter, Umsaetze bleiben unveraendert.
-- =====================================================================

-- 1) Profil-Erweiterung: optionales Schichten-Kontingent pro Woche
alter table public.profiles
    add column if not exists max_schichten_pro_woche integer
        check (max_schichten_pro_woche is null or max_schichten_pro_woche > 0);

-- 2) Slot-Enum (Vormittag / Nachmittag)
do $$
begin
    if not exists (select 1 from pg_type where typname = 'esska_shift_slot') then
        create type esska_shift_slot as enum ('vormittag', 'nachmittag');
    end if;
end$$;

-- 3) Wunsch-Enum (kann nicht / koennte / wuensche)
do $$
begin
    if not exists (select 1 from pg_type where typname = 'esska_wunsch') then
        create type esska_wunsch as enum ('kann_nicht', 'koennte', 'wuensche');
    end if;
end$$;

-- 4) shifts neu strukturieren
drop table if exists public.shifts cascade;

create table public.shifts (
    id uuid primary key default gen_random_uuid(),
    shift_week_id uuid not null references public.shift_weeks(id) on delete cascade,
    center_id uuid not null references public.centers(id) on delete cascade,
    profile_id uuid not null references public.profiles(id) on delete cascade,
    datum date not null,
    slot esska_shift_slot not null,
    start_zeit time not null default '09:00',
    end_zeit time not null default '15:00',
    pause_min integer not null default 0,
    rolle text,
    notiz text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint shifts_zeitfenster check (end_zeit > start_zeit),
    constraint shifts_pause_valid check (pause_min >= 0 and pause_min < 600),
    -- Pro Tag und Center genau eine Person je Slot
    constraint shifts_one_per_slot unique (center_id, datum, slot)
);

create index shifts_week_idx on public.shifts(shift_week_id);
create index shifts_profile_idx on public.shifts(profile_id);
create index shifts_datum_idx on public.shifts(datum);

create trigger shifts_set_updated_at
before update on public.shifts
for each row execute function public.set_updated_at();

alter table public.shifts enable row level security;

create policy shifts_select on public.shifts
    for select using (
        public.is_admin()
        or (
            profile_id = auth.uid()
            and exists (
                select 1 from public.shift_weeks sw
                where sw.id = shifts.shift_week_id and sw.veroeffentlicht
            )
        )
    );

create policy shifts_modify on public.shifts
    for all using (public.is_admin()) with check (public.is_admin());

-- 5) availabilities neu mit Slot + dreistufigem Wunsch
drop table if exists public.availabilities cascade;
drop type if exists esska_availability cascade;

create table public.availabilities (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id) on delete cascade,
    datum date not null,
    slot esska_shift_slot not null,
    wunsch esska_wunsch not null default 'koennte',
    notiz text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint availabilities_one_per_slot unique (profile_id, datum, slot)
);

create index availabilities_profile_idx on public.availabilities(profile_id);
create index availabilities_datum_idx on public.availabilities(datum);

create trigger availabilities_set_updated_at
before update on public.availabilities
for each row execute function public.set_updated_at();

alter table public.availabilities enable row level security;

create policy availabilities_select on public.availabilities
    for select using (
        profile_id = auth.uid() or public.is_admin()
    );

create policy availabilities_modify on public.availabilities
    for all using (profile_id = auth.uid() or public.is_admin())
    with check (profile_id = auth.uid() or public.is_admin());

-- 6) Helper-View: Schichten je Mitarbeiter pro Woche (zur Limit-Pruefung)
create or replace view public.shifts_per_employee_week as
select
    s.profile_id,
    sw.id as shift_week_id,
    sw.center_id,
    sw.woche_start,
    count(*) as anzahl_schichten,
    sum(extract(epoch from (s.end_zeit - s.start_zeit)) / 3600.0 - (s.pause_min / 60.0)) as netto_stunden
from public.shifts s
join public.shift_weeks sw on sw.id = s.shift_week_id
group by s.profile_id, sw.id, sw.center_id, sw.woche_start;
