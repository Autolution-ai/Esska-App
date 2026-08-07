-- =====================================================================
-- Esska-App – Kassenbericht: neue Felder + Unveraenderbarkeit (GoBD)
--
-- TEIL 1: Zwei zusaetzliche Bargeld-Felder
--   einnahmen_cent    – Bareinnahmen der Schicht
--   abschoepfung_cent – aus der Kasse entnommener Betrag (Abschoepfung)
--
-- TEIL 2: Unveraenderbarkeit
--   Kassendaten sind steuerlich relevant (GoBD). Einmal erfasste Eintraege
--   duerfen nicht mehr veraendert oder geloescht werden – auch nicht vom
--   Admin. Korrekturen erfolgen nach dem Storno-Prinzip: ein neuer Eintrag
--   ersetzt den alten, der alte bleibt dauerhaft erhalten und sichtbar.
--
--   Umgesetzt auf zwei Ebenen:
--   a) RLS-Policies: UPDATE und DELETE werden fuer alle Rollen entzogen
--   b) Datenbank-Trigger: blockiert UPDATE/DELETE zusaetzlich hart, damit
--      auch ein Zugriff mit erhoehten Rechten (Service-Key) scheitert
-- =====================================================================

-- ---------------------------------------------------------------------
-- TEIL 1: Neue Felder
-- ---------------------------------------------------------------------
alter table public.daily_sales
    add column if not exists einnahmen_cent    bigint,
    add column if not exists abschoepfung_cent bigint;

alter table public.daily_sales
    drop constraint if exists daily_sales_bargeld_check;
alter table public.daily_sales
    add constraint daily_sales_bargeld_check check (
        (startbestand_cent is null or startbestand_cent >= 0)
        and (einnahmen_cent is null or einnahmen_cent >= 0)
        and (ausgaben_cent is null or ausgaben_cent >= 0)
        and (endbestand_cent is null or endbestand_cent >= 0)
        and (abschoepfung_cent is null or abschoepfung_cent >= 0)
    );

-- ---------------------------------------------------------------------
-- TEIL 2a: Korrektur-Kette statt Ueberschreiben
--
-- Der UNIQUE-Constraint auf (center_id, datum) muss weg: bei einer
-- Korrektur entstehen mehrere Eintraege fuer denselben Tag. Der jeweils
-- neueste (hoechstes erfasst_am) ist der gueltige.
-- ---------------------------------------------------------------------
alter table public.daily_sales
    drop constraint if exists daily_sales_unique;

-- Verweis auf den Eintrag, der hiermit korrigiert wird (NULL = Ersteintrag)
alter table public.daily_sales
    add column if not exists korrigiert_eintrag_id uuid
        references public.daily_sales(id);

-- Optionaler Grund, den der Erfasser bei einer Korrektur angibt
alter table public.daily_sales
    add column if not exists korrektur_grund text;

create index if not exists daily_sales_center_datum_idx
    on public.daily_sales(center_id, datum, erfasst_am desc);

-- ---------------------------------------------------------------------
-- TEIL 2b: Harte Sperre gegen Aenderung und Loeschung
-- ---------------------------------------------------------------------
create or replace function public.daily_sales_immutable()
returns trigger
language plpgsql
as $$
begin
    raise exception
        'Kassenbeitraege sind unveraenderbar (GoBD). Fuer eine Korrektur einen neuen Eintrag mit Verweis auf den alten anlegen.'
        using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists daily_sales_no_update on public.daily_sales;
create trigger daily_sales_no_update
before update on public.daily_sales
for each row execute function public.daily_sales_immutable();

drop trigger if exists daily_sales_no_delete on public.daily_sales;
create trigger daily_sales_no_delete
before delete on public.daily_sales
for each row execute function public.daily_sales_immutable();

-- Der bisherige updated_at-Trigger wuerde beim INSERT nicht stoeren,
-- beim UPDATE aber ohnehin nie greifen. Zur Klarheit entfernen wir ihn.
drop trigger if exists daily_sales_update_trigger on public.daily_sales;

-- ---------------------------------------------------------------------
-- TEIL 2c: RLS – UPDATE/DELETE-Policies entfernen
-- ---------------------------------------------------------------------
drop policy if exists daily_sales_update_admin on public.daily_sales;
drop policy if exists daily_sales_delete_admin on public.daily_sales;

-- SELECT und INSERT bleiben unveraendert bestehen:
--   daily_sales_select  – Admin sieht alles, Mitarbeiter nur eigene Center
--   daily_sales_insert  – dito beim Anlegen
