-- =====================================================================
-- Esska: Rueckkehrer aus der Vorsaison
--
-- Wer letzte Saison schon dabei war, bekommt beim Onboarding einen
-- verkuerzten Personalfragebogen: Steuer-, Sozialversicherungs- und
-- Geburtsdaten liegen dem Lohnbuero vor und werden nicht neu erfragt.
-- Was sich jede Saison aendern kann, bleibt Pflicht (Anschrift, Status,
-- RV-Befreiung, KuBe-Erklaerung, aktuelle Nachweise).
--
-- Gesetzt wird das Feld vom Admin beim Einladen. Ein Mitarbeiter darf es
-- NICHT selbst setzen koennen - sonst koennte sich jeder den vollstaendigen
-- Fragebogen sparen. Deshalb faellt es unter denselben Schutz wie role
-- und aktiv.
-- =====================================================================

alter table public.profiles
    add column if not exists rueckkehrer boolean not null default false;

comment on column public.profiles.rueckkehrer is
    'War in der Vorsaison beschaeftigt: verkuerzter Personalfragebogen. '
    'Nur durch Admin oder Server setzbar.';

create or replace function public.profiles_schutz_role_aktiv()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (new.role is distinct from old.role
        or new.aktiv is distinct from old.aktiv
        or new.rueckkehrer is distinct from old.rueckkehrer) then
        if not (public.is_admin() or (select auth.role()) = 'service_role') then
            raise exception
                'Rolle, Aktiv-Status und Rueckkehrer-Markierung koennen nur von einem Admin geaendert werden.'
                using errcode = 'insufficient_privilege';
        end if;
    end if;
    return new;
end;
$$;

-- Trigger existiert bereits (20260831122000) und zeigt auf diese Funktion.
revoke execute on function public.profiles_schutz_role_aktiv() from anon, authenticated;
