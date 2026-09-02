-- =====================================================================
-- Esska-App - Bestellwesen: Packgroessen + echtes Sortiment (B-2)
--
-- Grundlage: "Bestellung Vorlage 26/27" von Jannis. Bestellt wird in
-- Einheiten (12er-Pack, 10er-/6er-Buendel, Stueck) - die App zeigt das
-- Label an und rechnet nicht um.
--
-- Noch offen laut Vorlage: Farben fuer Kaschmir-Seide/-Wolle/-Viskose
-- Einfarbig ("-> Farben") und die Muetzen-Varianten - traegt der Admin
-- nach, sobald Jannis liefert (farben-Array bzw. neue Artikel).
-- =====================================================================

alter table public.bestell_artikel
    add column if not exists einheit_groesse integer not null default 1,
    add column if not exists einheit_label text not null default 'Stueck';

-- Platzhalter aus der Struktur-Migration deaktivieren (nicht loeschen,
-- falls schon Bestellungen darauf verweisen)
update public.bestell_artikel
set aktiv = false
where name in ('Schal Cashmere Wolle', 'Schal Cashmere Viskose', 'Ohrenwaermer')
  and kategorie in ('Cashmere Wolle', 'Cashmere Viskose', 'Ohrenwaermer');

-- Echtes Sortiment (idempotent ueber den Namen)
insert into public.bestell_artikel (name, kategorie, farben, einheit_groesse, einheit_label, sortierung)
select * from (values
    ('Stirnbaender',                 'Stirnbaender', '{}'::text[], 12, '12er-Pack',   10),
    ('Handschuhe Herren',            'Handschuhe',   '{}'::text[], 12, '12er-Pack',   20),
    ('Handschuhe Fell',              'Handschuhe',   '{}'::text[], 12, '12er-Pack',   21),
    ('Handschuhe Normal',            'Handschuhe',   '{}'::text[], 12, '12er-Pack',   22),
    ('Leder-Handschuhe',             'Handschuhe',   '{}'::text[], 12, '12er-Pack',   23),
    ('Muetzen Bommel',               'Muetzen',      '{}'::text[],  1, 'Stueck',      30),
    ('Herrenschals',                 'Schals',       '{}'::text[], 10, '10er-Buendel', 40),
    ('Kaschmir-Seide',               'Schals',       '{}'::text[], 10, '10er-Buendel', 41),
    ('Kaschmir-Wolle',               'Schals',       '{}'::text[], 10, '10er-Buendel', 42),
    ('Kaschmir-Viskose Bunt',        'Schals',       '{}'::text[],  6, '6er-Buendel',  43),
    ('Kaschmir-Viskose Einfarbig',   'Schals',       '{}'::text[],  6, '6er-Buendel',  44),
    ('Ohrenwaermer',                 'Ohrenwaermer',
        '{Schwarz,Beige,Braun,Weiss,Grau,Pink,Rot,Lila,Blau}'::text[], 1, 'Stueck',   50)
) as v(name, kategorie, farben, einheit_groesse, einheit_label, sortierung)
where not exists (
    select 1 from public.bestell_artikel a where a.name = v.name and a.aktiv
);
