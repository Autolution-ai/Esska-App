-- Behebt den Supabase-Advisor-Hinweis "Security Definer View".
--
-- Hintergrund: Views laufen in Postgres standardmaessig mit den Rechten
-- ihres ERSTELLERS (Security Definer). Dadurch wuerde die View
-- shifts_per_employee_week die Row-Level-Security-Regeln der Tabellen
-- shifts/shift_weeks umgehen: Jeder eingeloggte Nutzer koennte darueber
-- die Schichtzahlen ALLER Mitarbeiter abfragen, nicht nur die eigenen.
--
-- security_invoker = true stellt das um: Die View laeuft mit den Rechten
-- des ABFRAGENDEN Nutzers, die RLS-Policies der Basistabellen greifen
-- also ganz normal (Admin sieht alles, Mitarbeiter nur sich selbst).
--
-- Die App selbst nutzt die View aktuell nicht (die Limit-Pruefung im
-- Schichtplan rechnet direkt auf der shifts-Tabelle) - es geht darum,
-- keine Hintertuer offen zu lassen.

alter view public.shifts_per_employee_week set (security_invoker = true);
