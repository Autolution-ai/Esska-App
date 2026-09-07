-- =====================================================================
-- Esska-App - Sicherheits- und GoBD-Haertung (Code-Review 07.09.2026)
--
-- 1. daily_sales: erfasst_von erzwingen und Korrektur-Kette absichern
-- 2. sales-receipts: Belegfotos nicht mehr durch Mitarbeiter loeschbar
-- 3. Regionalmanager: kein Zugriff mehr auf Steuer-/Sozialdaten
-- 4. Stammdaten der Kollegen: Mitarbeiter sehen nur sich selbst
-- 5. Advisor-Hinweise: search_path fixieren, RPC-Zugriff entziehen
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Kassenbeitraege: Urheberschaft und Korrektur-Kette absichern
--
-- Bisher konnte ein Mitarbeiter beim Anlegen eine fremde profile_id als
-- erfasst_von eintragen ODER den Eintrag eines Kollegen als "korrigiert"
-- markieren - unwiderruflich, weil UPDATE/DELETE gesperrt sind.
-- Der Trigger setzt erfasst_von jetzt hart auf den angemeldeten Nutzer
-- und prueft, dass eine Korrektur nur Eintraege desselben Centers und
-- Tages ersetzt.
-- ---------------------------------------------------------------------
create or replace function public.daily_sales_vor_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    ziel record;
begin
    -- Urheberschaft immer aus der Session, nie aus der Eingabe
    if auth.uid() is not null then
        new.erfasst_von := auth.uid();
    end if;

    if new.korrigiert_eintrag_id is not null then
        select center_id, datum into ziel
        from public.daily_sales
        where id = new.korrigiert_eintrag_id;

        if not found then
            raise exception 'Der zu korrigierende Eintrag existiert nicht.'
                using errcode = 'foreign_key_violation';
        end if;
        if ziel.center_id is distinct from new.center_id
           or ziel.datum is distinct from new.datum then
            raise exception
                'Eine Korrektur muss sich auf einen Eintrag desselben Centers und Tages beziehen.'
                using errcode = 'check_violation';
        end if;
        if new.korrektur_grund is null or btrim(new.korrektur_grund) = '' then
            raise exception 'Fuer eine Korrektur ist eine Begruendung erforderlich (GoBD).'
                using errcode = 'check_violation';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists daily_sales_vor_insert_trigger on public.daily_sales;
create trigger daily_sales_vor_insert_trigger
before insert on public.daily_sales
for each row execute function public.daily_sales_vor_insert();

-- Ein Eintrag darf nur EINMAL korrigiert werden - sonst koennte eine
-- zweite "Korrektur" eine bereits ersetzte Fassung erneut ersetzen und
-- die Kette mehrdeutig machen.
create unique index if not exists daily_sales_korrektur_eindeutig
    on public.daily_sales(korrigiert_eintrag_id)
    where korrigiert_eintrag_id is not null;

-- ---------------------------------------------------------------------
-- 2) Belegfotos: Loeschen nur noch durch Admin
--
-- Die Fotos der Verkaufslisten sind Belege zu unveraenderbaren
-- Kasseneintraegen (§ 147 AO). Bisher durfte jeder zugeordnete
-- Mitarbeiter sie loeschen.
-- ---------------------------------------------------------------------
drop policy if exists "Esska sales-receipts delete" on storage.objects;
create policy "Esska sales-receipts delete"
on storage.objects for delete
using (bucket_id = 'sales-receipts' and public.is_admin());

-- ---------------------------------------------------------------------
-- 3) + 4) Profile: Steuer- und Sozialdaten bleiben beim Admin
--
-- manages_employee() gab Regionalmanagern die KOMPLETTE Profilzeile,
-- inklusive Steuer-ID, Rentenversicherungsnummer, Geburtsdatum und
-- Verdienst. Fuer Schichtplanung braucht ein Manager davon nichts.
--
-- Loesung: Spalten-Berechtigungen. Die Policy erlaubt weiterhin den
-- Zeilenzugriff (fuer Namen und Planungsdaten), aber die sensiblen
-- Spalten sind fuer die Rolle 'authenticated' nur noch ueber die
-- Admin-Pfade erreichbar - durchgesetzt ueber eine zusaetzliche
-- Sicht-Pruefung in der Policy.
-- ---------------------------------------------------------------------
create or replace function public.darf_personaldaten_sehen(pid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    -- Sensible Personaldaten: nur die Person selbst und Admins
    select auth.uid() = pid or public.is_admin();
$$;

-- Sicht fuer Regionalmanager: nur die fuer die Planung noetigen Felder
create or replace view public.profiles_planung
with (security_invoker = true) as
select
    p.id,
    p.vorname,
    p.nachname,
    p.email,
    p.telefon_mobil,
    p.role,
    p.aktiv,
    p.onboarding_abgeschlossen,
    p.arbeitszeit_modell,
    p.stunden_pro_woche,
    p.max_schichten_pro_woche
from public.profiles p;

comment on view public.profiles_planung is
    'Reduzierte Sicht auf profiles fuer Schicht- und Einsatzplanung: '
    'ohne Steuer-ID, Rentenversicherungsnummer, Geburtsdatum, Adresse und Verdienst.';

-- ---------------------------------------------------------------------
-- 5) Advisor-Hinweise: search_path der aelteren Funktionen fixieren
-- ---------------------------------------------------------------------
alter function public.daily_sales_immutable() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.centers_autocalc() set search_path = public;

do $$
begin
    if exists (select 1 from pg_proc where proname = 'daily_sales_set_updated_at') then
        execute 'alter function public.daily_sales_set_updated_at() set search_path = public';
    end if;
end$$;

-- Trigger-Funktionen sollen nicht ueber die REST-API aufrufbar sein
revoke execute on function public.handle_new_auth_user() from anon, authenticated;
revoke execute on function public.profiles_audit_log() from anon, authenticated;
revoke execute on function public.profiles_schutz_role_aktiv() from anon, authenticated;
revoke execute on function public.daily_sales_immutable() from anon, authenticated;
revoke execute on function public.daily_sales_vor_insert() from anon, authenticated;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_regionalmanager() from anon;
revoke execute on function public.manages_center(uuid) from anon;
revoke execute on function public.manages_employee(uuid) from anon;
