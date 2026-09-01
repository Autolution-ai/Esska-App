-- =====================================================================
-- Esska-App - Onboarding Phase 3 (Meeting 31.08.: O-5, O-10)
--
--   O-5:  Selbststaendige als eigener Status (kurzfristige Beschaeftigung
--         greift bei ihnen ebenfalls, aber sie sind keine Arbeitnehmer)
--   O-10: EU-Staatsbuergerschaft ja/nein - steuert, ob der Upload eines
--         Aufenthaltstitels Pflicht ist
--
-- Hinweis: Der neue Enum-Wert wird hier nur angelegt, nicht verwendet -
-- deshalb darf beides in einer Migration stehen.
-- =====================================================================

alter type esska_aktueller_status add value if not exists 'selbststaendig' before 'sonstiges';

alter table public.profiles
    add column if not exists eu_staatsbuergerschaft boolean;
