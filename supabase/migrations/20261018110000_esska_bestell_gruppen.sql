-- =====================================================================
-- Esska: Bestellartikel gruppieren (Muetzen nach Preis)
--
-- Wunsch: die Muetzen nicht als fuenf einzelne Bloecke, sondern als zwei
-- Gruppen - "Mützen 14,99 €" (Beanie, Schirm, Bommel) und
-- "Mützen 24,99 €" (ohne Bommel, mit Bommel). Jede Variante bleibt ein
-- eigener Artikel mit eigener Menge und eigenem Farb-/Musterwunsch; der
-- volle Name steht weiter in der Bestellmail ans Lager.
--
-- gruppe:   Ueberschrift des Blocks; Artikel ohne gruppe stehen einzeln
-- variante: kurze Bezeichnung innerhalb der Gruppe
-- =====================================================================

alter table public.bestell_artikel
    add column if not exists gruppe text,
    add column if not exists variante text;

update public.bestell_artikel a
set gruppe = v.gruppe, variante = v.variante
from (values
    ('Mütze Beanie 14,99 €',      'Mütze 14,99€',   'Beanie'),
    ('Mütze Schirm 14,99 €',      'Mütze 14,99€',   'Schirm'),
    ('Mütze Bommel 14,99 €',      'Mütze 14,99€',   'Bommel'),
    ('Mütze ohne Bommel 24,99 €', 'Mütze 24,99€',   'ohne Bommel'),
    ('Mütze mit Bommel 24,99 €',  'Mütze 24,99€',   'mit Bommel')
) as v(name, gruppe, variante)
where a.aktiv and a.name = v.name;
