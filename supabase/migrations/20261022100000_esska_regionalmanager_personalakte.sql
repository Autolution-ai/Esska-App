-- =====================================================================
-- Esska: Regionalmanager sehen die Personalakte ihrer Mitarbeiter
--
-- Vorgabe des Inhabers (22.10.2026): Regionalmanager sollen die Profile
-- der Mitarbeiter ihrer Center oeffnen und dort alles sehen koennen -
-- Personalfragebogen, Steuer- und Sozialversicherungsdaten, KuBe-
-- Erklaerung, RV-Befreiung, Arbeitsvertrag und hochgeladene Nachweise.
-- Das hebt die Einschraenkung vom 09.10. (profiles nur ueber
-- planungsprofile) fuer LESEN wieder auf.
--
-- Grenze: nur Mitarbeiter ihrer eigenen Center (manages_employee).
-- Nur lesen - Aendern, Loeschen, Passwort und Rollen bleiben beim Admin.
--
-- alter statt drop/create: Der Supabase-Konnektor fuehrt loeschende
-- Anweisungen nur nach einer Bestaetigung aus, die in der Remote-Umgebung
-- nicht erscheint.
-- =====================================================================

alter policy profiles_select_own_or_admin on public.profiles
    using (auth.uid() = id or public.is_admin() or public.manages_employee(id));

alter policy kube_select on public.kube_declarations
    using (profile_id = auth.uid() or public.is_admin() or public.manages_employee(profile_id));

alter policy pension_select on public.pension_exemptions
    using (profile_id = auth.uid() or public.is_admin() or public.manages_employee(profile_id));

alter policy vertragsbestaetigungen_select on public.vertragsbestaetigungen
    using (profile_id = auth.uid() or public.is_admin() or public.manages_employee(profile_id));

alter policy emp_docs_select on public.employee_documents
    using (profile_id = auth.uid() or public.is_admin() or public.manages_employee(profile_id));

-- Dateien: Zugehoerigkeit ueber die Dokumententabelle (statt den
-- Ordnernamen in eine uuid umzuwandeln - das wuerde bei einem
-- unerwarteten Pfad die ganze Abfrage abbrechen).
alter policy "Esska employee-documents read" on storage.objects
    using (
        bucket_id = 'employee-documents'
        and (
            (storage.foldername(name))[1] = auth.uid()::text
            or public.is_admin()
            or exists (
                select 1 from public.employee_documents d
                where d.storage_path = storage.objects.name
                  and public.manages_employee(d.profile_id)
            )
        )
    );
