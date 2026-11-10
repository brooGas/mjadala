-- Mjadala Engineering ads: Daraja (M-Pesa STK push) tracking.
-- Additive. Run after MIGRATION_ENGINEERING_ADS_AND_AVATARS.sql.
-- Mirrors the same pattern already used for business_orders in
-- MIGRATION_DARAJA.sql, applied to mj_ad_campaigns instead. Does not touch
-- business_orders, Reels, or anything already working.
begin;

alter table public.mj_ad_campaigns add column if not exists mpesa_checkout_request_id text unique;
alter table public.mj_ad_campaigns add column if not exists mpesa_merchant_request_id text;
alter table public.mj_ad_campaigns add column if not exists mpesa_result_code text;
alter table public.mj_ad_campaigns add column if not exists payment_initiated_at timestamptz;

-- Raw Safaricom callback payloads, for audit + reconciliation. Only the
-- service role (used by the edge functions) can touch this table directly.
create table if not exists public.mj_ad_mpesa_callback_events (
  id bigint generated always as identity primary key,
  checkout_request_id text not null unique,
  merchant_request_id text,
  result_code text not null,
  receipt_number text,
  amount numeric(12,2),
  phone text,
  callback_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);
alter table public.mj_ad_mpesa_callback_events enable row level security;
revoke all on public.mj_ad_mpesa_callback_events from anon, authenticated;

-- Let advertisers see live updates to their own campaign's payment status
-- without a full page reload (same mechanism as business order tracking).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.mj_ad_campaigns;
    exception when duplicate_object then null; when undefined_object then null; end;
  end if;
end $$;

commit;
