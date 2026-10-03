-- =====================================================================
-- Esska: Verkaufsoffene Sonntage (Sonderoeffnungen) und Schalfarben
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Sonderoeffnungen je Center
--
-- Die regulaeren Oeffnungstage stehen je Wochentag in
-- center_opening_hours (Sonntag meist geschlossen). Ein verkaufsoffener
-- Sonntag ist dagegen ein einzelnes Datum. Ein Eintrag hier macht den Tag
-- fuer dieses Center geoeffnet - in der Schichtplanung und im
-- Verfuegbarkeitsraster der Mitarbeiter -, egal was fuer den Wochentag
-- hinterlegt ist. Technisch funktioniert das auch fuer andere Tage
-- (z. B. Feiertagsoeffnung).
-- ---------------------------------------------------------------------
create table if not exists public.center_sonderoeffnungen (
    id uuid primary key default gen_random_uuid(),
    center_id uuid not null references public.centers(id) on delete cascade,
    datum date not null,
    oeffnet time,
    schliesst time,
    notiz text,
    created_at timestamptz not null default now(),
    unique (center_id, datum),
    check (schliesst is null or oeffnet is null or schliesst > oeffnet)
);

create index if not exists center_sonderoeffnungen_datum_idx
    on public.center_sonderoeffnungen(datum);

alter table public.center_sonderoeffnungen enable row level security;

-- Lesen wie bei den regulaeren Oeffnungszeiten: alle Angemeldeten, weil
-- das Verfuegbarkeitsraster der Mitarbeiter sie braucht. Schreiben nur
-- Admin und zustaendiger Regionalmanager.
drop policy if exists center_sonderoeffnungen_select on public.center_sonderoeffnungen;
create policy center_sonderoeffnungen_select on public.center_sonderoeffnungen
    for select using (auth.uid() is not null);

drop policy if exists center_sonderoeffnungen_modify on public.center_sonderoeffnungen;
create policy center_sonderoeffnungen_modify on public.center_sonderoeffnungen
    for all using (public.is_admin() or public.manages_center(center_id))
    with check (public.is_admin() or public.manages_center(center_id));

comment on table public.center_sonderoeffnungen is
    'Einzelne zusaetzliche Oeffnungstage je Center, v. a. verkaufsoffene Sonntage.';

-- ---------------------------------------------------------------------
-- 2) Farben fuer Kaschmir-Wolle und Kaschmir-Viskose Einfarbig
--
-- Vorgabe: Farbauswahl wie bei den Ohrenwaermern. Uebernommen wird die
-- aktuelle Farbliste des aktiven Ohrenwaermer-Artikels, damit beide
-- gleich bleiben. Viskose "Bunt" bekommt bewusst keine Farben.
-- Nur setzen, solange noch keine Farben gepflegt sind - eine spaetere
-- Pflege durch den Admin wird nicht ueberschrieben.
-- ---------------------------------------------------------------------
update public.bestell_artikel ziel
set farben = quelle.farben
from (
    select farben from public.bestell_artikel
    where name = 'Ohrenwaermer' and aktiv
    order by created_at
    limit 1
) quelle
where ziel.name in ('Kaschmir-Wolle', 'Kaschmir-Viskose Einfarbig')
  and ziel.aktiv
  and cardinality(ziel.farben) = 0;
