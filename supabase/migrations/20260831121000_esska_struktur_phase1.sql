-- =====================================================================
-- Esska-App - Struktur Phase 1b: Datenmodell-Erweiterungen
-- (Meeting mit Jannis, 31.08.2026 - Punkte S-2 bis S-10)
--
-- Voraussetzung: 20260831120000_esska_struktur_enums.sql ist eingespielt
-- (neue Enum-Werte 'regionalmanager' und 'in_absprache').
--
-- Inhalt:
--   1. Helper-Funktionen fuer die Regionalmanager-Rolle
--   2. S-2  Center <-> Regionalmanager
--   3. S-4  Oeffnungstage/-zeiten je Center
--   4. S-5  Center-Zeitraeume als Historie (Miete/Betrieb/Verlaengerung)
--   5. S-7  Karteneinnahmen als eigene Admin-Entitaet
--   6. S-8  Bestellungen (Artikelkatalog, Bestellung, Positionen)
--   7. S-9  Audit-Trigger fuer Stammdaten-Aenderungen
--   8. S-10/O-1/O-9/O-16  neue Profil-Felder
--   9. RLS-Erweiterungen fuer die Regionalmanager-Rolle
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Helper-Funktionen
--    SECURITY DEFINER wie is_admin(), damit keine RLS-Rekursion entsteht.
-- ---------------------------------------------------------------------
create or replace function public.is_regionalmanager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select coalesce(
        (select role = 'regionalmanager' from public.profiles where id = auth.uid()),
        false
    );
$$;

-- Ist der aktuelle Nutzer der Manager dieses Centers?
create or replace function public.manages_center(cid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.centers c
        where c.id = cid and c.manager_id = auth.uid()
    );
$$;

-- Betreut der aktuelle Nutzer (als Manager) ein Center, dem dieser
-- Mitarbeiter zugeordnet ist? (fuer Profile/Verfuegbarkeiten)
create or replace function public.manages_employee(pid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1
        from public.center_assignments ca
        join public.centers c on c.id = ca.center_id
        where ca.profile_id = pid and c.manager_id = auth.uid()
    );
$$;

-- ---------------------------------------------------------------------
-- 2) S-2: Manager am Center
-- ---------------------------------------------------------------------
alter table public.centers
    add column if not exists manager_id uuid references public.profiles(id) on delete set null;

create index if not exists centers_manager_idx on public.centers(manager_id);

-- ---------------------------------------------------------------------
-- 3) S-4: Oeffnungstage und -zeiten je Center
--    Ein Datensatz je Center und Wochentag (0 = Montag ... 6 = Sonntag).
--    Fehlt der Datensatz, gelten die Slot-Standardzeiten der App.
-- ---------------------------------------------------------------------
create table if not exists public.center_opening_hours (
    id uuid primary key default gen_random_uuid(),
    center_id uuid not null references public.centers(id) on delete cascade,
    wochentag smallint not null check (wochentag between 0 and 6),
    geoeffnet boolean not null default true,
    oeffnet time,
    schliesst time,
    unique (center_id, wochentag),
    check (schliesst is null or oeffnet is null or schliesst > oeffnet)
);

alter table public.center_opening_hours enable row level security;

-- Lesen duerfen alle Angemeldeten: Mitarbeiter brauchen die Zeiten fuer
-- das Verfuegbarkeitsraster (V-2). Schreiben nur Admin/zustaendiger Manager.
drop policy if exists center_opening_hours_select on public.center_opening_hours;
create policy center_opening_hours_select on public.center_opening_hours
    for select using (auth.uid() is not null);

drop policy if exists center_opening_hours_modify on public.center_opening_hours;
create policy center_opening_hours_modify on public.center_opening_hours
    for all using (public.is_admin() or public.manages_center(center_id))
    with check (public.is_admin() or public.manages_center(center_id));

-- ---------------------------------------------------------------------
-- 4) S-5: Center-Zeitraeume als Historie
--    'miete'         = vertraglicher Zeitraum
--    'betrieb'       = tatsaechlicher Betriebsstart/-ende (C-10)
--    'verlaengerung' = zusaetzlicher Zeitraum nach Vertragsende (C-9)
--    Die bisherigen Felder start_datum/end_datum am Center bleiben als
--    Kurzuebersicht bestehen; massgeblich fuer Status-Berechnung und
--    Umsatz-Blackout sind die Zeitraeume.
-- ---------------------------------------------------------------------
create table if not exists public.center_zeitraeume (
    id uuid primary key default gen_random_uuid(),
    center_id uuid not null references public.centers(id) on delete cascade,
    typ text not null check (typ in ('miete', 'betrieb', 'verlaengerung')),
    von date not null,
    bis date,
    notiz text,
    created_at timestamptz not null default now(),
    check (bis is null or bis >= von)
);

