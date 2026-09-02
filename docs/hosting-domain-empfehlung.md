# Domain & Hosting - Bewertung und Empfehlung (T-1 / T-2)

Stand: 02.09.2026. Preise bitte beim Kauf gegenpruefen, sie aendern sich gelegentlich.

## Ausgangslage

Die App laeuft auf `esska-app.vercel.app` (kostenlose Subdomain, Vercel
Hobby-Plan) mit Supabase Free (Datenbank, Frankfurt). Das war fuer die
Entwicklung richtig - fuer den echten Betrieb gibt es drei Punkte:

1. **Kommerzielle Nutzung:** Der kostenlose Vercel-Hobby-Plan erlaubt
   keine kommerzielle Nutzung. Sobald die App produktiv fuer das
   Unternehmen laeuft, braucht es Vercel Pro.
2. **Supabase Free pausiert** Projekte nach ~7 Tagen Inaktivitaet und
   macht **keine Backups**. Fuer echte Personal- und Kassendaten ist das
   nicht tragbar.
3. **Eigene Domain fehlt** - noetig fuer serioese Adresse, kommerzielles
   Hosting und den professionellen E-Mail-Versand (Resend statt Gmail).

## Empfehlung Domain (T-1)

- Domain kaufen, z. B. `esska-collection.de` (oder .com), ca. **10-15 EUR/Jahr**.
  Anbieter: IONOS, Netcup oder INWX - alle drei sind fuer reine
  Domain-Registrierung gleichwertig.
- **Auf Esska/Jannis registrieren**, nicht privat auf Bruno - erspart die
  spaetere Uebertragung.
- Einrichtung (zusammen ~30 Minuten):
  1. Domain beim Anbieter kaufen.
  2. Vercel: Projekt esska-app -> Settings -> Domains -> Domain eintragen.
     Vercel zeigt die noetigen DNS-Eintraege (A/CNAME) an.
  3. DNS-Eintraege beim Domain-Anbieter setzen, warten bis Vercel
     "Valid Configuration" zeigt.
  4. Supabase: Authentication -> URL Configuration -> Site URL und
     Redirect URLs auf die neue Domain umstellen (alte zusaetzlich
     stehen lassen, bis alle umgezogen sind).
  5. Vercel-Umgebungsvariable `APP_URL` auf die neue Domain setzen
     (steuert die Links in Erinnerungs-Mails), Redeploy.
- Bonus: Mit eigener Domain kann der E-Mail-Versand von Gmail auf
  **Resend** umgestellt werden (professioneller Absender, kein
  Spam-Thema, kostenlos bis 3.000 Mails/Monat) - reine Konfiguration,
  der Code ist darauf vorbereitet.

## Bewertung Hosting (T-2)

**Leistung:** Fuer 10-40 gleichzeitige Nutzer ist der Stack ueberdimensioniert
gut. Next.js wird von Vercel weltweit ausgeliefert, die Datenbank steht in
Frankfurt. Kein Handlungsbedarf, kein Anbieterwechsel noetig.

**Sicherheit:** Zugriffsschutz liegt in der Datenbank (Row Level Security auf
jeder Tabelle, GoBD-Trigger fuer Kassendaten, Rollen-Schutz-Trigger),
EU-Datenhaltung bei Supabase Frankfurt. Zwei Verbesserungen vor Live-Gang:
- Vercel: Function-Region auf **Frankfurt (fra1)** stellen (Settings ->
  Functions), damit auch die Server-Routen in der EU laufen.
- MFA fuer die Admin-Konten aktivieren (in der App unter Einstellungen).

**Empfohlene Upgrades vor dem Saisonstart:**

| Posten | Kosten | Warum |
|---|---|---|
| Vercel Pro | ~20 USD/Monat | Kommerzielle Nutzung erlaubt, mehr Cron/Limits, Support |
| Supabase Pro | ~25 USD/Monat | Taegliche Backups, kein Pausieren, mehr Speicher |
| Domain | ~12 EUR/Jahr | s. o. |
| Resend | 0 EUR | E-Mail ueber eigene Domain |

Zusammen grob **45-50 EUR/Monat waehrend der Saison**. Nach Saisonende kann
Vercel wieder auf Hobby und Supabase auf Free zurueckgestuft werden, wenn die
App ruht - vorher Datenbank-Export ziehen.

**Alternative geprueft und verworfen:** Eigener Server (z. B. Hetzner,
~10 EUR/Monat) waere billiger, verlagert aber Updates, Backups, TLS und
Ausfallsicherheit in die eigene Verantwortung - fuer ein Team ohne
Entwickler nicht sinnvoll.

## Kontenuebergabe (Erinnerung)

Vercel-, Supabase-, Domain- und Gmail-Konto laufen aktuell auf Bruno.
Vor dem Saisonstart auf Esska/Jannis uebertragen bzw. Jannis als Owner
eintragen - steht auch in der Datenschutz-Notiz fuer Jannis.
