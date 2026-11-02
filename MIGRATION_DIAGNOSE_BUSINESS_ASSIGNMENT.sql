-- MJADALA BUSINESS ASSIGNMENT DIAGNOSTIC — READ ONLY
-- Run in Supabase SQL Editor. This makes no database changes.

-- A. Exact live RPC signature and implementation.
select p.oid::regprocedure as function_signature,
       pg_get_function_arguments(p.oid) as arguments,
       pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'mj_creator_assign_plan';

-- B. Actual deployed columns for the relevant business tables.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('mj_business_plans','mj_business_subscriptions','business_profiles','mj_business_applications')
order by table_name, ordinal_position;

-- C. Current plans and active flags.
select id, plan_key, plan_name, price_kes, billing_days, trial_days, is_active
from public.mj_business_plans
order by sort_order nulls last, plan_name;
