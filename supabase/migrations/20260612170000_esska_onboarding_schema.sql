-- =====================================================================
-- Esska-App – Onboarding-Schema (Etappe 1, Teil 2)
--
-- Tabellen fuer KuBe-Statuserklaerung, Rentenversicherungs-Befreiung
-- und Mitarbeiter-Dokumente (Ausweis, Bescheinigungen).
-- Storage-Bucket fuer Datei-Uploads mit RLS pro User.
-- =====================================================================

-- ----------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------
create type esska_kube_begrenzung as enum ('3_monate', '70_arbeitstage');

create type esska_kube_status as enum (
    'schueler',
    'student',
    'azubi',
    'arbeitnehmer_teilzeit',
    'arbeitnehmer_vollzeit',
    'selbststaendig',
    'rentner',
    'hausfrau_hausmann',
    'arbeitssuchend',
    'freiwilligendienst',
    'schulentlassen_ausbildung',
    'schulentlassen_studium',
    'schulentlassen_freiwilligendienst',
    'sonstiges'
);

create type esska_kube_lebensunterhalt as enum (
    'hauptbeschaeftigung',
    'studium_schule',
    'ausbildung',
    'rente',
    'selbststaendigkeit',
    'unterhalt_familie',
    'sonstiges'
);

create type esska_kube_alg_leistung as enum ('sgb_iii', 'sgb_ii', 'keine');

create type esska_dokument_typ as enum (
    'ausweis_vorderseite',
    'ausweis_rueckseite',
    'aufenthaltsgenehmigung',
    'immatrikulation',
    'schulbescheinigung',
    'rentenbescheid',
    'gewerbeanmeldung',
    'sonstiges'
);

-- ----------------------------------------------------------------------
-- kube_declarations – Statuserklaerung zur kurzfristigen Beschaeftigung
-- (pro Saison neu auszufuellen)
-- ----------------------------------------------------------------------
create table public.kube_declarations (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id) on delete cascade,
    saison text not null,

    begrenzung esska_kube_begrenzung not null,

    erwerbsstatus esska_kube_status not null,
    erwerbsstatus_sonstiges text,
    bafoeg_bezug boolean,
    aktueller_arbeitgeber text,
    aktueller_verdienst_eur_cent bigint,
    arbeitslosen_leistung esska_kube_alg_leistung,

    lebensunterhalt esska_kube_lebensunterhalt not null,
    lebensunterhalt_sonstiges text,

    monate_ueber_geringfuegigkeit integer[] default array[]::integer[],
    weitere_kurzfristige_beschaeftigungen jsonb default '[]'::jsonb,

    erklaerung_zeitgrenze boolean not null default false,
    erklaerung_nichtberufsmaessig boolean not null default false,
    verpflichtung_mitteilung boolean not null default false,
    nachweis_zustimmung boolean not null default false,

    unterzeichnet_am timestamptz,
    unterzeichnet_ip text,
    unterzeichnet_ort text,
    unterschrift_minderjaehriger_vorhanden boolean default false,

    pdf_path text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint kube_one_per_profile_saison unique (profile_id, saison)
);

create index kube_declarations_profile_idx on public.kube_declarations(profile_id);
create index kube_declarations_saison_idx on public.kube_declarations(saison);

create trigger kube_declarations_set_updated_at
before update on public.kube_declarations
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------
-- pension_exemptions – Befreiung von der Rentenversicherungspflicht
-- ----------------------------------------------------------------------
create table public.pension_exemptions (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id) on delete cascade,
    rentenversicherungsnummer text not null,
    merkblatt_zur_kenntnis_genommen boolean not null default false,
    unterzeichnet_am timestamptz,
    unterzeichnet_ip text,
    unterzeichnet_ort text,
    pdf_path text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index pension_exemptions_profile_idx on public.pension_exemptions(profile_id);

create trigger pension_exemptions_set_updated_at
before update on public.pension_exemptions
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------
-- employee_documents – hochgeladene Nachweise (Ausweis, Bescheinigungen)
-- ----------------------------------------------------------------------
create table public.employee_documents (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id) on delete cascade,
    dokument_typ esska_dokument_typ not null,
    storage_path text not null,
    hochgeladen_von uuid not null references public.profiles(id),
    hochgeladen_am timestamptz not null default now(),
    gueltig_bis date,
    notiz text
);

create index employee_documents_profile_idx on public.employee_documents(profile_id);

-- ----------------------------------------------------------------------
-- Storage-Bucket fuer Mitarbeiter-Dokumente
-- ----------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('employee-documents', 'employee-documents', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------

-- kube_declarations
alter table public.kube_declarations enable row level security;

create policy kube_select on public.kube_declarations
    for select using (
        profile_id = auth.uid() or public.is_admin()
    );

create policy kube_insert on public.kube_declarations
    for insert with check (
        profile_id = auth.uid() or public.is_admin()
    );

create policy kube_update on public.kube_declarations
    for update using (
        profile_id = auth.uid() or public.is_admin()
    ) with check (
        profile_id = auth.uid() or public.is_admin()
    );

create policy kube_delete on public.kube_declarations
    for delete using (public.is_admin());

-- pension_exemptions
alter table public.pension_exemptions enable row level security;

create policy pension_select on public.pension_exemptions
    for select using (
        profile_id = auth.uid() or public.is_admin()
    );

create policy pension_insert on public.pension_exemptions
    for insert with check (
        profile_id = auth.uid() or public.is_admin()
    );

create policy pension_update on public.pension_exemptions
    for update using (
        profile_id = auth.uid() or public.is_admin()
    ) with check (
        profile_id = auth.uid() or public.is_admin()
    );

create policy pension_delete on public.pension_exemptions
    for delete using (public.is_admin());

-- employee_documents
alter table public.employee_documents enable row level security;

create policy emp_docs_select on public.employee_documents
    for select using (
        profile_id = auth.uid() or public.is_admin()
    );

create policy emp_docs_insert on public.employee_documents
    for insert with check (
        profile_id = auth.uid() or public.is_admin()
    );

create policy emp_docs_delete on public.employee_documents
    for delete using (
        profile_id = auth.uid() or public.is_admin()
    );

-- Storage: nur eigener Ordner oder Admin
create policy "Esska employee-documents read"
on storage.objects for select
using (
    bucket_id = 'employee-documents'
    and (
        (storage.foldername(name))[1] = auth.uid()::text
        or public.is_admin()
    )
);

create policy "Esska employee-documents insert"
on storage.objects for insert
with check (
    bucket_id = 'employee-documents'
    and (
        (storage.foldername(name))[1] = auth.uid()::text
        or public.is_admin()
    )
);

create policy "Esska employee-documents delete"
on storage.objects for delete
using (
    bucket_id = 'employee-documents'
    and (
        (storage.foldername(name))[1] = auth.uid()::text
        or public.is_admin()
    )
);
