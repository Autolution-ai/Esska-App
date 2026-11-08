-- =====================================================================
-- Esska: Stundenlohn je Mitarbeiter und Bonus je Schicht
--
-- Nur fuer Admins und zustaendige Regionalmanager sichtbar - NICHT fuer
-- die Mitarbeiter selbst (daher eigene Tabellen statt Spalten an
-- profiles/shifts, die Mitarbeiter lesen duerfen). Regionalmanager sehen
-- und setzen ihren eigenen Lohn/Bonus nicht; das macht ein Admin.
--
-- Ohne drop-Anweisungen, damit der Supabase-Konnektor sie ausfuehren kann.
-- =====================================================================

create table if not exists public.mitarbeiter_lohn (
    profile_id uuid primary key references public.profiles(id) on delete cascade,
    stundenlohn_cent bigint not null check (stundenlohn_cent > 0),
    geaendert_von uuid references public.profiles(id) on delete set null,
    geaendert_am timestamptz not null default now()
);

alter table public.mitarbeiter_lohn enable row level security;

-- Bonus +1 EUR je Stunde (Betrag je Stunde in Cent) auf eine Schicht
create table if not exists public.schicht_zulagen (
    shift_id uuid primary key references public.shifts(id) on delete cascade,
    bonus_cent_pro_stunde bigint not null default 100 check (bonus_cent_pro_stunde > 0),
    gesetzt_von uuid references public.profiles(id) on delete set null,
    gesetzt_am timestamptz not null default now()
);

alter table public.schicht_zulagen enable row level security;

create or replace function public.darf_lohn_sehen(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_admin() or (pid <> auth.uid() and public.manages_employee(pid));
$$;

create or replace function public.darf_zulage_sehen(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_admin() or exists (
        select 1 from public.shifts s
        where s.id = sid and s.profile_id <> auth.uid() and public.manages_center(s.center_id)
    );
$$;

revoke execute on function public.darf_lohn_sehen(uuid) from anon;
revoke execute on function public.darf_zulage_sehen(uuid) from anon;

do $$
begin
    if not exists (select 1 from pg_policies where tablename = 'mitarbeiter_lohn' and policyname = 'mitarbeiter_lohn_alle') then
        create policy mitarbeiter_lohn_alle on public.mitarbeiter_lohn
            for all using (public.darf_lohn_sehen(profile_id))
            with check (public.darf_lohn_sehen(profile_id));
    end if;
    if not exists (select 1 from pg_policies where tablename = 'schicht_zulagen' and policyname = 'schicht_zulagen_alle') then
        create policy schicht_zulagen_alle on public.schicht_zulagen
            for all using (public.darf_zulage_sehen(shift_id))
            with check (public.darf_zulage_sehen(shift_id));
    end if;
end $$;

-- Wer hat geaendert: immer die angemeldete Person
create or replace function public.lohn_zulage_stempel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_table_name = 'mitarbeiter_lohn' then
        new.geaendert_von := auth.uid();
        new.geaendert_am := now();
    else
        new.gesetzt_von := auth.uid();
        new.gesetzt_am := now();
    end if;
    return new;
end;
$$;

create or replace trigger mitarbeiter_lohn_stempel
before insert or update on public.mitarbeiter_lohn
for each row execute function public.lohn_zulage_stempel();

create or replace trigger schicht_zulagen_stempel
before insert or update on public.schicht_zulagen
for each row execute function public.lohn_zulage_stempel();

revoke execute on function public.lohn_zulage_stempel() from anon, authenticated;
