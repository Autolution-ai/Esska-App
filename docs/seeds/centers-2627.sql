-- Seed: 10 Esska-Center fuer Saison 26/27 (Stand: Verträge Jannis 26/27)
-- Quelle: Foto der Center-Tabelle, 17.06.2026
--
-- Sicher idempotent: wird ein Center mit demselben (saison, kuerzel) erneut
-- ausgefuehrt, werden Name/Stadt/Kategorie/Datum aktualisiert. Miete und
-- Flaechen-Felder bleiben unangetastet, damit dort spaeter nachgepflegte
-- echte Werte nicht ueberschrieben werden.
--
-- Im SQL-Editor einmal ausfuehren.

insert into public.centers (
    saison, name, stadt, kuerzel, kategorie,
    start_datum, end_datum, miete_eur_cent, status
) values
    ('26/27', 'Promenaden Hauptbahnhof',   'Leipzig',     'PHL', 'A', '2026-10-27', '2027-01-10', 0, 'geplant'),
    ('26/27', 'Alstertal-Einkaufszentrum', 'Hamburg',     'AEZ', 'A', '2026-10-29', '2027-01-05', 0, 'geplant'),
    ('26/27', 'Sophienhof',                'Kiel',        'SHK', 'A', '2026-11-06', '2026-12-23', 0, 'geplant'),
    ('26/27', 'Allee-Center',              'Magdeburg',   'ACM', 'B', '2026-11-07', '2026-12-28', 0, 'geplant'),
    ('26/27', 'Schlosspark-Center',        'Schwerin',    'SPS', 'B', '2026-11-10', '2027-01-02', 0, 'geplant'),
    ('26/27', 'Elbe-Einkaufszentrum',      'Hamburg',     'EEZ', 'B', '2026-11-13', '2027-01-02', 0, 'geplant'),
    ('26/27', 'Herold-Center',             'Norderstedt', 'HCN', 'B', '2026-11-14', '2026-12-30', 0, 'geplant'),
    ('26/27', 'Waterfront',                'Bremen',      'WFB', 'B', '2026-11-18', '2026-12-24', 0, 'geplant'),
    ('26/27', 'City-Galerie',              'Wolfsburg',   'CGW', 'C', '2026-11-19', '2026-12-28', 0, 'geplant'),
    ('26/27', 'Hamburger Meile',           'Hamburg',     'HMH', 'C', '2026-11-20', '2026-12-29', 0, 'geplant')
on conflict (saison, kuerzel) do update set
    name = excluded.name,
    stadt = excluded.stadt,
    kategorie = excluded.kategorie,
    start_datum = excluded.start_datum,
    end_datum = excluded.end_datum;
