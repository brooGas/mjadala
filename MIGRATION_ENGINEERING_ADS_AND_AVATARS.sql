-- Mjadala Engineering: community photos + Engineering ads with paid plans.
-- Additive. Run after MIGRATION_ENGINEERING_HUB.sql and MIGRATION_MJADALA_ADVERTISING.sql.
-- Does not alter Reels, business plans, subscriptions, products, orders, Daraja,
-- or the existing Explore advertising feed.

-- 1. Let a community carry a profile photo with a drag-to-position focal point,
--    the same "touch the photo to move it" mechanism already used for ad media.
alter table public.mj_communities add column if not exists avatar_url text;
alter table public.mj_communities add column if not exists avatar_path text;
alter table public.mj_communities add column if not exists avatar_focal_x int not null default 50;
alter table public.mj_communities add column if not exists avatar_focal_y int not null default 50;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mj_communities_focal_range') then
    alter table public.mj_communities
      add constraint mj_communities_focal_range
      check (avatar_focal_x between 0 and 100 and avatar_focal_y between 0 and 100);
  end if;
end $$;

-- The seeded Engineering communities have no created_by (created_by is null),
-- so the existing "owner update" policy (created_by = auth.uid()) can never
-- match them. Without this, nobody could ever set their photo. This adds
-- admin management without weakening the existing owner-update policy.
drop policy if exists "Admins can manage communities" on public.mj_communities;
create policy "Admins can manage communities"
  on public.mj_communities for update to authenticated
  using (public.mj_is_creator_admin())
  with check (public.mj_is_creator_admin());

-- Storage: community profile photos. Admin-only upload (these communities are
-- admin-curated), public read, admin delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mj-community-avatars', 'mj-community-avatars', true, 6291456,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 6291456,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload community avatars" on storage.objects;
create policy "Admins upload community avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mj-community-avatars' and public.mj_is_creator_admin());

drop policy if exists "Public read community avatars" on storage.objects;
create policy "Public read community avatars"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'mj-community-avatars');

drop policy if exists "Admins delete community avatars" on storage.objects;
create policy "Admins delete community avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mj-community-avatars' and public.mj_is_creator_admin());

-- 2. Ad plans: a free tier plus any paid tiers, fully admin-configurable
--    (name, price, duration, payment instructions). Advertisers pick one
--    when they submit an Engineering ad.
create table if not exists public.mj_ad_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 60),
  description text not null default '' check (char_length(description) <= 300),
  price_kes numeric(10,2) not null default 0 check (price_kes >= 0),
  is_free boolean not null default false,
  duration_days int not null default 7 check (duration_days between 1 and 365),
  payment_instructions text not null default '',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists mj_ad_plans_public_idx on public.mj_ad_plans (is_active, sort_order);

alter table public.mj_ad_plans enable row level security;

drop policy if exists "Public can view active ad plans" on public.mj_ad_plans;
create policy "Public can view active ad plans"
  on public.mj_ad_plans for select to anon, authenticated
  using (is_active = true);

drop policy if exists "Admins can manage ad plans" on public.mj_ad_plans;
create policy "Admins can manage ad plans"
  on public.mj_ad_plans for all to authenticated
  using (public.mj_is_creator_admin())
  with check (public.mj_is_creator_admin());

-- A sensible starting free plan so the dropdown is never empty. Admin can add
-- paid tiers (or edit/deactivate this one) from the Engineering ads dashboard.
insert into public.mj_ad_plans (name, description, price_kes, is_free, duration_days, payment_instructions, sort_order)
select 'Free listing', 'A basic 7-day placement in the Engineering ad rotation.', 0, true, 7, '', 0
where not exists (select 1 from public.mj_ad_plans);

-- 3. Let a campaign record which plan it was bought under, Engineering
--    subtopic targeting, and a manually-confirmed payment trail (the same
--    "pay, then enter the M-Pesa code" pattern used elsewhere in the app —
--    automatic STK push isn't wired here since that reuses secrets/edge
--    functions tied to real product checkout, which this migration does
--    not touch).
alter table public.mj_ad_campaigns add column if not exists plan_id uuid references public.mj_ad_plans(id) on delete set null;
alter table public.mj_ad_campaigns add column if not exists eng_subtopic text;
alter table public.mj_ad_campaigns add column if not exists payment_status text not null default 'n/a';
alter table public.mj_ad_campaigns add column if not exists payment_reference text;
alter table public.mj_ad_campaigns add column if not exists payment_phone text;
alter table public.mj_ad_campaigns add column if not exists media_focal_x int;
alter table public.mj_ad_campaigns add column if not exists media_focal_y int;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mj_ad_campaigns_payment_status_check') then
    alter table public.mj_ad_campaigns
      add constraint mj_ad_campaigns_payment_status_check
      check (payment_status in ('n/a','pending','paid','rejected'));
  end if;
end $$;

comment on table public.mj_ad_plans is 'Admin-configurable ad plans (free + paid tiers) advertisers choose from when submitting a campaign.';
comment on column public.mj_ad_campaigns.payment_status is 'Manually confirmed by the advertiser (reference code) and verified by an admin before approval; n/a for free plans.';
