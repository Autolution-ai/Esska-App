-- =====================================================================
-- Esska-App – Onboarding-Refactor + Umsatzfotos (Etappe 1+3 Erweiterung)
--
-- 1) Mitarbeiter-Status (Schueler/Student/Berufstaetig/Rentner/Sonstiges)
--    als eigenes Feld, unabhaengig vom arbeitszeit_modell.
--    arbeitszeit_modell bleibt erhalten, wird kuenftig aber vom Admin gepflegt.
-- 2) daily_sales um arbeitszeit_start/end und beleg_foto_path erweitert;
--    betrag_cent wird nullable, weil Mitarbeiter nur Foto+Zeit meldet und
--    Admin den Betrag nach dem Foto nachpflegt.
-- 3) Storage-Bucket fuer Beleg-Fotos mit RLS pro Center-Zuordnung.
-- =====================================================================

-- 1) Aktueller Status-Enum
do $$
begin
    if not exists (select 1 from pg_type where typname = 'esska_aktueller_status') then
        create type esska_aktueller_status as enum (
            'schueler',
            'student',
            'berufstaetig',
            'rentner',
            'sonstiges'
        );
    end if;
end$$;

alter table public.profiles
    add column if not exists aktueller_status esska_aktueller_status,
    add column if not exists aktueller_status_sonstiges text;

-- 2) daily_sales – Beleg-Foto + Arbeitszeit + Betrag optional
alter table public.daily_sales
    add column if not exists arbeitszeit_start time,
    add column if not exists arbeitszeit_ende time,
    add column if not exists beleg_foto_path text;

-- Betrag darf jetzt NULL sein (Admin pflegt spaeter aus dem Foto nach)
alter table public.daily_sales
    alter column betrag_cent drop not null;

-- Vorhandener Check 'betrag_cent >= 0' muss auch NULL erlauben
alter table public.daily_sales
    drop constraint if exists daily_sales_betrag_cent_check;
alter table public.daily_sales
    add constraint daily_sales_betrag_check
        check (betrag_cent is null or betrag_cent >= 0);

-- Arbeitszeit-Konsistenz
alter table public.daily_sales
    drop constraint if exists daily_sales_arbeitszeit_check;
alter table public.daily_sales
    add constraint daily_sales_arbeitszeit_check check (
        (arbeitszeit_start is null and arbeitszeit_ende is null)
        or (arbeitszeit_start is not null and arbeitszeit_ende is not null
            and arbeitszeit_ende > arbeitszeit_start)
    );

-- 3) Storage-Bucket fuer Umsatz-Belegfotos
insert into storage.buckets (id, name, public)
values ('sales-receipts', 'sales-receipts', false)
on conflict (id) do nothing;

-- RLS-Policies fuer Beleg-Fotos:
-- Pfad-Konvention: {center_id}/{datum}/{filename}
-- Lesen: Admin oder Mitarbeiter mit Center-Zuordnung
-- Schreiben: dito
do $$
begin
    if exists (select 1 from pg_policies where policyname = 'Esska sales-receipts read') then
        drop policy "Esska sales-receipts read" on storage.objects;
    end if;
    if exists (select 1 from pg_policies where policyname = 'Esska sales-receipts insert') then
        drop policy "Esska sales-receipts insert" on storage.objects;
    end if;
    if exists (select 1 from pg_policies where policyname = 'Esska sales-receipts delete') then
        drop policy "Esska sales-receipts delete" on storage.objects;
    end if;
end$$;

create policy "Esska sales-receipts read"
on storage.objects for select
using (
    bucket_id = 'sales-receipts'
    and (
        public.is_admin()
        or exists (
            select 1 from public.center_assignments ca
            where ca.profile_id = auth.uid()
              and ca.center_id::text = (storage.foldername(name))[1]
        )
    )
);

create policy "Esska sales-receipts insert"
on storage.objects for insert
with check (
    bucket_id = 'sales-receipts'
    and (
        public.is_admin()
        or exists (
            select 1 from public.center_assignments ca
            where ca.profile_id = auth.uid()
              and ca.center_id::text = (storage.foldername(name))[1]
        )
    )
);

create policy "Esska sales-receipts delete"
on storage.objects for delete
using (
    bucket_id = 'sales-receipts'
    and (
        public.is_admin()
        or exists (
            select 1 from public.center_assignments ca
            where ca.profile_id = auth.uid()
              and ca.center_id::text = (storage.foldername(name))[1]
        )
    )
);
