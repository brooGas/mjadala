-- Mjadala advertising campaign management extension.
-- Run after MIGRATION_MJADALA_ADVERTISING.sql.
-- Adds draft support and audience targeting without changing Reels or payments.

-- Expand the campaign status constraint to include drafts.
alter table public.mj_ad_campaigns
  drop constraint if exists mj_ad_campaigns_status_check;

alter table public.mj_ad_campaigns
  add constraint mj_ad_campaigns_status_check
  check (status in ('draft','pending','approved','rejected','paused','expired'));

-- Store the intended audience for advertiser/admin visibility.
alter table public.mj_ad_campaigns
  add column if not exists audience text not null default 'everyone';

alter table public.mj_ad_campaigns
  drop constraint if exists mj_ad_campaigns_audience_check;

alter table public.mj_ad_campaigns
  add constraint mj_ad_campaigns_audience_check
  check (audience in ('everyone','business','students','engineering','technology'));

-- Owners may create either drafts or pending campaigns, but cannot publish them.
drop policy if exists "Owners can submit Mjadala ads"
  on public.mj_ad_campaigns;

create policy "Owners can submit Mjadala ads"
  on public.mj_ad_campaigns
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and status in ('draft','pending')
    and is_active = false
    and approved_at is null
  );

-- Owners can edit only their own drafts; submitted campaigns remain review-controlled.
drop policy if exists "Owners can update own Mjadala ad drafts"
  on public.mj_ad_campaigns;

create policy "Owners can update own Mjadala ad drafts"
  on public.mj_ad_campaigns
  for update to authenticated
  using (auth.uid() = user_id and status = 'draft')
  with check (
    auth.uid() = user_id
    and status = 'draft'
    and is_active = false
    and approved_at is null
  );

-- Admin management remains governed by the existing mj_is_creator_admin() helper.
