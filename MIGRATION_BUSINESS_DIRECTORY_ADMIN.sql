-- Mjadala Business Directory + Creator-controlled plans and approvals
-- Run after the existing business shopping migration. No service-role key is used in the client.

create extension if not exists pgcrypto;

create table if not exists public.mj_business_control (
  singleton boolean primary key default true check (singleton),
  creator_user_id uuid,
  registration_open boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.mj_business_control(singleton, registration_open)
values (true, true) on conflict (singleton) do nothing;

create or replace function public.mj_is_creator_admin()
returns boolean language sql stable security definer set search_path = public, auth
as $$ select exists(select 1 from public.mj_business_control c where c.singleton and c.creator_user_id = auth.uid()) $$;
revoke all on function public.mj_is_creator_admin() from public;
grant execute on function public.mj_is_creator_admin() to authenticated;

create table if not exists public.mj_business_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  plan_name text not null,
  description text not null default '',
  price_kes numeric(12,2) not null default 0 check (price_kes >= 0),
  billing_days integer not null default 30 check (billing_days between 1 and 3650),
  trial_days integer not null default 0 check (trial_days between 0 and 3650),
  is_free boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.mj_business_plans(plan_key,plan_name,description,price_kes,billing_days,trial_days,is_free,sort_order)
values ('pilot','Pilot / Free','Free access assigned by the creator for testing.',0,30,0,true,0),
       ('starter','Starter','Entry plan for small traders.',100,30,0,false,1),
       ('growth','Growth','For growing local businesses.',300,30,0,false,2),
       ('premium','Premium','For established sellers.',600,30,0,false,3)
on conflict (plan_key) do nothing;

create table if not exists public.mj_business_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  description text not null default '',
  location_text text not null default '',
  contact_phone text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text not null default '',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mj_business_applications_user_idx on public.mj_business_applications(user_id,created_at desc);

create table if not exists public.mj_business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.mj_business_plans(id),
  status text not null default 'trial' check (status in ('trial','active','expired','suspended','cancelled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by uuid references auth.users(id),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mj_business_subscriptions_user_idx on public.mj_business_subscriptions(user_id,created_at desc);

alter table public.business_profiles add column if not exists directory_status text not null default 'pending';
alter table public.business_profiles add column if not exists business_description text not null default '';
alter table public.business_profiles add column if not exists business_location text not null default '';
alter table public.business_profiles add column if not exists business_phone text not null default '';
alter table public.business_profiles add column if not exists directory_updated_at timestamptz not null default now();

alter table public.mj_business_control enable row level security;
alter table public.mj_business_plans enable row level security;
alter table public.mj_business_applications enable row level security;
alter table public.mj_business_subscriptions enable row level security;

-- Public customers may see active plan descriptions; only the creator can edit plans.
drop policy if exists mj_business_plans_read on public.mj_business_plans;
create policy mj_business_plans_read on public.mj_business_plans for select to anon, authenticated using (is_active = true or public.mj_is_creator_admin());
drop policy if exists mj_business_plans_admin_all on public.mj_business_plans;
create policy mj_business_plans_admin_all on public.mj_business_plans for all to authenticated using (public.mj_is_creator_admin()) with check (public.mj_is_creator_admin());

drop policy if exists mj_business_applications_owner_read on public.mj_business_applications;
create policy mj_business_applications_owner_read on public.mj_business_applications for select to authenticated using (user_id = auth.uid() or public.mj_is_creator_admin());
drop policy if exists mj_business_applications_owner_insert on public.mj_business_applications;
create policy mj_business_applications_owner_insert on public.mj_business_applications for insert to authenticated with check (user_id = auth.uid());
drop policy if exists mj_business_applications_admin_update on public.mj_business_applications;
create policy mj_business_applications_admin_update on public.mj_business_applications for update to authenticated using (public.mj_is_creator_admin()) with check (public.mj_is_creator_admin());

drop policy if exists mj_business_subscriptions_owner_read on public.mj_business_subscriptions;
create policy mj_business_subscriptions_owner_read on public.mj_business_subscriptions for select to authenticated using (user_id = auth.uid() or public.mj_is_creator_admin());
drop policy if exists mj_business_subscriptions_admin_all on public.mj_business_subscriptions;
create policy mj_business_subscriptions_admin_all on public.mj_business_subscriptions for all to authenticated using (public.mj_is_creator_admin()) with check (public.mj_is_creator_admin());

create or replace function public.mj_business_can_publish(p_user uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$
 select exists (
   select 1 from public.business_profiles bp
   join public.mj_business_subscriptions s on s.user_id=bp.user_id
   where bp.user_id=p_user and bp.directory_status='approved'
     and s.status in ('trial','active') and (s.ends_at is null or s.ends_at > now())
 )
$$;
revoke all on function public.mj_business_can_publish(uuid) from public;
grant execute on function public.mj_business_can_publish(uuid) to authenticated;

create or replace function public.mj_enforce_business_publish_access()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
begin
 if new.published is true and not public.mj_business_can_publish(new.seller_id) then
   raise exception 'Your business is not approved or its access plan has expired. Submit an application or contact Mjadala support.';
 end if;
 return new;
end $$;
drop trigger if exists mj_business_publish_access on public.business_products;
create trigger mj_business_publish_access before insert or update of published,seller_id on public.business_products
for each row execute function public.mj_enforce_business_publish_access();

-- A public, approved-only directory. Search by business name; no owner private details are returned.
create or replace function public.mj_search_business_directory(p_search text default '')
returns table(user_id uuid,business_name text,business_description text,business_location text,business_phone text)
language sql stable security definer set search_path = public, auth
as $$
 select bp.user_id,bp.business_name,bp.business_description,bp.business_location,bp.business_phone
 from public.business_profiles bp
 where bp.directory_status='approved'
   and (coalesce(trim(p_search),'')='' or bp.business_name ilike '%'||trim(p_search)||'%')
 order by bp.business_name asc limit 60
$$;
revoke all on function public.mj_search_business_directory(text) from public;
grant execute on function public.mj_search_business_directory(text) to anon, authenticated;

-- Admin-only RPC: registration switch, approve/reject applications, plan pricing, and plan assignment.
create or replace function public.mj_creator_set_registration(p_open boolean)
returns void language plpgsql security definer set search_path = public, auth
as $$ begin
 if not public.mj_is_creator_admin() then raise exception 'Creator admin access required'; end if;
 update public.mj_business_control set registration_open=p_open,updated_at=now() where singleton;
end $$;

create or replace function public.mj_creator_save_plan(p_id uuid,p_key text,p_name text,p_description text,p_price numeric,p_days integer,p_trial integer,p_free boolean,p_active boolean)
returns uuid language plpgsql security definer set search_path = public, auth
as $$ declare v_id uuid; begin
 if not public.mj_is_creator_admin() then raise exception 'Creator admin access required'; end if;
 if p_price<0 or p_days<1 or p_trial<0 then raise exception 'Invalid plan values'; end if;
 if p_id is null then
   insert into public.mj_business_plans(plan_key,plan_name,description,price_kes,billing_days,trial_days,is_free,is_active)
   values(lower(regexp_replace(trim(p_key),'[^a-zA-Z0-9_-]+','-','g')),trim(p_name),coalesce(p_description,''),p_price,p_days,p_trial,p_free,p_active) returning id into v_id;
 else
   update public.mj_business_plans set plan_key=lower(regexp_replace(trim(p_key),'[^a-zA-Z0-9_-]+','-','g')),plan_name=trim(p_name),description=coalesce(p_description,''),price_kes=p_price,billing_days=p_days,trial_days=p_trial,is_free=p_free,is_active=p_active,updated_at=now() where id=p_id returning id into v_id;
 end if; return v_id;
end $$;

create or replace function public.mj_creator_review_business(p_application uuid,p_approve boolean,p_plan uuid,p_trial_days integer default 0,p_admin_note text default '')
returns void language plpgsql security definer set search_path = public, auth
as $$ declare a public.mj_business_applications%rowtype; v_end timestamptz; begin
 if not public.mj_is_creator_admin() then raise exception 'Creator admin access required'; end if;
 select * into a from public.mj_business_applications where id=p_application for update;
 if not found then raise exception 'Application not found'; end if;
 update public.mj_business_applications set status=case when p_approve then 'approved' else 'rejected' end,admin_note=coalesce(p_admin_note,''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_application;
 if p_approve then
   if p_plan is null then raise exception 'Choose a plan'; end if;
   v_end:=case when p_trial_days>0 then now()+make_interval(days=>p_trial_days) else (select now()+make_interval(days=>billing_days) from public.mj_business_plans where id=p_plan) end;
   insert into public.business_profiles(user_id,business_name,business_description,business_location,business_phone,directory_status,directory_updated_at,updated_at)
   values(a.user_id,a.business_name,a.description,a.location_text,a.contact_phone,'approved',now(),now())
   on conflict(user_id) do update set business_name=excluded.business_name,business_description=excluded.business_description,business_location=excluded.business_location,business_phone=excluded.business_phone,directory_status='approved',directory_updated_at=now(),updated_at=now();
   insert into public.mj_business_subscriptions(user_id,plan_id,status,starts_at,ends_at,assigned_by,admin_note)
   values(a.user_id,p_plan,case when p_trial_days>0 then 'trial' else 'active' end,now(),v_end,auth.uid(),coalesce(p_admin_note,''));
 end if;
end $$;

create or replace function public.mj_creator_assign_plan(p_user uuid,p_plan uuid,p_days integer default null,p_admin_note text default '')
returns void language plpgsql security definer set search_path = public, auth
as $$ declare v_days integer; begin
 if not public.mj_is_creator_admin() then raise exception 'Creator admin access required'; end if;
 select coalesce(p_days,billing_days) into v_days from public.mj_business_plans where id=p_plan and is_active=true;
 if v_days is null then raise exception 'Plan not found or inactive'; end if;
 update public.business_profiles set directory_status='approved',directory_updated_at=now() where user_id=p_user;
 insert into public.mj_business_subscriptions(user_id,plan_id,status,starts_at,ends_at,assigned_by,admin_note)
 values(p_user,p_plan,case when v_days>0 then 'active' else 'trial' end,now(),now()+make_interval(days=>v_days),auth.uid(),coalesce(p_admin_note,''));
end $$;

create or replace function public.mj_creator_set_business_status(p_user uuid,p_status text)
returns void language plpgsql security definer set search_path = public, auth
as $$ begin
 if not public.mj_is_creator_admin() then raise exception 'Creator admin access required'; end if;
 if p_status not in ('approved','suspended','pending') then raise exception 'Invalid status'; end if;
 update public.business_profiles set directory_status=p_status,directory_updated_at=now() where user_id=p_user;
 if p_status='suspended' then update public.mj_business_subscriptions set status='suspended',updated_at=now() where user_id=p_user and status in ('active','trial'); end if;
end $$;

revoke all on function public.mj_creator_set_registration(boolean) from public;
revoke all on function public.mj_creator_save_plan(uuid,text,text,text,numeric,integer,integer,boolean,boolean) from public;
revoke all on function public.mj_creator_review_business(uuid,boolean,uuid,integer,text) from public;
revoke all on function public.mj_creator_assign_plan(uuid,uuid,integer,text) from public;
revoke all on function public.mj_creator_set_business_status(uuid,text) from public;
grant execute on function public.mj_creator_set_registration(boolean),public.mj_creator_save_plan(uuid,text,text,text,numeric,integer,integer,boolean,boolean),public.mj_creator_review_business(uuid,boolean,uuid,integer,text),public.mj_creator_assign_plan(uuid,uuid,integer,text),public.mj_creator_set_business_status(uuid,text) to authenticated;

-- Creator-only control row is not readable or writable from client sessions.
revoke all on public.mj_business_control from anon,authenticated;

-- IMPORTANT FIRST-TIME SETUP: after running this migration, find your own auth.users.id
-- in Supabase Dashboard > Authentication > Users, then run:
-- update public.mj_business_control set creator_user_id='YOUR-OWN-USER-UUID' where singleton=true;
-- Never use a business owner's ID or share this UUID with other users.

create or replace function public.mj_get_business_registration_open()
returns boolean language sql stable security definer set search_path = public, auth
as $$ select registration_open from public.mj_business_control where singleton $$;
revoke all on function public.mj_get_business_registration_open() from public;
grant execute on function public.mj_get_business_registration_open() to anon,authenticated;

create or replace function public.mj_creator_list_business_profiles(p_search text default '')
returns table(user_id uuid,business_name text,directory_status text)
language plpgsql stable security definer set search_path = public, auth
as $$ begin
 if not public.mj_is_creator_admin() then raise exception 'Creator admin access required'; end if;
 return query select bp.user_id,bp.business_name,bp.directory_status from public.business_profiles bp
 where coalesce(trim(p_search),'')='' or bp.business_name ilike '%'||trim(p_search)||'%'
 order by bp.business_name limit 80;
end $$;
revoke all on function public.mj_creator_list_business_profiles(text) from public;
grant execute on function public.mj_creator_list_business_profiles(text) to authenticated;
