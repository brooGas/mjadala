-- Mjadala profile, saved Reels, privacy, and notification preferences.
-- Safe to run more than once. Run in Supabase SQL Editor as project owner.

create table if not exists public.saved_shorts (
  user_id uuid not null references auth.users(id) on delete cascade,
  short_id uuid not null references public.shorts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, short_id)
);
alter table public.saved_shorts enable row level security;
drop policy if exists "Users read their saved shorts" on public.saved_shorts;
create policy "Users read their saved shorts" on public.saved_shorts
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users save their own shorts" on public.saved_shorts;
create policy "Users save their own shorts" on public.saved_shorts
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users unsave their own shorts" on public.saved_shorts;
create policy "Users unsave their own shorts" on public.saved_shorts
  for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  new_posts boolean not null default true,
  group_posts boolean not null default true,
  group_messages boolean not null default true,
  mentions_replies boolean not null default true,
  direct_messages boolean not null default true,
  tags boolean not null default true,
  app_updates boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences add column if not exists new_posts boolean not null default true;
alter table public.notification_preferences add column if not exists group_posts boolean not null default true;
alter table public.notification_preferences add column if not exists group_messages boolean not null default true;
alter table public.notification_preferences add column if not exists mentions_replies boolean not null default true;
alter table public.notification_preferences add column if not exists direct_messages boolean not null default true;
alter table public.notification_preferences add column if not exists tags boolean not null default true;
alter table public.notification_preferences add column if not exists app_updates boolean not null default true;
alter table public.notification_preferences add column if not exists updated_at timestamptz not null default now();
alter table public.notification_preferences enable row level security;
drop policy if exists "Users manage their notification preferences" on public.notification_preferences;
create policy "Users manage their notification preferences" on public.notification_preferences
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.profile_privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_profile boolean not null default true,
  allow_direct_messages boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.profile_privacy_settings add column if not exists public_profile boolean not null default true;
alter table public.profile_privacy_settings add column if not exists allow_direct_messages boolean not null default true;
alter table public.profile_privacy_settings add column if not exists updated_at timestamptz not null default now();
alter table public.profile_privacy_settings enable row level security;
drop policy if exists "Users manage their profile privacy settings" on public.profile_privacy_settings;
create policy "Users manage their profile privacy settings" on public.profile_privacy_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
