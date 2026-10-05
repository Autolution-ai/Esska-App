-- =====================================================================
-- Esska: Arbeitsvertraege bestaetigen
--
-- Je Beschaeftigungsart (Minijob, kurzfristig, Werkstudent ...) gibt es
-- eine Vertragsvorlage als PDF. Der Mitarbeiter sieht die Vorlage, die zu
-- seinem Arbeitszeit-Modell passt, und bestaetigt sie per Haken - wie bei
-- einer Datenschutzerklaerung. Danach bleibt der Vertrag in seinem Profil
-- abrufbar.
--
-- Hinweis (ausserhalb der App zu loesen): Die Bestaetigung ist eine
-- Empfangs- und Kenntnisnahmebestaetigung. Die Befristung eines
-- Arbeitsvertrags braucht nach Paragraf 14 Abs. 4 TzBfG weiterhin die
-- Schriftform.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Neue Beschaeftigungsart Werkstudent
--    (Der neue Wert wird in dieser Datei nur angelegt, nicht verwendet -
--    sonst scheitert die Migration in einer Transaktion.)
-- ---------------------------------------------------------------------
alter type esska_arbeitszeit_modell add value if not exists 'werkstudent';

-- ---------------------------------------------------------------------
-- 2) Vorlagen
--    Je Art hoechstens EINE aktive Vorlage. Eine neue Version ersetzt die
--    alte (aktiv = false), geloescht wird nichts: Bestaetigungen verweisen
--    dauerhaft auf genau die Fassung, die bestaetigt wurde.
-- ---------------------------------------------------------------------
create table if not exists public.vertragsvorlagen (
    id uuid primary key default gen_random_uuid(),
    art esska_arbeitszeit_modell not null,
    titel text not null,
    datei_pfad text not null,
    hochgeladen_von uuid references public.profiles(id),
    hochgeladen_am timestamptz not null default now(),
    aktiv boolean not null default true
);

create unique index if not exists vertragsvorlagen_eine_aktive_je_art
    on public.vertragsvorlagen(art) where aktiv;

alter table public.vertragsvorlagen enable row level security;

-- Lesen: alle Angemeldeten (Vorlagen enthalten keine personenbezogenen
-- Daten; der Mitarbeiter braucht seine Vorlage). Schreiben: nur Admin.
drop policy if exists vertragsvorlagen_select on public.vertragsvorlagen;
create policy vertragsvorlagen_select on public.vertragsvorlagen
    for select using (auth.uid() is not null);

drop policy if exists vertragsvorlagen_insert on public.vertragsvorlagen;
create policy vertragsvorlagen_insert on public.vertragsvorlagen
    for insert with check (public.is_admin());

drop policy if exists vertragsvorlagen_update on public.vertragsvorlagen;
create policy vertragsvorlagen_update on public.vertragsvorlagen
    for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 3) Bestaetigungen
--    Nur einfuegen, nie aendern oder loeschen: Sie sind der Nachweis, wer
--    welche Fassung wann bestaetigt hat.
-- ---------------------------------------------------------------------
create table if not exists public.vertragsbestaetigungen (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id) on delete cascade,
    vorlage_id uuid not null references public.vertragsvorlagen(id),
    bestaetigt_am timestamptz not null default now(),
    unique (profile_id, vorlage_id)
);

create index if not exists vertragsbestaetigungen_profile_idx
    on public.vertragsbestaetigungen(profile_id);

alter table public.vertragsbestaetigungen enable row level security;

drop policy if exists vertragsbestaetigungen_select on public.vertragsbestaetigungen;
create policy vertragsbestaetigungen_select on public.vertragsbestaetigungen
    for select using (
        profile_id = auth.uid()
        or public.is_admin()
        or public.manages_employee(profile_id)
    );

-- Bestaetigen kann nur die Person selbst - nicht der Admin fuer sie.
drop policy if exists vertragsbestaetigungen_insert on public.vertragsbestaetigungen;
create policy vertragsbestaetigungen_insert on public.vertragsbestaetigungen
    for insert with check (profile_id = auth.uid());

-- Zeitpunkt kommt immer vom Server, nie aus der Eingabe
create or replace function public.vertragsbestaetigung_vor_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.bestaetigt_am := now();
    return new;
end;
$$;

drop trigger if exists vertragsbestaetigung_vor_insert_trigger on public.vertragsbestaetigungen;
create trigger vertragsbestaetigung_vor_insert_trigger
before insert on public.vertragsbestaetigungen
for each row execute function public.vertragsbestaetigung_vor_insert();

revoke execute on function public.vertragsbestaetigung_vor_insert() from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Ablage der Vorlagen-PDFs
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('arbeitsvertraege', 'arbeitsvertraege', false)
on conflict (id) do nothing;

drop policy if exists "Esska arbeitsvertraege read" on storage.objects;
create policy "Esska arbeitsvertraege read"
on storage.objects for select
using (bucket_id = 'arbeitsvertraege' and auth.uid() is not null);

drop policy if exists "Esska arbeitsvertraege insert" on storage.objects;
create policy "Esska arbeitsvertraege insert"
on storage.objects for insert
with check (bucket_id = 'arbeitsvertraege' and public.is_admin());

-- Kein Loeschen und kein Ueberschreiben: auch alte Fassungen bleiben, weil
-- Bestaetigungen auf sie verweisen.
