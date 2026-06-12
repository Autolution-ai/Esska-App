-- =====================================================================
-- Esska-App – Kern-Schema (Etappe 1)
--
-- Legt das Fundament für Rollen, Profile, Center und Zuordnungen an.
-- Sicherheit: jede Tabelle hat RLS aktiv, Default-DENY, explizite Policies.
-- Geld immer in Cent als BIGINT (nie als NUMERIC/Float).
-- =====================================================================

-- ----------------------------------------------------------------------
-- Enum-Typen
-- ----------------------------------------------------------------------
create type esska_role as enum ('admin', 'mitarbeiter');

create type esska_familienstand as enum ('ledig', 'verheiratet', 'geschieden');

create type esska_arbeitszeit_modell as enum ('vollzeit', 'teilzeit', 'minijob', 'kurzfristig');

create type esska_kv_status as enum ('gesetzlich', 'privat');

create type esska_steuerklasse as enum ('I', 'II', 'III', 'IV', 'V', 'VI');

create type esska_konfession as enum ('evangelisch', 'katholisch', 'keine');

create type esska_center_status as enum ('geplant', 'aktiv', 'abgeschlossen');

create type esska_center_kategorie as enum ('A', 'B', 'C');

-- ----------------------------------------------------------------------
-- profiles – ein Profil pro Auth-User
--
-- Wird bei Registrierung über Trigger automatisch erzeugt.
-- Stammdaten-Felder folgen dem Esska-Personalstammdatenblatt 1:1.
-- ----------------------------------------------------------------------
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role esska_role not null default 'mitarbeiter',

    -- Persönliche Daten
    vorname text,
    nachname text,
    geburtsdatum date,
    geburtsort text,
    staatsangehoerigkeit text,
    familienstand esska_familienstand,

    -- Kontakt
    anschrift_strasse text,
    anschrift_plz text,
    anschrift_ort text,
    telefon_mobil text,
    email text,

    -- Beschäftigung
    eintrittsdatum date,
    arbeitszeit_modell esska_arbeitszeit_modell,
    stunden_pro_woche numeric(4,1),
    verdienst_monat_eur_cent bigint,
    weitere_beschaeftigungen text,

    -- Sozialversicherung
    rentenversicherungsnummer text,
    krankenversicherung_name text,
    krankenversicherung_status esska_kv_status,
    rentenversicherung_befreit boolean default false,

    -- Steuerdaten (bei Minijob optional)
    steuer_id text,
    steuerklasse esska_steuerklasse,
    kinderfreibetrag numeric(3,1),
    konfession esska_konfession,

    -- Notfallkontakt
    notfall_name text,
    notfall_beziehung text,
    notfall_telefon text,

    -- Onboarding-Status
    stammdaten_bestaetigt_am timestamptz,
    stammdaten_bestaetigt_ip text,
    onboarding_abgeschlossen boolean not null default false,
    aktiv boolean not null default true,

    -- Audit
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);
create index profiles_aktiv_idx on public.profiles(aktiv);

-- Kinder als separate Tabelle (1:n)
create table public.profile_kinder (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id) on delete cascade,
    name text not null,
    geburtsdatum date not null,
    created_at timestamptz not null default now()
);
create index profile_kinder_profile_idx on public.profile_kinder(profile_id);

-- Änderungs-Protokoll (Datenschutz / Nachvollziehbarkeit)
create table public.profile_change_log (
    id bigserial primary key,
    profile_id uuid not null references public.profiles(id) on delete cascade,
    changed_by uuid not null references public.profiles(id),
    changed_at timestamptz not null default now(),
    feld text not null,
    alter_wert text,
    neuer_wert text
);
create index profile_change_log_profile_idx on public.profile_change_log(profile_id);

-- ----------------------------------------------------------------------
-- centers – Standorte je Saison
-- ----------------------------------------------------------------------
create table public.centers (
    id uuid primary key default gen_random_uuid(),
    saison text not null,                       -- "26/27"
    name text not null,                         -- "Ernst-August-Galerie"
    stadt text not null,
    kuerzel text not null,                      -- "EAGH"
    kategorie esska_center_kategorie not null,
    start_datum date not null,
    end_datum date not null,
    flaeche_position text,                      -- "EG 010 f,g,h,i"
    laenge_m numeric(4,2),
    breite_m numeric(4,2),
    flaeche_qm numeric(6,2),                    -- berechnet, überschreibbar
    mietdauer_tage integer,                     -- berechnet, überschreibbar
    miete_eur_cent bigint not null,
    status esska_center_status not null default 'geplant',
    notiz text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint centers_kuerzel_unique_per_saison unique (saison, kuerzel),
    constraint centers_datum_valid check (end_datum >= start_datum),
    constraint centers_miete_positive check (miete_eur_cent >= 0)
);

