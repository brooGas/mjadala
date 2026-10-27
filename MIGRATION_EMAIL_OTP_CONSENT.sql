-- Run in Supabase SQL Editor. Stores consent after the user's email is verified.
create table if not exists public.mjadala_user_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now()
);
alter table public.mjadala_user_consents enable row level security;
drop policy if exists "Users can read own consent" on public.mjadala_user_consents;
create policy "Users can read own consent" on public.mjadala_user_consents
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own consent" on public.mjadala_user_consents;
create policy "Users can insert own consent" on public.mjadala_user_consents
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own consent" on public.mjadala_user_consents;
create policy "Users can update own consent" on public.mjadala_user_consents
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