create index if not exists center_zeitraeume_center_idx on public.center_zeitraeume(center_id);

alter table public.center_zeitraeume enable row level security;

drop policy if exists center_zeitraeume_select on public.center_zeitraeume;
create policy center_zeitraeume_select on public.center_zeitraeume
    for select using (auth.uid() is not null);

drop policy if exists center_zeitraeume_modify on public.center_zeitraeume;
create policy center_zeitraeume_modify on public.center_zeitraeume
    for all using (public.is_admin() or public.manages_center(center_id))
    with check (public.is_admin() or public.manages_center(center_id));

-- Bestehende Center bekommen ihren Mietzeitraum aus start_/end_datum
insert into public.center_zeitraeume (center_id, typ, von, bis)
select c.id, 'miete', c.start_datum, c.end_datum
from public.centers c
where not exists (
    select 1 from public.center_zeitraeume z
    where z.center_id = c.id and z.typ = 'miete'
);

-- ---------------------------------------------------------------------
-- 5) S-7: Karteneinnahmen als eigene Entitaet (UA-2)
--    Erfasst der Admin selbst (U-5), ein Betrag je Center und Tag.
--    Bewusst aenderbar (kein Storno-Prinzip): Jannis kontrolliert die
--    Werte ohnehin vor der Weitergabe an den Steuerberater; die
--    unveraenderliche Aufzeichnung liegt beim Kartenterminal-Anbieter.
-- ---------------------------------------------------------------------
create table if not exists public.card_revenues (
    id uuid primary key default gen_random_uuid(),
    center_id uuid not null references public.centers(id) on delete cascade,
    datum date not null,
    betrag_cent bigint not null check (betrag_cent >= 0),
    notiz text,
    erfasst_von uuid references public.profiles(id) on delete set null,
    erfasst_am timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (center_id, datum)
);

create trigger card_revenues_updated_at
before update on public.card_revenues
for each row execute function public.set_updated_at();

alter table public.card_revenues enable row level security;

drop policy if exists card_revenues_select on public.card_revenues;
create policy card_revenues_select on public.card_revenues
    for select using (public.is_admin() or public.manages_center(center_id));

drop policy if exists card_revenues_modify on public.card_revenues;
create policy card_revenues_modify on public.card_revenues
    for all using (public.is_admin())
    with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 6) S-8: Bestellungen
-- ---------------------------------------------------------------------
-- Artikelkatalog: pflegt der Admin; Farben je Artikel als Liste, damit
-- Jannis' Sortiment ohne Code-Aenderung eingetragen werden kann (B-2).
create table if not exists public.bestell_artikel (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    kategorie text,
    farben text[] not null default '{}',
    aktiv boolean not null default true,
    sortierung integer not null default 0,
    created_at timestamptz not null default now()
);

alter table public.bestell_artikel enable row level security;

drop policy if exists bestell_artikel_select on public.bestell_artikel;
create policy bestell_artikel_select on public.bestell_artikel
    for select using (auth.uid() is not null);

drop policy if exists bestell_artikel_modify on public.bestell_artikel;
create policy bestell_artikel_modify on public.bestell_artikel
    for all using (public.is_admin()) with check (public.is_admin());

-- Platzhalter-Sortiment, bis Jannis die endgueltige Liste liefert (B-2)
insert into public.bestell_artikel (name, kategorie, farben, sortierung)
select * from (values
    ('Schal Cashmere Wolle',   'Cashmere Wolle',   '{}'::text[], 10),
    ('Schal Cashmere Viskose', 'Cashmere Viskose', '{}'::text[], 20),
    ('Ohrenwaermer',           'Ohrenwaermer',     '{}'::text[], 30)
) as v(name, kategorie, farben, sortierung)
where not exists (select 1 from public.bestell_artikel);

create table if not exists public.bestellungen (
    id uuid primary key default gen_random_uuid(),
    center_id uuid not null references public.centers(id) on delete cascade,
    besteller_id uuid not null references public.profiles(id) on delete cascade,
    status text not null default 'offen' check (status in ('offen', 'weitergeleitet', 'erledigt')),
    notiz text,
    erstellt_am timestamptz not null default now(),
    weitergeleitet_am timestamptz
);

create index if not exists bestellungen_center_idx on public.bestellungen(center_id);

alter table public.bestellungen enable row level security;

-- Sehen: Admin alles, Manager seine Center, Besteller die eigenen
drop policy if exists bestellungen_select on public.bestellungen;
create policy bestellungen_select on public.bestellungen
    for select using (
        public.is_admin()
        or public.manages_center(center_id)
        or besteller_id = auth.uid()
    );

