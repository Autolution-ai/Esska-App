-- =====================================================================
-- Esska: Bestellsortiment v2 (Oktober 2026)
--
-- - Reihenfolge wie auf der Verkaufsliste: Stirnbaender, Ohrenwaermer,
--   Handschuhe (Herren, Fell, Normal, Leder), Muetzen, Schals.
-- - Namen und Packgroessen mit Umlauten, so wie sie in der App erscheinen
--   ("10er-Buendel" -> "10er-Bündel").
-- - Muetzen: fuenf Varianten (Beanie, Schirm, Bommel, ohne/mit Bommel) statt nur "Muetzen Bommel". Der Preis gehoert
--   zum Namen, weil er die Variante unterscheidet (14,99 / 24,99).
--
-- Nur aktive Artikel werden angefasst; nichts wird geloescht, weil
-- Bestellpositionen auf die Artikel verweisen. Mehrfach ausfuehrbar.
-- =====================================================================

-- Umbenennen und neu sortieren (alter oder neuer Name, damit ein zweiter
-- Lauf nichts kaputt macht)
update public.bestell_artikel a
set name = v.neu, einheit_label = v.label, sortierung = v.pos
from (values
    ('Stirnbaender',               'Stirnbänder',               '12er-Pack',   10),
    ('Ohrenwaermer',               'Ohrenwärmer',               'Stück',       20),
    ('Handschuhe Herren',          'Handschuhe Herren',         '12er-Pack',   30),
    ('Handschuhe Fell',            'Handschuhe Fell',           '12er-Pack',   31),
    ('Handschuhe Normal',          'Handschuhe Normal',         '12er-Pack',   32),
    ('Leder-Handschuhe',           'Handschuhe Leder',          '12er-Pack',   33),
    ('Muetzen Bommel',             'Mütze Bommel 14,99 €',      'Stück',       42),
    ('Herrenschals',               'Herrenschals',              '10er-Bündel', 50),
    ('Kaschmir-Seide',             'Kaschmir-Seide',            '10er-Bündel', 51),
    ('Kaschmir-Wolle',             'Kaschmir-Wolle',            '10er-Bündel', 52),
    ('Kaschmir-Viskose Bunt',      'Kaschmir-Viskose Bunt',     '6er-Bündel',  53),
    ('Kaschmir-Viskose Einfarbig', 'Kaschmir-Viskose Einfarbig','6er-Bündel',  54)
) as v(alt, neu, label, pos)
where a.aktiv and a.name in (v.alt, v.neu);

-- Neue Muetzen-Varianten
insert into public.bestell_artikel (name, kategorie, farben, einheit_groesse, einheit_label, sortierung)
select v.name, 'Mützen', '{}'::text[], 1, 'Stück', v.pos
from (values
    ('Mütze Beanie 14,99 €',      40),
    ('Mütze Schirm 14,99 €',      41),
    ('Mütze ohne Bommel 24,99 €', 43),
    ('Mütze mit Bommel 24,99 €',  44)
) as v(name, pos)
where not exists (
    select 1 from public.bestell_artikel a where a.name = v.name and a.aktiv
);

-- Korrektur 18.10.: die zweite Variante heisst "Schirm", nicht "Stuermer".
update public.bestell_artikel set name = 'Mütze Schirm 14,99 €'
where aktiv and name = 'Mütze Stürmer 14,99 €';
