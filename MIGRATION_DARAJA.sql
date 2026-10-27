-- Daraja payment tracking; apply only after reviewing the current business_orders schema.
begin;
alter table public.business_orders add column if not exists mpesa_checkout_request_id text unique;
alter table public.business_orders add column if not exists mpesa_merchant_request_id text;
alter table public.business_orders add column if not exists mpesa_account_reference text;
alter table public.business_orders add column if not exists mpesa_receipt_number text;
alter table public.business_orders add column if not exists mpesa_result_code text;
alter table public.business_orders add column if not exists mpesa_phone text;
alter table public.business_orders add column if not exists payment_initiated_at timestamptz;
create table if not exists public.mpesa_callback_events (
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
alter table public.mpesa_callback_events enable row level security;
revoke all on public.mpesa_callback_events from anon, authenticated;
grant select on public.business_orders to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  begin alter publication supabase_realtime add table public.business_orders; exception when duplicate_object then null; when undefined_object then null; end;
 end if;
end $$;
commit;
