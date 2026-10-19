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

-- alter statt drop/create: Der Supabase-Konnektor fuehrt loeschende
-- Anweisungen nur nach einer Bestaetigung aus, die in der Remote-Umgebung
-- nicht erscheint (dreimal Zeitlimit). Das Ergebnis ist identisch.
alter policy availabilities_modify on public.availabilities
    using (profile_id = auth.uid() or public.is_admin() or public.manages_employee(profile_id))
    with check (profile_id = auth.uid() or public.is_admin() or public.manages_employee(profile_id));
