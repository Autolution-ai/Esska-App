-- =====================================================================
-- Esska: Minijob-Vertraege hoechstens 5 Wochenstunden - jetzt fuer alle
-- Rollen, auch Admins (nur der Server ist ausgenommen).
-- Ergaenzt den Schutz-Trigger der Arbeitsvertraege.
-- =====================================================================

create or replace function public.arbeitsvertraege_schutz()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    ist_server boolean := coalesce((select auth.role()) = 'service_role', false);
begin
    if tg_op in ('UPDATE', 'DELETE') and old.unterschrieben_am is not null then
        raise exception 'Unterschriebene Arbeitsverträge sind unveränderbar.'
            using errcode = 'check_violation';
    end if;
    if tg_op = 'DELETE' then
        return old;
    end if;

    if not ist_server then
        if tg_op = 'INSERT' then
            new.erstellt_von := auth.uid();
            new.erstellt_am := now();
        end if;
        -- Unterschrift und Ergebnis darf nur der Server setzen
        if new.unterschrieben_am is not null or new.pdf_pfad is not null
           or new.angaben is not null or new.unterschrift_meta is not null then
            raise exception 'Die Unterschrift kann nur über die App gesetzt werden.'
                using errcode = 'insufficient_privilege';
        end if;
        -- Minijob: hoechstens 5 Wochenstunden
        if new.art = 'minijob'
           and (new.stunden_pro_woche is null or new.stunden_pro_woche > 5) then
            raise exception 'Beim Minijob sind höchstens 5 Wochenstunden möglich.'
                using errcode = 'check_violation';
        end if;
    end if;
    return new;
end;
$$;

revoke execute on function public.arbeitsvertraege_schutz() from anon, authenticated;