-- Anlegen: jeder Mitarbeiter fuer ein Center, dem er zugeordnet ist (B-1),
-- ausserdem Admin und der zustaendige Manager
drop policy if exists bestellungen_insert on public.bestellungen;
create policy bestellungen_insert on public.bestellungen
    for insert with check (
        besteller_id = auth.uid()
        and (
            public.is_admin()
            or public.manages_center(center_id)
            or exists (
                select 1 from public.center_assignments ca
                where ca.center_id = bestellungen.center_id
                  and ca.profile_id = auth.uid()
            )
        )
    );

-- Status aendern/weiterleiten: Admin und zustaendiger Manager
drop policy if exists bestellungen_update on public.bestellungen;
create policy bestellungen_update on public.bestellungen
    for update using (public.is_admin() or public.manages_center(center_id))
    with check (public.is_admin() or public.manages_center(center_id));

drop policy if exists bestellungen_delete on public.bestellungen;
create policy bestellungen_delete on public.bestellungen
    for delete using (public.is_admin());

create table if not exists public.bestellung_positionen (
    id uuid primary key default gen_random_uuid(),
    bestellung_id uuid not null references public.bestellungen(id) on delete cascade,
    artikel_id uuid not null references public.bestell_artikel(id),
    farbe text,
    menge integer not null check (menge > 0)
);

alter table public.bestellung_positionen enable row level security;

-- Positionen erben die Sichtbarkeit ihrer Bestellung
drop policy if exists bestellung_positionen_select on public.bestellung_positionen;
create policy bestellung_positionen_select on public.bestellung_positionen
    for select using (
        exists (
            select 1 from public.bestellungen b
            where b.id = bestellung_positionen.bestellung_id
              and (public.is_admin() or public.manages_center(b.center_id) or b.besteller_id = auth.uid())
        )
    );

drop policy if exists bestellung_positionen_insert on public.bestellung_positionen;
create policy bestellung_positionen_insert on public.bestellung_positionen
    for insert with check (
        exists (
            select 1 from public.bestellungen b
            where b.id = bestellung_positionen.bestellung_id
              and b.besteller_id = auth.uid()
        )
        or public.is_admin()
    );

drop policy if exists bestellung_positionen_modify on public.bestellung_positionen;
create policy bestellung_positionen_modify on public.bestellung_positionen
    for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists bestellung_positionen_delete on public.bestellung_positionen;
create policy bestellung_positionen_delete on public.bestellung_positionen
    for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- 7) S-9/M-2: Audit-Trigger fuer Stammdaten-Aenderungen
--    Die Tabelle profile_change_log existiert seit dem Core-Schema,
--    wurde aber nie automatisch befuellt. Ab jetzt schreibt ein Trigger
--    bei JEDER Aenderung der Stammdaten-Felder einen Eintrag mit
--    Vorher-/Nachher-Wert - egal ob Mitarbeiter, Admin oder Server die
--    Aenderung macht. Damit ist M-2 (alter Wert ging verloren) behoben.
-- ---------------------------------------------------------------------
create or replace function public.profiles_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    feldname text;
    alt jsonb := to_jsonb(old);
    neu jsonb := to_jsonb(new);
begin
    foreach feldname in array array[
        'vorname', 'nachname', 'geburtsdatum', 'geburtsort', 'geburtsland',
        'staatsangehoerigkeit', 'familienstand',
        'anschrift_strasse', 'anschrift_plz', 'anschrift_ort',
        'telefon_mobil', 'email',
        'eintrittsdatum', 'arbeitszeit_modell', 'aktueller_status',
        'aktueller_status_sonstiges', 'berufstaetig_art',
        'stunden_pro_woche', 'max_schichten_pro_woche',
        'verdienst_monat_eur_cent', 'weitere_beschaeftigungen',
        'sozialleistungen_bezug',
        'rentenversicherungsnummer', 'krankenversicherung_name',
        'krankenversicherung_status', 'rentenversicherung_befreit',
        'steuer_id', 'steuerklasse', 'kinderfreibetrag', 'konfession',
        'notfall_name', 'notfall_beziehung', 'notfall_telefon',
        'role', 'aktiv'
    ]
    loop
        if (alt ->> feldname) is distinct from (neu ->> feldname) then
            insert into public.profile_change_log
                (profile_id, changed_by, feld, alter_wert, neuer_wert)
            values
                (new.id, coalesce(auth.uid(), new.id), feldname,
                 alt ->> feldname, neu ->> feldname);
        end if;
    end loop;
    return new;
end;
$$;

drop trigger if exists profiles_audit_log_trigger on public.profiles;
create trigger profiles_audit_log_trigger
after update on public.profiles
for each row execute function public.profiles_audit_log();

