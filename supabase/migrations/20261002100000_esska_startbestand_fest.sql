-- =====================================================================
-- Esska: Startbestand wird uebernommen und ist fest
--
-- Vorgabe (Oktober 2026): Der Startbestand einer Kassenmeldung wird nicht
-- mehr eingetippt, sondern aus der letzten Meldung desselben Centers
-- uebernommen - und kann nicht geaendert werden. Kein Warnhinweis bei
-- Abweichungen, sondern gar keine Abweichung mehr moeglich.
--
--   Startbestand = Endbestand der letzten Meldung
--                  minus das, was danach in den Tresor gelegt wurde
--
-- "Letzte Meldung" heisst: letzte gueltige (nicht durch eine Korrektur
-- ersetzte) Meldung dieses Centers vor dem eigenen Datum und Zeitfenster.
-- Bei zwei Schichten am Tag uebernimmt die Spaet- von der Fruehschicht,
-- nach einem geschlossenen Sonntag kommt der Wert vom Samstag.
--
-- Fuer die allererste Meldung eines Centers traegt der Admin einmal den
-- Anfangsbestand am Center ein.
--
-- Der Wert wird im Trigger GESETZT, nicht nur geprueft: Was der Browser
-- schickt, wird ueberschrieben. Damit laesst er sich auch mit technischen
-- Mitteln nicht veraendern. Die Einnahmen werden aus demselben Grund
-- serverseitig neu berechnet.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Anfangsbestand je Center
-- ---------------------------------------------------------------------
alter table public.centers
    add column if not exists anfangsbestand_cent bigint;

alter table public.centers
    drop constraint if exists centers_anfangsbestand_valid;
alter table public.centers
    add constraint centers_anfangsbestand_valid
    check (anfangsbestand_cent is null or anfangsbestand_cent >= 0);

comment on column public.centers.anfangsbestand_cent is
    'Kassenbestand zur allerersten Meldung des Centers (Saisonstart). '
    'Danach wird der Startbestand immer aus der Vormeldung uebernommen.';

-- ---------------------------------------------------------------------
-- 2) Vorgaenger ermitteln
--
-- Liefert genau eine Zeile: entweder die letzte gueltige Meldung oder,
-- falls es keine gibt, den Anfangsbestand des Centers. Gibt es beides
-- nicht, kommt keine Zeile zurueck.
--
-- "ausser" schliesst einen Eintrag aus - noetig bei Korrekturen, damit
-- die zu ersetzende Meldung nicht ihr eigener Vorgaenger wird.
--
-- security invoker: Mitarbeiter sehen per RLS ohnehin alle Meldungen
-- ihrer Center; mehr gibt die Funktion nicht preis.
-- ---------------------------------------------------------------------
create or replace function public.kasse_vorgaenger(
    cid uuid,
    d date,
    von time,
    ausser uuid default null
)
returns table (betrag_cent bigint, quelle text, vom_datum date, vom_zeit time)
language sql
stable
security invoker
set search_path = public
as $$
    select betrag_cent, quelle, vom_datum, vom_zeit
    from (
        (
            select
                s.endbestand_cent - coalesce(s.abschoepfung_cent, 0) as betrag_cent,
                'meldung'::text  as quelle,
                s.datum          as vom_datum,
                s.umsatz_start   as vom_zeit,
                1                as rang
            from public.daily_sales s
            where s.center_id = cid
              and s.endbestand_cent is not null
              and (ausser is null or s.id <> ausser)
              -- nur gueltige Fassungen: nicht durch eine Korrektur ersetzt
              and not exists (
                  select 1 from public.daily_sales k
                  where k.korrigiert_eintrag_id = s.id
              )
              and (
                  s.datum < d
                  or (s.datum = d
                      and coalesce(s.umsatz_start, time '00:00')
                          <= coalesce(von, time '23:59:59'))
              )
            order by s.datum desc, s.umsatz_start desc nulls last, s.erfasst_am desc
            limit 1
        )
        union all
        (
            select c.anfangsbestand_cent, 'anfangsbestand', null::date, null::time, 2
            from public.centers c
            where c.id = cid and c.anfangsbestand_cent is not null
        )
    ) kandidaten
    order by rang
    limit 1;
$$;

revoke execute on function public.kasse_vorgaenger(uuid, date, time, uuid) from anon;
grant execute on function public.kasse_vorgaenger(uuid, date, time, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3) Trigger: Startbestand und Einnahmen serverseitig setzen
--
-- Uebernimmt die bisherigen Pruefungen unveraendert (Urheberschaft aus
-- der Session, Korrektur nur desselben Centers und Tages, mit Grund).
-- ---------------------------------------------------------------------
create or replace function public.daily_sales_vor_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    ziel record;
    v_start bigint;
begin
    -- Urheberschaft immer aus der Session, nie aus der Eingabe
    if auth.uid() is not null then
        new.erfasst_von := auth.uid();
    end if;

    if new.korrigiert_eintrag_id is not null then
        select center_id, datum, startbestand_cent into ziel
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

        -- Eine Korrektur betrifft dieselbe Schicht: Sie hat mit demselben
        -- Geld angefangen wie die Meldung, die sie ersetzt.
        v_start := ziel.startbestand_cent;
        if v_start is null then
            select betrag_cent into v_start
            from public.kasse_vorgaenger(new.center_id, new.datum, new.umsatz_start,
                                         new.korrigiert_eintrag_id);
        end if;
    else
        select betrag_cent into v_start
        from public.kasse_vorgaenger(new.center_id, new.datum, new.umsatz_start);
    end if;

    if v_start is null then
        raise exception
            'Fuer dieses Center ist noch kein Anfangsbestand hinterlegt. '
            'Bitte wende dich an die Verwaltung.'
            using errcode = 'check_violation';
    end if;

    new.startbestand_cent := v_start;

    if new.endbestand_cent is not null then
        new.einnahmen_cent := new.endbestand_cent - v_start
                              + coalesce(new.ausgaben_cent, 0)
                              - coalesce(new.einlagen_cent, 0);
        if new.einnahmen_cent < 0 then
            raise exception
                'Die berechneten Einnahmen waeren negativ. '
                'Bitte Endbestand, Ausgaben und Einlagen noch einmal pruefen.'
                using errcode = 'check_violation';
        end if;
    end if;

    return new;
end;
$$;

-- Trigger selbst bleibt bestehen (zeigt bereits auf diese Funktion);
-- zur Sicherheit neu anlegen, falls er fehlt.
drop trigger if exists daily_sales_vor_insert_trigger on public.daily_sales;
create trigger daily_sales_vor_insert_trigger
before insert on public.daily_sales
for each row execute function public.daily_sales_vor_insert();

revoke execute on function public.daily_sales_vor_insert() from anon, authenticated;
