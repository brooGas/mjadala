-- Mjadala profile feature foundations
-- Run in Supabase SQL Editor. Review policies against your existing auth/profile schema before production.
begin;

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  new_posts boolean not null default true,
  group_posts boolean not null default true,
  group_messages boolean not null default true,
  mentions_replies boolean not null default true,
  direct_messages boolean not null default true,
  tags boolean not null default true,
  app_updates boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences
  add column if not exists tags boolean not null default true,
  add column if not exists app_updates boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();
alter table public.notification_preferences enable row level security;
drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.notification_preferences to authenticated;

create table if not exists public.saved_shorts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  short_id uuid not null references public.shorts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, short_id)
);
create index if not exists saved_shorts_user_created_idx on public.saved_shorts(user_id, created_at desc);
alter table public.saved_shorts enable row level security;
drop policy if exists saved_shorts_select_own on public.saved_shorts;
create policy saved_shorts_select_own on public.saved_shorts
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists saved_shorts_insert_own on public.saved_shorts;
create policy saved_shorts_insert_own on public.saved_shorts
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists saved_shorts_delete_own on public.saved_shorts;
create policy saved_shorts_delete_own on public.saved_shorts
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.saved_shorts to authenticated;

create table if not exists public.profile_privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  public_profile boolean not null default true,
  allow_direct_messages boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.profile_privacy_settings enable row level security;
drop policy if exists profile_privacy_select_own on public.profile_privacy_settings;
create policy profile_privacy_select_own on public.profile_privacy_settings
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists profile_privacy_insert_own on public.profile_privacy_settings;
create policy profile_privacy_insert_own on public.profile_privacy_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists profile_privacy_update_own on public.profile_privacy_settings;
create policy profile_privacy_update_own on public.profile_privacy_settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.profile_privacy_settings to authenticated;

commit;

-- Shorts visibility/playback: signed-in members can discover published Shorts,
-- and owners can still read their own rows. Existing policies remain in place;
-- PostgreSQL permissive policies are combined with OR.
alter table public.shorts enable row level security;
drop policy if exists shorts_read_published_or_own on public.shorts;
create policy shorts_read_published_or_own on public.shorts
  for select to authenticated
  using (lower(coalesce(status, 'published')) = 'published' or user_id = (select auth.uid()));

drop policy if exists short_categories_read_signed_in on public.short_categories;
create policy short_categories_read_signed_in on public.short_categories
  for select to authenticated using (true);
grant select on public.short_categories to authenticated;

-- Signed URL creation requires SELECT access to the relevant Storage objects.
-- This policy is scoped to the dedicated Mjadala Shorts bucket only.
drop policy if exists mjadala_shorts_objects_read_signed_in on storage.objects;
create policy mjadala_shorts_objects_read_signed_in on storage.objects
  for select to authenticated using (bucket_id = 'mjadala-shorts');
