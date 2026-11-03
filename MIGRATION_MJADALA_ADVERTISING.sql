-- Mjadala Explore advertising: additive migration.
-- Requires the existing public.mj_is_creator_admin() security-definer helper.
-- Does not alter Reels, business plans, subscriptions, products, orders or Daraja.

create table if not exists public.mj_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 90),
  description text not null default '' check (char_length(description) <= 240),
  media_url text not null,
  media_path text not null,
  media_type text not null check (media_type in ('image','video')),
  category text not null default 'Business',
  destination_url text,
  cta_text text not null default 'Learn more',
  status text not null default 'pending' check (status in ('pending','approved','rejected','paused','expired')),
  rejection_reason text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  is_active boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mj_ad_campaign_dates check (ends_at > starts_at),
  constraint mj_ad_campaign_url check (destination_url is null or destination_url ~* '^https?://')
);

create index if not exists mj_ad_campaigns_public_idx
  on public.mj_ad_campaigns (status, is_active, starts_at, ends_at);
create index if not exists mj_ad_campaigns_owner_idx
  on public.mj_ad_campaigns (user_id, created_at desc);

alter table public.mj_ad_campaigns enable row level security;

drop policy if exists "Public can view active approved Mjadala ads" on public.mj_ad_campaigns;
create policy "Public can view active approved Mjadala ads"
  on public.mj_ad_campaigns for select to anon, authenticated
  using (status = 'approved' and is_active = true and starts_at <= now() and ends_at > now());

drop policy if exists "Owners can view own Mjadala ads" on public.mj_ad_campaigns;
create policy "Owners can view own Mjadala ads"
  on public.mj_ad_campaigns for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Owners can submit Mjadala ads" on public.mj_ad_campaigns;
create policy "Owners can submit Mjadala ads"
  on public.mj_ad_campaigns for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending' and is_active = false and approved_at is null);

drop policy if exists "Admins can manage Mjadala ads" on public.mj_ad_campaigns;
create policy "Admins can manage Mjadala ads"
  on public.mj_ad_campaigns for all to authenticated
  using (public.mj_is_creator_admin())
  with check (public.mj_is_creator_admin());

-- Public media delivery; uploads are restricted to the authenticated owner's UUID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mjadala-ads', 'mjadala-ads', true, 52428800,
        array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners upload own Mjadala ad media" on storage.objects;
create policy "Owners upload own Mjadala ad media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mjadala-ads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Public read Mjadala ad media" on storage.objects;
create policy "Public read Mjadala ad media"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'mjadala-ads');

drop policy if exists "Admins delete Mjadala ad media" on storage.objects;
create policy "Admins delete Mjadala ad media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mjadala-ads' and public.mj_is_creator_admin());

comment on table public.mj_ad_campaigns is 'Mjadala Explore sponsored campaigns; separate from Reels and marketplace products.';
