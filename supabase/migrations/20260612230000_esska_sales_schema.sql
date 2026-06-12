-- =====================================================================
-- Esska-App – Tagesumsaetze je Center (Etappe 3)
--
-- Tagesgenaue Erfassung der Umsaetze pro Center. Cent-Integer fuer
-- praezise Aggregation; pro Center und Tag genau ein Eintrag.
-- =====================================================================

create table public.daily_sales (
    id uuid primary key default gen_random_uuid(),
    center_id uuid not null references public.centers(id) on delete cascade,
    datum date not null,
    betrag_cent bigint not null check (betrag_cent >= 0),
    anzahl_belege integer,
    notiz text,
    erfasst_von uuid not null references public.profiles(id),
    erfasst_am timestamptz not null default now(),
    aktualisiert_am timestamptz not null default now(),
    constraint daily_sales_unique unique (center_id, datum)
);

create index daily_sales_center_idx on public.daily_sales(center_id);
create index daily_sales_datum_idx on public.daily_sales(datum);

create or replace function public.daily_sales_set_updated_at()
returns trigger
language plpgsql as $$
begin
    new.aktualisiert_am = now();
    return new;
end;
$$;

create trigger daily_sales_update_trigger
before update on public.daily_sales
for each row execute function public.daily_sales_set_updated_at();

alter table public.daily_sales enable row level security;

-- Mitarbeiter darf nur eintragen/sehen fuer Center, denen er zugeordnet ist.
-- Bestehende Umsaetze nur fuer Admin aenderbar (Audit-Schutz).
create policy daily_sales_select on public.daily_sales
    for select using (
        public.is_admin()
        or exists (
            select 1 from public.center_assignments ca
            where ca.center_id = daily_sales.center_id
              and ca.profile_id = auth.uid()
        )
    );

create policy daily_sales_insert on public.daily_sales
    for insert with check (
        public.is_admin()
        or exists (
            select 1 from public.center_assignments ca
            where ca.center_id = daily_sales.center_id
              and ca.profile_id = auth.uid()
        )
    );

create policy daily_sales_update_admin on public.daily_sales
    for update using (public.is_admin()) with check (public.is_admin());

create policy daily_sales_delete_admin on public.daily_sales
    for delete using (public.is_admin());
