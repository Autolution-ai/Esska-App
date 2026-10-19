-- =====================================================================
-- Esska: Wann ist ein Regionalmanager fuer ein Center zustaendig?
--
-- Bisher nur, wenn er am Center im Feld "Regionalmanager" steht
-- (centers.manager_id). In der Praxis ordnet die Verwaltung Regional-
-- manager aber wie Mitarbeiter zu ("Center zuordnen" ->
-- center_assignments). Vier von fuenf Regionalmanagern waren so fuer kein
-- einziges Center zustaendig: keine Wochenplaene, keine Mitarbeiter, keine
-- Center beim Anlegen.
--
-- Jetzt zaehlt beides. Die Zuordnung erlaubt ausserdem mehrere
-- Regionalmanager je Center (manager_id nur einen).
--
-- Wichtig: Die Zuordnung macht NUR Regionalmanager zustaendig. Ein
-- Mitarbeiter, der einem Center zugeordnet ist, bekommt dadurch keine
-- Planungsrechte (Pruefung is_regionalmanager()).
--
-- Alle Rechte, die auf manages_center / manages_employee aufbauen,
-- gelten damit automatisch auch fuer zugeordnete Regionalmanager:
-- Wochenplaene und Schichten, Verfuegbarkeiten, Mitarbeiteruebersicht
-- (planungsprofile), Bestellungen, Kassenmeldungen der eigenen Center.
-- =====================================================================

create or replace function public.manages_center(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.centers c
        where c.id = cid and c.manager_id = auth.uid()
    )
    or (
        public.is_regionalmanager()
        and exists (
            select 1 from public.center_assignments ca
            where ca.center_id = cid and ca.profile_id = auth.uid()
        )
    );
$$;

-- Betreut der aktuelle Nutzer ein Center, dem dieser Mitarbeiter
-- zugeordnet ist?
create or replace function public.manages_employee(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.center_assignments ca
        where ca.profile_id = pid and public.manages_center(ca.center_id)
    );
$$;

revoke execute on function public.manages_center(uuid) from anon;
revoke execute on function public.manages_employee(uuid) from anon;