-- ---------------------------------------------------------------------
-- 8) Neue Profil-Felder
--    O-9  Geburtsland (zusaetzlich zu Geburtsort und Staatsangehoerigkeit)
--    O-1  Untergliederung bei Status 'berufstaetig'
--    O-16 Bezieht die Person Sozialleistungen? (Ausschlusskriterium fuer
--         die kurzfristige Beschaeftigung; muss nachweisbar geprueft sein)
-- ---------------------------------------------------------------------
alter table public.profiles
    add column if not exists geburtsland text,
    add column if not exists berufstaetig_art text
        check (berufstaetig_art in ('minijob', 'teilzeit', 'vollzeit')),
    add column if not exists sozialleistungen_bezug boolean;

-- ---------------------------------------------------------------------
-- 9) RLS-Erweiterungen fuer Regionalmanager (R-2)
--    Grundsatz: wie ein Admin, aber begrenzt auf die eigenen Center.
--    Sehen: eigene Center, deren Mitarbeiter, Verfuegbarkeiten, Plaene,
--    Umsaetze. Schreiben: Schichtplanung und Kassenmeldung der eigenen
--    Center. Ausdruecklich NICHT: Onboarding-Dokumente, KuBe- und
--    RV-Formulare anderer - die bleiben Admin und der Person selbst.
-- ---------------------------------------------------------------------

-- centers: bisher durfte JEDER Angemeldete alle Center lesen. Neu:
-- Admin alles; Manager die eigenen; Mitarbeiter die zugeordneten.
drop policy if exists centers_select_authenticated on public.centers;
drop policy if exists centers_select on public.centers;
create policy centers_select on public.centers
    for select using (
        public.is_admin()
        or manager_id = auth.uid()
        or exists (
            select 1 from public.center_assignments ca
            where ca.center_id = centers.id and ca.profile_id = auth.uid()
        )
    );

-- profiles: Manager sehen die Profile der Mitarbeiter ihrer Center
-- (noetig fuer Schichtplanung und Mitarbeiterliste der eigenen Region)
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
    for select using (
        auth.uid() = id
        or public.is_admin()
        or public.manages_employee(id)
    );

-- center_assignments: Manager sehen die Zuordnungen ihrer Center
drop policy if exists center_assignments_select on public.center_assignments;
create policy center_assignments_select on public.center_assignments
    for select using (
        profile_id = auth.uid()
        or public.is_admin()
        or public.manages_center(center_id)
    );

-- availabilities: Manager sehen die Verfuegbarkeiten ihrer Mitarbeiter
drop policy if exists availabilities_select on public.availabilities;
create policy availabilities_select on public.availabilities
    for select using (
        profile_id = auth.uid()
        or public.is_admin()
        or public.manages_employee(profile_id)
    );

-- shift_weeks: Manager planen die Wochen ihrer Center
drop policy if exists shift_weeks_select on public.shift_weeks;
create policy shift_weeks_select on public.shift_weeks
    for select using (
        public.is_admin()
        or public.manages_center(center_id)
        or (
            veroeffentlicht
            and exists (
                select 1 from public.center_assignments ca
                where ca.center_id = shift_weeks.center_id
                  and ca.profile_id = auth.uid()
            )
        )
    );

drop policy if exists shift_weeks_modify on public.shift_weeks;
create policy shift_weeks_modify on public.shift_weeks
    for all using (public.is_admin() or public.manages_center(center_id))
    with check (public.is_admin() or public.manages_center(center_id));

-- shifts: Manager bearbeiten die Schichten ihrer Center
drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts
    for select using (
        public.is_admin()
        or public.manages_center(center_id)
        or (
            profile_id = auth.uid()
            and exists (
                select 1 from public.shift_weeks sw
                where sw.id = shifts.shift_week_id and sw.veroeffentlicht
            )
        )
    );

drop policy if exists shifts_modify on public.shifts;
create policy shifts_modify on public.shifts
    for all using (public.is_admin() or public.manages_center(center_id))
    with check (public.is_admin() or public.manages_center(center_id));

-- daily_sales: Manager sehen und erfassen die Kassenmeldungen
-- ihrer Center (Korrektur-Sperre durch die GoBD-Trigger gilt weiter)
drop policy if exists daily_sales_select on public.daily_sales;
create policy daily_sales_select on public.daily_sales
    for select using (
        public.is_admin()
        or public.manages_center(center_id)
        or exists (
            select 1 from public.center_assignments ca
            where ca.center_id = daily_sales.center_id
              and ca.profile_id = auth.uid()
        )
    );

drop policy if exists daily_sales_insert on public.daily_sales;
create policy daily_sales_insert on public.daily_sales
    for insert with check (
        public.is_admin()
        or public.manages_center(center_id)
        or exists (
            select 1 from public.center_assignments ca
            where ca.center_id = daily_sales.center_id
              and ca.profile_id = auth.uid()
        )
    );
