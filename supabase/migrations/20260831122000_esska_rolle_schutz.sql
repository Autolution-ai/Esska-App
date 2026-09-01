-- =====================================================================
-- Esska-App - Schutz der Felder role und aktiv
--
-- Schliesst eine Luecke aus dem Core-Schema (dort als "separate
-- Folge-Migration" angekuendigt, aber nie umgesetzt): Die RLS-Policy
-- profiles_update_own_or_admin erlaubt jedem Nutzer das Aendern des
-- EIGENEN Profils - und damit bisher auch des role-Felds. Ein
-- Mitarbeiter haette sich per direktem API-Aufruf selbst zum Admin
-- machen koennen.
--
-- Der Trigger blockiert Aenderungen an role und aktiv fuer alle ausser
-- Admins und dem Server (Service-Role). Alle uebrigen Profilfelder
-- bleiben fuer die Person selbst aenderbar (Stammdaten-Pflege).
-- =====================================================================

create or replace function public.profiles_schutz_role_aktiv()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (new.role is distinct from old.role or new.aktiv is distinct from old.aktiv) then
        if not (public.is_admin() or (select auth.role()) = 'service_role') then
            raise exception
                'Rolle und Aktiv-Status koennen nur von einem Admin geaendert werden.'
                using errcode = 'insufficient_privilege';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists profiles_schutz_role_aktiv_trigger on public.profiles;
create trigger profiles_schutz_role_aktiv_trigger
before update on public.profiles
for each row execute function public.profiles_schutz_role_aktiv();
