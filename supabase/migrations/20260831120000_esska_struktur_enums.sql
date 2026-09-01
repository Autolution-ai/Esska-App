-- =====================================================================
-- Esska-App - Struktur Phase 1a: Enum-Erweiterungen
-- (Meeting mit Jannis, 31.08.2026 - Punkte S-1 und C-5)
--
-- Eigene Migration, weil Postgres neue Enum-Werte nicht in derselben
-- Transaktion verwenden laesst, in der sie angelegt wurden. Diese
-- Migration MUSS vor 20260831121000 laufen.
-- =====================================================================

-- S-1: dritte Rolle zwischen Admin und Mitarbeiter
alter type esska_role add value if not exists 'regionalmanager';

-- C-5: neuer Status fuer Center, bei denen die Verhandlung noch laeuft.
-- Der einzige Status, der dauerhaft manuell gesetzt wird - alles andere
-- (geplant/aktiv/abgeschlossen) leitet die App aus den Zeitraeumen ab.
alter type esska_center_status add value if not exists 'in_absprache' before 'geplant';
