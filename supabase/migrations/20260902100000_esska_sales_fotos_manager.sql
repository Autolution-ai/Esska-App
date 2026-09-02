-- Regionalmanager duerfen die Verkaufslisten-Fotos ihrer Center ansehen
-- (die Lese-Policy von 20260616 kannte nur Admin + zugeordnete Mitarbeiter).

drop policy if exists "Esska sales-receipts read" on storage.objects;
create policy "Esska sales-receipts read"
on storage.objects for select
using (
    bucket_id = 'sales-receipts'
    and (
        public.is_admin()
        or public.manages_center(((storage.foldername(name))[1])::uuid)
        or exists (
            select 1 from public.center_assignments ca
            where ca.profile_id = auth.uid()
              and ca.center_id::text = (storage.foldername(name))[1]
        )
    )
);
