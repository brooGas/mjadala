-- Additive Mjadala profile fields. Safe to run more than once.
begin;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists avatar_url text;
-- Public profile photos use a public bucket. User-specific folder ownership is enforced on writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos','profile-photos',true,4194304,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=4194304, allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists profile_photos_public_read on storage.objects;
create policy profile_photos_public_read on storage.objects for select to public using (bucket_id='profile-photos');
drop policy if exists profile_photos_owner_insert on storage.objects;
create policy profile_photos_owner_insert on storage.objects for insert to authenticated with check (bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists profile_photos_owner_update on storage.objects;
create policy profile_photos_owner_update on storage.objects for update to authenticated using (bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists profile_photos_owner_delete on storage.objects;
create policy profile_photos_owner_delete on storage.objects for delete to authenticated using (bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
commit;
