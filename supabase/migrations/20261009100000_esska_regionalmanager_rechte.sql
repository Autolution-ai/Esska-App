-- =====================================================================
-- Esska: Rechte der Regionalmanager eingrenzen (Oktober 2026)
--
-- Vorgabe des Inhabers - Regionalmanager duerfen, jeweils NUR fuer die
-- Center, an denen sie als Regionalmanager eingetragen sind:
--   - Schichtplan erstellen, Verfuegbarkeiten sehen      -> ja
--   - Mitarbeiteruebersicht                               -> ja
--   - Ware bestellen                                      -> ja
--   - Umsatz selbst eingeben (eigene Schicht)             -> ja
--   - Umsaetze einsehen                                   -> nein
-- Alles andere (Center-Pflege, Karteneinnahmen, Vertraege, Personal-
-- daten) ist dem Admin vorbehalten.
--
-- Wichtigster Punkt: Bisher konnten Regionalmanager die VOLLSTAENDIGEN
-- Profile ihrer Mitarbeiter lesen - inklusive Steuer-ID,
-- Rentenversicherungsnummer, Geburtsdatum und Verdienst. Die reduzierte
-- Sicht galt nur in der Oberflaeche. Jetzt sehen sie fremde Profile nur
-- noch ueber planungsprofile(), die genau die Planungsspalten liefert.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Profile: fremde Profile nur noch fuer Admins direkt lesbar
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
    for select using (auth.uid() = id or public.is_admin());

-- Planungssicht fuer Regionalmanager: dieselben Spalten wie die View
-- profiles_planung (ohne Steuer-ID, RV-Nummer, Geburtsdatum, Adresse,
-- Verdienst), gefiltert auf die Mitarbeiter der eigenen Center.
-- security definer, weil die Tabelle fuer Regionalmanager jetzt gesperrt
-- ist - der Filter in der Funktion ist die Zugriffsregel.
create or replace function public.planungsprofile()
returns setof public.profiles_planung
language sql
stable
security definer
set search_path = public
as $$
    select v.*
    from public.profiles_planung v
    where public.is_admin()
       or v.id = auth.uid()
       or public.manages_employee(v.id);
$$;

revoke execute on function public.planungsprofile() from anon;
grant execute on function public.planungsprofile() to authenticated;

-- ---------------------------------------------------------------------
-- 2) Karteneinnahmen: nur Admin (gehoeren zu "Umsaetze einsehen")
-- ---------------------------------------------------------------------
drop policy if exists card_revenues_select on public.card_revenues;
create policy card_revenues_select on public.card_revenues
    for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3) Center-Pflege nur durch Admin
--    (Oeffnungszeiten, Zeitraeume, verkaufsoffene Sonntage). Lesen
--    bleibt unveraendert, die Schichtplanung braucht die Oeffnungstage.
-- ---------------------------------------------------------------------
drop policy if exists center_opening_hours_modify on public.center_opening_hours;
create policy center_opening_hours_modify on public.center_opening_hours
    for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists center_zeitraeume_modify on public.center_zeitraeume;
create policy center_zeitraeume_modify on public.center_zeitraeume
    for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists center_sonderoeffnungen_modify on public.center_sonderoeffnungen;
create policy center_sonderoeffnungen_modify on public.center_sonderoeffnungen
    for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4) Vertragsbestaetigungen: nur die Person selbst und der Admin
-- ---------------------------------------------------------------------
drop policy if exists vertragsbestaetigungen_select on public.vertragsbestaetigungen;
create policy vertragsbestaetigungen_select on public.vertragsbestaetigungen
    for select using (profile_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- 5) Alte Fotos der Verkaufslisten: nur noch Admin
--    (werden seit Oktober 2026 nicht mehr erfasst; die vorhandenen sind
--    Kassenbelege und gehoeren zu "Umsaetze einsehen")
-- ---------------------------------------------------------------------
drop policy if exists "Esska sales-receipts read" on storage.objects;
create policy "Esska sales-receipts read"
on storage.objects for select
using (bucket_id = 'sales-receipts' and public.is_admin());

-- Unveraendert und bewusst so:
--   - shifts, shift_weeks: Regionalmanager planen ihre Center
--   - availabilities: Regionalmanager sehen Verfuegbarkeiten ihrer Leute
--   - bestellungen: Regionalmanager bestellen fuer ihre Center
--   - daily_sales: Regionalmanager duerfen fuer ihre Center melden und
--     lesen; das Lesen braucht die Kasse fuer den uebernommenen
--     Startbestand. Die Umsatzuebersicht ist in der Oberflaeche gesperrt.