create index centers_saison_idx on public.centers(saison);
create index centers_status_idx on public.centers(status);

-- ----------------------------------------------------------------------
-- center_assignments – Mitarbeiter ↔ Center
-- ----------------------------------------------------------------------
create table public.center_assignments (
    id uuid primary key default gen_random_uuid(),
    center_id uuid not null references public.centers(id) on delete cascade,
    profile_id uuid not null references public.profiles(id) on delete cascade,
    rolle_im_center text,                       -- z. B. "Stand-Leitung"
    created_at timestamptz not null default now(),

    constraint center_assignments_unique unique (center_id, profile_id)
);

create index center_assignments_center_idx on public.center_assignments(center_id);
create index center_assignments_profile_idx on public.center_assignments(profile_id);

-- ----------------------------------------------------------------------
-- Trigger: bei Registrierung automatisch Profil anlegen
-- ----------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, role)
    values (new.id, new.email, 'mitarbeiter')
    on conflict (id) do nothing;
    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- ----------------------------------------------------------------------
-- Trigger: updated_at automatisch pflegen
-- ----------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger centers_set_updated_at
before update on public.centers
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------
-- Trigger: Center-Auto-Berechnung (Fläche, Tage) wenn nicht manuell gesetzt
-- ----------------------------------------------------------------------
create or replace function public.centers_autocalc()
returns trigger
language plpgsql
as $$
begin
    if new.flaeche_qm is null and new.laenge_m is not null and new.breite_m is not null then
        new.flaeche_qm := round(new.laenge_m * new.breite_m, 2);
    end if;
    if new.mietdauer_tage is null and new.start_datum is not null and new.end_datum is not null then
        new.mietdauer_tage := (new.end_datum - new.start_datum) + 1;
    end if;
    return new;
end;
$$;

create trigger centers_autocalc_trigger
before insert or update on public.centers
for each row execute function public.centers_autocalc();

-- ----------------------------------------------------------------------
-- Hilfsfunktion: ist der aktuelle User Admin?
--
-- security definer, damit RLS-Policies in derselben Tabelle nicht rekursiv
-- prüfen müssen (vermeidet Endlosschleife auf profiles).
-- ----------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select coalesce(
        (select role = 'admin' from public.profiles where id = auth.uid()),
        false
    );
$$;

-- ----------------------------------------------------------------------
-- Row Level Security – Default-DENY, dann explizit erlauben
-- ----------------------------------------------------------------------

-- profiles
alter table public.profiles enable row level security;

create policy profiles_select_own_or_admin on public.profiles
    for select using (auth.uid() = id or public.is_admin());

create policy profiles_update_own_or_admin on public.profiles
    for update using (auth.uid() = id or public.is_admin())
    with check (auth.uid() = id or public.is_admin());

create policy profiles_insert_admin on public.profiles
    for insert with check (public.is_admin());

create policy profiles_delete_admin on public.profiles
    for delete using (public.is_admin());

-- Wichtig: kein User darf seine eigene Rolle auf 'admin' setzen.
-- Realisiert über Spalten-GRANTS: normale User dürfen role gar nicht ändern.
-- (Wird in separater Folge-Migration ergänzt, sobald Auth-UI steht.)

-- profile_kinder
alter table public.profile_kinder enable row level security;

create policy profile_kinder_select on public.profile_kinder
    for select using (
        profile_id = auth.uid() or public.is_admin()
    );

create policy profile_kinder_modify on public.profile_kinder
    for all using (
        profile_id = auth.uid() or public.is_admin()
    ) with check (
        profile_id = auth.uid() or public.is_admin()
    );

-- profile_change_log
alter table public.profile_change_log enable row level security;

create policy profile_change_log_select on public.profile_change_log
    for select using (
        profile_id = auth.uid() or public.is_admin()
    );

create policy profile_change_log_insert on public.profile_change_log
    for insert with check (
        changed_by = auth.uid()
    );
-- Bewusst kein UPDATE/DELETE: Audit-Log ist append-only.

-- centers
alter table public.centers enable row level security;

create policy centers_select_authenticated on public.centers
    for select using (auth.uid() is not null);

create policy centers_modify_admin on public.centers
    for all using (public.is_admin())
    with check (public.is_admin());

-- center_assignments
alter table public.center_assignments enable row level security;

create policy center_assignments_select on public.center_assignments
    for select using (
        profile_id = auth.uid() or public.is_admin()
    );

create policy center_assignments_modify_admin on public.center_assignments
    for all using (public.is_admin())
    with check (public.is_admin());
