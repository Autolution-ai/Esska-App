-- =====================================================================
-- Esska: Schichtplan-Mails nur bei der ersten Veroeffentlichung.
-- benachrichtigt_am setzt der Server nach dem Versand; danach wird beim
-- erneuten Veroeffentlichen (z. B. nach spontanen Aenderungen) keine
-- Mail mehr verschickt. Bereits veroeffentlichte Wochen gelten als
-- benachrichtigt.
-- =====================================================================
alter table public.shift_weeks add column if not exists benachrichtigt_am timestamptz;
update public.shift_weeks set benachrichtigt_am = veroeffentlicht_am
where veroeffentlicht and veroeffentlicht_am is not null and benachrichtigt_am is null;
