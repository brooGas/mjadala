-- Mjadala Moments: database foundation
-- Review before running in Supabase SQL Editor. This does not modify existing user/message rows.
-- Images should be uploaded to the private bucket via the reservation flow described below.

begin;

-- 1) Private bucket. Separate name avoids changing any existing bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mjadala-moments',
  'mjadala-moments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];

-- 2) Moment metadata. expires_at is assigned by the finalization function, not the browser.
create table if not exists public.moments (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  caption text not null default '' check (char_length(caption) <= 180),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint moments_expiry_after_creation check (expires_at > created_at)
);

create index if not exists moments_active_feed_idx
  on public.moments (expires_at desc, created_at desc);
create index if not exists moments_user_active_idx
  on public.moments (user_id, expires_at desc);
create index if not exists moments_user_hash_idx
  on public.moments (user_id, content_hash, expires_at desc);

alter table public.moments enable row level security;

-- Active Moments are readable only to signed-in users. Expired rows are immediately hidden.
drop policy if exists moments_read_active on public.moments;
create policy moments_read_active
on public.moments for select to authenticated
using (expires_at > now());

-- Users may delete only their own Moment metadata. Storage objects can also be deleted
-- only from their own folder (policy below).
drop policy if exists moments_delete_own on public.moments;
create policy moments_delete_own
on public.moments for delete to authenticated
using (user_id = (select auth.uid()));

-- No direct client INSERT/UPDATE policies: clients must use the guarded RPCs below.

-- 3) Short-lived reservations stop direct uploads from bypassing the five-active-Moment cap.
create table if not exists public.moment_upload_reservations (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  constraint moment_reservation_expiry_check check (expires_at > created_at)
);
create index if not exists moment_reservations_user_expiry_idx
  on public.moment_upload_reservations (user_id, expires_at);

alter table public.moment_upload_reservations enable row level security;
-- Deliberately no client-facing policies on reservations.

-- 4) Reservation RPC: returns a server-generated path; counts both active Moments and pending uploads.
create or replace function public.reserve_moment_upload(p_content_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_path text;
  v_count integer;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if not public.can_post() then raise exception 'Posting is not allowed for this account'; end if;
  if p_content_hash is null or p_content_hash !~ '^[a-fA-F0-9]{64}$' then
    raise exception 'Invalid image hash';
  end if;

  -- Serialize uploads for this user to avoid race conditions.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 734921));

  delete from public.moment_upload_reservations
   where user_id = v_uid and expires_at <= now();

  if exists (
    select 1 from public.moments m
    where m.user_id = v_uid and m.expires_at > now()
      and lower(m.content_hash) = lower(p_content_hash)
  ) or exists (
    select 1 from public.moment_upload_reservations r
    where r.user_id = v_uid and r.expires_at > now()
      and lower(r.content_hash) = lower(p_content_hash)
  ) then
    raise exception 'This photo is already in your active Moments or upload queue';
  end if;

  select
    (select count(*) from public.moments m where m.user_id = v_uid and m.expires_at > now()) +
    (select count(*) from public.moment_upload_reservations r where r.user_id = v_uid and r.expires_at > now())
  into v_count;

  if v_count >= 5 then raise exception 'You can have at most five active Moments or pending uploads'; end if;

  v_path := v_uid::text || '/' || gen_random_uuid()::text;
  insert into public.moment_upload_reservations (user_id, storage_path, content_hash, expires_at)
  values (v_uid, v_path, lower(p_content_hash), now() + interval '10 minutes');

  return v_path;
end;
$function$;

-- 5) Finalize RPC: only creates a Moment if the matching reserved file exists in Storage.
create or replace function public.create_moment_record(
  p_storage_path text,
  p_content_hash text,
  p_caption text default ''
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
  v_reserved_hash text;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if not public.can_post() then raise exception 'Posting is not allowed for this account'; end if;
  if p_caption is null or char_length(p_caption) > 180 then raise exception 'Caption must be 180 characters or fewer'; end if;
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> v_uid::text then
    raise exception 'Invalid storage path';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 734921));

  select lower(r.content_hash) into v_reserved_hash
  from public.moment_upload_reservations r
  where r.user_id = v_uid
    and r.storage_path = p_storage_path
    and r.expires_at > now();

  if v_reserved_hash is null then raise exception 'Upload reservation expired; please try again'; end if;
  if v_reserved_hash <> lower(coalesce(p_content_hash, '')) then raise exception 'Image hash does not match reservation'; end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'mjadala-moments' and o.name = p_storage_path
  ) then raise exception 'Uploaded image was not found'; end if;

  if exists (
    select 1 from public.moments m
    where m.user_id = v_uid and m.expires_at > now()
      and lower(m.content_hash) = lower(p_content_hash)
  ) then raise exception 'This photo is already in your active Moments'; end if;

  if (select count(*) from public.moments m where m.user_id = v_uid and m.expires_at > now()) >= 5 then
    raise exception 'You can have at most five active Moments';
  end if;

  insert into public.moments (user_id, storage_path, content_hash, caption, created_at, expires_at)
  values (v_uid, p_storage_path, lower(p_content_hash), btrim(p_caption), now(), now() + interval '24 hours')
  returning id into v_id;

  delete from public.moment_upload_reservations r
   where r.user_id = v_uid and r.storage_path = p_storage_path;

  return v_id;
end;
$function$;

-- Restrict RPC execution to signed-in clients.
revoke all on function public.reserve_moment_upload(text) from public, anon;
revoke all on function public.create_moment_record(text, text, text) from public, anon;
grant execute on function public.reserve_moment_upload(text) to authenticated;
grant execute on function public.create_moment_record(text, text, text) to authenticated;

-- 6) Storage policies. Upload requires a valid, unexpired reservation in the user's own folder.
drop policy if exists moments_storage_upload_reserved on storage.objects;
create policy moments_storage_upload_reserved
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mjadala-moments'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1 from public.moment_upload_reservations r
    where r.user_id = (select auth.uid())
      and r.storage_path = name
      and r.expires_at > now()
  )
);

-- Images are readable only while the corresponding Moment is active.
drop policy if exists moments_storage_read_active on storage.objects;
create policy moments_storage_read_active
on storage.objects for select to authenticated
using (
  bucket_id = 'mjadala-moments'
  and exists (
    select 1 from public.moments m
    where m.storage_path = name and m.expires_at > now()
  )
);

-- Owners can remove their own file; expired files will also be removed by the cleanup worker.
drop policy if exists moments_storage_delete_own on storage.objects;
create policy moments_storage_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'mjadala-moments'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

-- 7) Only staff can create public discussion rooms.
-- Ordinary users will create Groups through a separate feature; existing rooms/messages are unchanged.
drop policy if exists rooms_create on public.rooms;
drop policy if exists rooms_create_staff_only on public.rooms;
create policy rooms_create_staff_only
on public.rooms for insert to authenticated
with check (public.is_staff() and created_by = (select auth.uid()));

commit;

-- IMPORTANT FOLLOW-UP:
-- Expired Moment rows become invisible automatically after expires_at. To physically delete
-- their image files, deploy a scheduled Edge Function (or another trusted cleanup worker) that:
-- 1) selects expired moments, 2) removes each storage_path from bucket 'mjadala-moments',
-- 3) deletes the corresponding moments row only after Storage deletion succeeds, and
-- 4) removes expired reservations and any unreferenced orphan uploads.
-- Do not delete storage.objects rows directly as a substitute for Storage API deletion.
