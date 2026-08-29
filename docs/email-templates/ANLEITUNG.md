# E-Mail-Vorlagen fuer die Esska-App

Diese HTML-Dateien sind Vorlagen fuer die Auth-Mails, die Supabase verschickt
(Einladung, Passwort zuruecksetzen). Sie ersetzen die englischen
Standard-Vorlagen durch deutsche Texte im Esska-Design (Beige/Weinrot),
jeweils mit kurzer englischer Uebersetzung fuer internationales Saisonpersonal.

## Einfuegen (einmalig, im Supabase-Dashboard)

1. https://supabase.com/dashboard/project/tbkuqvnjywgjqcgzryww/auth/templates
   oeffnen (Authentication -> Emails -> Templates).
2. Vorlage **"Invite user"** auswaehlen:
   - Subject: `Deine Einladung zur Esska-App`
   - Message body: kompletten Inhalt von `invite.html` einfuegen
     (den bisherigen Inhalt vorher loeschen).
   - Save.
3. Vorlage **"Reset password"** auswaehlen:
   - Subject: `Esska-App: Passwort zuruecksetzen`
   - Message body: kompletten Inhalt von `recovery.html` einfuegen.
   - Save.

Die uebrigen Vorlagen (Confirm signup, Magic Link, Change Email) werden von
der App aktuell nicht verschickt: Selbstregistrierung ist deaktiviert und
Magic-Link-Login wird nicht angeboten. Sie koennen spaeter nach demselben
Muster ergaenzt werden.

## Technische Hinweise

- `{{ .ConfirmationURL }}` ist eine Supabase-Variable und muss exakt so
  im Button-Link stehen bleiben.
- Das Layout nutzt Tabellen und Inline-Styles - das ist Absicht:
  E-Mail-Programme (v. a. Outlook, Gmail-App) unterstuetzen kein modernes
  CSS. Nicht in "schoenes" HTML/CSS umbauen, sonst zerfaellt das Layout.
- Kein Logo-Bild eingebunden: Bilder muessten auf einem oeffentlichen Server
  liegen und erhoehen die Spam-Wahrscheinlichkeit. Der Schriftzug im
  weinroten Kopfbalken uebernimmt die Wiedererkennung.
