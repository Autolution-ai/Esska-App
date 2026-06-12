-- =====================================================================
-- Esska-App – Verfuegbarkeit & Schichtplan (Etappe 2)
--
-- Modelliert tageweise Verfuegbarkeit pro Mitarbeiter und konkrete
-- Schichten pro Center. Schichten gelten erst als sichtbar fuer den
-- Mitarbeiter, wenn der Wochenplan veroeffentlicht ist.
-- =====================================================================

-- ----------------------------------------------------------------------
-- availabilities – Verfuegbarkeit pro Tag (Mitarbeiter pflegt selbst)
-- ----------------------------------------------------------------------
create type esska_availability as enum (
    'verfuegbar',
    'nicht_verfuegbar',
    'nur_vormittag',
    'nur_nachmittag'
);

create table public.availabilities (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id) on delete cascade,
    datum date not null,
    status esska_availability not null default 'verfuegbar',
    notiz text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint availabilities_one_per_day unique (profile_id, datum)
);

create index availabilities_profile_idx on public.availabilities(profile_id);
create index availabilities_datum_idx on public.availabilities(datum);

create trigger availabilities_set_updated_at
before update on public.availabilities
for each row execute function public.set_updated_at();

alter table public.availabilities enable row level security;

create policy availabilities_select on public.availabilities
    for select using (profile_id = auth.uid() or public.is_admin());

create policy availabilities_modify on public.availabilities
    for all using (profile_id = auth.uid() or public.is_admin())
    with check (profile_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------
-- shift_weeks – Wochenplan-Container je Center
-- Erlaubt "Entwurf vs. veroeffentlicht" auf Wochen-Ebene, statt jede
-- Schicht einzeln freizugeben.
-- ----------------------------------------------------------------------
create table public.shift_weeks (
    id uuid primary key default gen_random_uuid(),
    center_id uuid not null references public.centers(id) on delete cascade,
    woche_start date not null,            -- Montag der Kalenderwoche
    veroeffentlicht boolean not null default false,
    veroeffentlicht_am timestamptz,
    veroeffentlicht_von uuid references public.profiles(id),
    notiz text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint shift_weeks_unique unique (center_id, woche_start)
);

create index shift_weeks_center_idx on public.shift_weeks(center_id);
create index shift_weeks_woche_idx on public.shift_weeks(woche_start);

create trigger shift_weeks_set_updated_at
before update on public.shift_weeks
for each row execute function public.set_updated_at();

alter table public.shift_weeks enable row level security;

-- Mitarbeiter sehen nur veroeffentlichte Wochen ihrer eigenen Center
create policy shift_weeks_select on public.shift_weeks
    for select using (
        public.is_admin()
        or (
            veroeffentlicht
            and exists (
                select 1 from public.center_assignments ca
                where ca.center_id = shift_weeks.center_id
                  and ca.profile_id = auth.uid()
            )
        )
    );

create policy shift_weeks_modify on public.shift_weeks
    for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------
-- shifts – einzelne Schichten
-- ----------------------------------------------------------------------
create table public.shifts (
    id uuid primary key default gen_random_uuid(),
    shift_week_id uuid not null references public.shift_weeks(id) on delete cascade,
    center_id uuid not null references public.centers(id) on delete cascade,
    profile_id uuid not null references public.profiles(id) on delete cascade,
    datum date not null,
    start_zeit time not null,
    end_zeit time not null,
    pause_min integer not null default 0,
    rolle text,                           -- z. B. "Verkauf", "Stand-Leitung"
    notiz text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint shifts_zeitfenster check (end_zeit > start_zeit),
    constraint shifts_pause_valid check (pause_min >= 0 and pause_min < 600)
);

create index shifts_week_idx on public.shifts(shift_week_id);
create index shifts_profile_idx on public.shifts(profile_id);
create index shifts_datum_idx on public.shifts(datum);

create trigger shifts_set_updated_at
before update on public.shifts
for each row execute function public.set_updated_at();

alter table public.shifts enable row level security;

-- Mitarbeiter sieht nur seine eigenen Schichten in veroeffentlichten Wochen
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
