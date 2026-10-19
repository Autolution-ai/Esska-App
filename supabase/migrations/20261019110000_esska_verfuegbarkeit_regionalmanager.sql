-- =====================================================================
-- Esska: Regionalmanager pflegen Verfuegbarkeiten ihres Teams
--
-- Bisher konnten Regionalmanager die Verfuegbarkeiten ihrer Mitarbeiter
-- nur lesen. Jetzt duerfen sie sie auch eintragen und aendern - z. B.
-- wenn jemand telefonisch durchgibt, wann er kann. Ihre eigene
-- Verfuegbarkeit tragen sie wie alle anderen selbst ein.
--
-- Grenze wie ueberall: nur Mitarbeiter ihrer eigenen Center
-- (manages_employee).
-- =====================================================================

drop policy if exists availabilities_modify on public.availabilities;
create policy availabilities_modify on public.availabilities
    for all
    using (profile_id = auth.uid() or public.is_admin() or public.manages_employee(profile_id))
    with check (profile_id = auth.uid() or public.is_admin() or public.manages_employee(profile_id));
