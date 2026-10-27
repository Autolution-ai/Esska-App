-- =====================================================================
-- Esska: Arbeitsvertraege ausfuellen und mit dem Finger unterschreiben
--
-- Je Mitarbeiter ein Vertrag mit den Konditionen, die beim Einladen
-- eingetragen werden (Beginn, Befristung, Stunden, Stundenlohn, Center).
-- Name und Anschrift kommen beim Unterschreiben aus dem Personalfragebogen.
-- Der Server fuellt die Vorlage aus, setzt die Unterschrift ein und legt
-- das fertige PDF ab.
--
-- Unterschrieben = unveraenderbar: kein Aendern, kein Loeschen.
-- Unterschrift, Zeitpunkt und PDF setzt ausschliesslich der Server
-- (service_role) - so laesst sich keine Unterschrift vortaeuschen.
--
-- Ohne drop-Anweisungen, damit der Supabase-Konnektor sie ausfuehren kann.
-- =====================================================================

create table if not exists public.arbeitsvertraege (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id) on delete cascade,
    art esska_arbeitszeit_modell not null,
    center_id uuid references public.centers(id) on delete set null,
    beginn date not null,
    befristet_bis date,
    stunden_pro_woche numeric(4,1),
    stundenlohn_cent bigint,
    erstellt_von uuid references public.profiles(id) on delete set null,
    erstellt_am timestamptz not null default now(),
    -- ab hier nur durch den Server beim Unterschreiben
    unterschrieben_am timestamptz,
    pdf_pfad text,
    angaben jsonb,            -- eingesetzte Angaben zum Zeitpunkt der Unterschrift
    unterschrift_meta jsonb,  -- Nachweis: Geraet/Browser, Vertretung ja/nein
    check (befristet_bis is null or befristet_bis >= beginn),
    check (stundenlohn_cent is null or stundenlohn_cent > 0),
    check (stunden_pro_woche is null or stunden_pro_woche > 0)
);

create index if not exists arbeitsvertraege_profile_idx on public.arbeitsvertraege(profile_id);

-- Hoechstens ein offener (nicht unterschriebener) Vertrag je Person
create unique index if not exists arbeitsvertraege_ein_offener
    on public.arbeitsvertraege(profile_id) where unterschrieben_am is null;

alter table public.arbeitsvertraege enable row level security;

do $$
begin
    if not exists (select 1 from pg_policies where tablename = 'arbeitsvertraege' and policyname = 'arbeitsvertraege_select') then
        create policy arbeitsvertraege_select on public.arbeitsvertraege
            for select using (profile_id = auth.uid() or public.is_admin() or public.manages_employee(profile_id));
    end if;
    -- Konditionen anlegen/aendern: Admin oder zustaendiger Regionalmanager
    -- (solange nicht unterschrieben - siehe Trigger)
    if not exists (select 1 from pg_policies where tablename = 'arbeitsvertraege' and policyname = 'arbeitsvertraege_insert') then
        create policy arbeitsvertraege_insert on public.arbeitsvertraege
            for insert with check (public.is_admin() or public.manages_employee(profile_id));
    end if;
    if not exists (select 1 from pg_policies where tablename = 'arbeitsvertraege' and policyname = 'arbeitsvertraege_update') then
        create policy arbeitsvertraege_update on public.arbeitsvertraege
            for update using (public.is_admin() or public.manages_employee(profile_id))
            with check (public.is_admin() or public.manages_employee(profile_id));
    end if;
    if not exists (select 1 from pg_policies where tablename = 'arbeitsvertraege' and policyname = 'arbeitsvertraege_delete') then
        create policy arbeitsvertraege_delete on public.arbeitsvertraege
            for delete using (public.is_admin());
    end if;
end $$;

create or replace function public.arbeitsvertraege_schutz()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    ist_server boolean := coalesce((select auth.role()) = 'service_role', false);
begin
    if tg_op in ('UPDATE', 'DELETE') and old.unterschrieben_am is not null then
        raise exception 'Unterschriebene Arbeitsverträge sind unveränderbar.'
            using errcode = 'check_violation';
    end if;
    if tg_op = 'DELETE' then
        return old;
    end if;

    if not ist_server then
        if tg_op = 'INSERT' then
            new.erstellt_von := auth.uid();
            new.erstellt_am := now();
        end if;
        -- Unterschrift und Ergebnis darf nur der Server setzen
        if new.unterschrieben_am is not null or new.pdf_pfad is not null
           or new.angaben is not null or new.unterschrift_meta is not null then
            raise exception 'Die Unterschrift kann nur über die App gesetzt werden.'
                using errcode = 'insufficient_privilege';
        end if;
    end if;
    return new;
end;
$$;

-- create or replace trigger: ab PostgreSQL 14, kein drop noetig
create or replace trigger arbeitsvertraege_schutz_trigger
before insert or update or delete on public.arbeitsvertraege
for each row execute function public.arbeitsvertraege_schutz();

revoke execute on function public.arbeitsvertraege_schutz() from anon, authenticated;

-- ---------------------------------------------------------------------
-- Ablage der unterschriebenen Vertraege (personenbezogen, daher eigener
-- privater Bucket - der Vorlagen-Bucket ist fuer alle Angemeldeten lesbar)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('arbeitsvertraege-unterschrieben', 'arbeitsvertraege-unterschrieben', false)
on conflict (id) do nothing;

do $$
begin
    if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'Esska unterschriebene Vertraege lesen') then
        create policy "Esska unterschriebene Vertraege lesen"
        on storage.objects for select
        using (
            bucket_id = 'arbeitsvertraege-unterschrieben'
            and exists (
                select 1 from public.arbeitsvertraege v
                where v.pdf_pfad = storage.objects.name
                  and (v.profile_id = auth.uid() or public.is_admin() or public.manages_employee(v.profile_id))
            )
        );
    end if;
end $$;
-- Hochladen nur durch den Server (service_role), daher keine insert-Regel.
