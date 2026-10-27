-- ============================================================================
-- Xfinder (arbetsnamn) – 0004: storage
-- ----------------------------------------------------------------------------
-- companion-photos  – publika bilder på kompanjören (max 6 per annons i appen)
-- avatars           – profilbilder
-- verification-documents – PRIVAT: id-handling/verifieringsunderlag som bara
--                     ägaren och admin kommer åt.
--
-- Uppladdning sker alltid till en mapp som heter användarens uuid, t.ex.
--   companion-photos/<user-id>/bild-1.jpg
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('companion-photos',       'companion-photos',       true,  5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars',                'avatars',                true,  2097152,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('verification-documents', 'verification-documents', false, 10485760,
   array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Läsning ---------------------------------------------------------------------
drop policy if exists "companion_photos_public_read" on storage.objects;
create policy "companion_photos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'companion-photos');

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "verification_documents_private_read" on storage.objects;
create policy "verification_documents_private_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-documents'
    and (owner = auth.uid() or public.is_admin())
  );

-- Uppladdning: bara i sin egen mapp -------------------------------------------
drop policy if exists "companion_photos_owner_write" on storage.objects;
create policy "companion_photos_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'companion-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_write" on storage.objects;
create policy "avatars_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "verification_documents_owner_write" on storage.objects;
create policy "verification_documents_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Ändra och ta bort egna filer -------------------------------------------------
drop policy if exists "own_objects_update" on storage.objects;
create policy "own_objects_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('companion-photos', 'avatars', 'verification-documents')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('companion-photos', 'avatars', 'verification-documents')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own_objects_delete" on storage.objects;
create policy "own_objects_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('companion-photos', 'avatars', 'verification-documents')
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
