-- Watt AI subscriptions: separate from Mjadala Business Plans and marketplace orders.
-- Initial launch pricing is editable in watt_ai_plans: KES 199 / 30 days per agent;
-- KES 599 / 30 days for All-Access. No automatic M-Pesa renewal is performed.

create table if not exists public.watt_ai_plans (
  plan_code text primary key,
  title text not null,
  agent_key text not null check (agent_key in ('shopping','business','learning','research','innovation','community','all_access')),
  amount_kes integer not null check (amount_kes >= 0),
  duration_days integer not null default 30 check (duration_days between 1 and 366),
  description text not null default '',
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.watt_ai_plans(plan_code,title,agent_key,amount_kes,duration_days,description,display_order)
values
 ('shopping_pro','Shopping Agent Pro','shopping',199,30,'Detailed product comparisons, scored shortlists and buying guides',1),
 ('business_agent_pro','Business Agent Pro','business',199,30,'Advanced marketing, sales, operations and growth planning',2),
 ('learning_pro','Learning Agent Pro','learning',199,30,'Structured learning paths, revision programmes and practice packs',3),
 ('research_pro','Research Agent Pro','research',199,30,'In-depth research workflows, source synthesis and detailed reports',4),
 ('innovation_pro','Innovation Agent Pro','innovation',199,30,'Feasibility work, prototype plans, design specifications and testing',5),
 ('community_pro','Community Agent Pro','community',199,30,'Creator campaigns, community growth and engagement strategies',6),
 ('all_access','Watt AI All-Access','all_access',599,30,'All six specialist Agent Pro experiences in one subscription',7)
on conflict(plan_code) do update set
 title=excluded.title, agent_key=excluded.agent_key, amount_kes=excluded.amount_kes,
 duration_days=excluded.duration_days, description=excluded.description,
 display_order=excluded.display_order, updated_at=now();

create table if not exists public.watt_ai_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  plan_code text not null references public.watt_ai_plans(plan_code) on delete restrict,
  amount_kes integer not null check (amount_kes > 0),
  phone_number text not null,
  payment_status text not null default 'pending' check (payment_status in ('pending','processing','paid','failed','cancelled')),
  merchant_request_id text,
  checkout_request_id text unique,
  mpesa_receipt_number text unique,
  result_code integer,
  result_description text,
  callback_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists watt_ai_payments_user_created_idx on public.watt_ai_payments(user_id,created_at desc);
create index if not exists watt_ai_payments_status_idx on public.watt_ai_payments(payment_status);

create table if not exists public.watt_ai_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  entitlement_key text not null check (entitlement_key in ('shopping','business','learning','research','innovation','community','all_access')),
  payment_id uuid not null unique references public.watt_ai_payments(id) on delete restrict,
  active_from timestamptz not null,
  active_until timestamptz not null,
  created_at timestamptz not null default now(),
  check (active_until > active_from)
);
create index if not exists watt_ai_subscriptions_user_active_idx on public.watt_ai_subscriptions(user_id,active_until desc);

alter table public.watt_ai_plans enable row level security;
alter table public.watt_ai_payments enable row level security;
alter table public.watt_ai_subscriptions enable row level security;

drop policy if exists watt_ai_plans_public_read on public.watt_ai_plans;
create policy watt_ai_plans_public_read on public.watt_ai_plans for select to anon,authenticated using (is_active = true);
drop policy if exists watt_ai_payments_read_own on public.watt_ai_payments;
create policy watt_ai_payments_read_own on public.watt_ai_payments for select to authenticated using (user_id = auth.uid());
drop policy if exists watt_ai_subscriptions_read_own on public.watt_ai_subscriptions;
create policy watt_ai_subscriptions_read_own on public.watt_ai_subscriptions for select to authenticated using (user_id = auth.uid());

revoke insert,update,delete on public.watt_ai_plans from anon,authenticated;
revoke insert,update,delete on public.watt_ai_payments from anon,authenticated;
revoke insert,update,delete on public.watt_ai_subscriptions from anon,authenticated;
grant select on public.watt_ai_plans to anon,authenticated;
grant select on public.watt_ai_payments,public.watt_ai_subscriptions to authenticated;

-- Only the trusted callback Edge Function (service_role) may activate entitlements.
create or replace function public.watt_ai_finalize_payment(
  p_checkout_request_id text,
  p_result_code integer,
  p_result_description text,
  p_receipt_number text default null,
  p_amount numeric default null,
  p_phone_number text default null,
  p_callback_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.watt_ai_payments%rowtype;
  v_plan public.watt_ai_plans%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_entitlement text;
begin
  select * into v_payment from public.watt_ai_payments
   where checkout_request_id = p_checkout_request_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','payment_not_found'); end if;
  if v_payment.payment_status = 'paid' then return jsonb_build_object('ok',true,'already_processed',true); end if;
  if v_payment.payment_status not in ('pending','processing') then
    return jsonb_build_object('ok',false,'reason','payment_not_pending');
  end if;

  update public.watt_ai_payments set
    result_code=p_result_code,
    result_description=left(coalesce(p_result_description,''),500),
    callback_payload=coalesce(p_callback_payload,'{}'::jsonb),
    phone_number=coalesce(p_phone_number,phone_number),
    updated_at=now()
  where id=v_payment.id;

  if p_result_code <> 0 then
    update public.watt_ai_payments set payment_status='failed' where id=v_payment.id;
    return jsonb_build_object('ok',true,'paid',false);
  end if;

  if p_receipt_number is null or p_receipt_number = '' or p_amount is null or round(p_amount) <> v_payment.amount_kes then
    update public.watt_ai_payments set payment_status='failed',result_description='Payment confirmation did not match the expected amount or receipt.' where id=v_payment.id;
    return jsonb_build_object('ok',false,'reason','payment_validation_failed');
  end if;

  select * into v_plan from public.watt_ai_plans where plan_code=v_payment.plan_code;
  if not found or not v_plan.is_active then
    update public.watt_ai_payments set payment_status='failed',result_description='The selected plan is no longer active.' where id=v_payment.id;
    return jsonb_build_object('ok',false,'reason','plan_inactive');
  end if;

  v_entitlement := v_plan.agent_key;
  select greatest(now(),coalesce(max(active_until),now())) into v_start
    from public.watt_ai_subscriptions
   where user_id=v_payment.user_id and entitlement_key=v_entitlement;
  v_end := v_start + make_interval(days => v_plan.duration_days);

  update public.watt_ai_payments set payment_status='paid',mpesa_receipt_number=p_receipt_number,paid_at=now() where id=v_payment.id;
  insert into public.watt_ai_subscriptions(user_id,entitlement_key,payment_id,active_from,active_until)
  values(v_payment.user_id,v_entitlement,v_payment.id,v_start,v_end);

  return jsonb_build_object('ok',true,'paid',true,'entitlement',v_entitlement,'active_until',v_end);
end;
$$;
revoke all on function public.watt_ai_finalize_payment(text,integer,text,text,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.watt_ai_finalize_payment(text,integer,text,text,numeric,text,jsonb) to service_role;

create or replace function public.watt_ai_touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists watt_ai_payments_touch on public.watt_ai_payments;
create trigger watt_ai_payments_touch before update on public.watt_ai_payments for each row execute function public.watt_ai_touch_updated_at();
drop trigger if exists watt_ai_plans_touch on public.watt_ai_plans;
create trigger watt_ai_plans_touch before update on public.watt_ai_plans for each row execute function public.watt_ai_touch_updated_at();

-- Keep payment/subscription data private. No public insert/update policies are created.
