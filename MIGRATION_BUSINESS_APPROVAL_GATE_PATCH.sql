-- MJADALA BUSINESS APPROVAL / PUBLISHING SECURITY PATCH
-- Run in Supabase SQL Editor after MIGRATION_BUSINESS_DIRECTORY_ADMIN.sql.
-- This reinforces creator-only approval and requires approval + an active plan
-- for every product insert or attempt to publish/republish.

create or replace function public.mj_business_can_publish(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.business_profiles bp
    join public.mj_business_subscriptions s on s.user_id = bp.user_id
    where bp.user_id = p_user
      and bp.directory_status = 'approved'
      and s.status in ('trial','active')
      and s.starts_at <= now()
      and (s.ends_at is null or s.ends_at > now())
  );
$$;
revoke all on function public.mj_business_can_publish(uuid) from public, anon;
grant execute on function public.mj_business_can_publish(uuid) to authenticated;

-- Sellers cannot self-approve by writing directly to business_profiles.
create or replace function public.mj_protect_business_directory_status()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is not null and not public.mj_is_creator_admin() then
    if tg_op = 'INSERT' then
      new.directory_status := 'pending';
      new.directory_updated_at := now();
    elsif new.directory_status is distinct from old.directory_status then
      new.directory_status := old.directory_status;
      new.directory_updated_at := old.directory_updated_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mj_protect_business_directory_status on public.business_profiles;
create trigger mj_protect_business_directory_status
before insert or update of directory_status on public.business_profiles
for each row execute function public.mj_protect_business_directory_status();

-- Database-level enforcement: applies to product creation, updates and republishing.
create or replace function public.mj_enforce_business_publish_access()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.published is true and not public.mj_business_can_publish(new.seller_id) then
    raise exception 'Business approval required: your business must be approved by Mjadala and have an active plan before publishing products.';
  end if;
  return new;
end;
$$;

drop trigger if exists mj_business_publish_access on public.business_products;
create trigger mj_business_publish_access
before insert or update of published, seller_id on public.business_products
for each row execute function public.mj_enforce_business_publish_access();

notify pgrst, 'reload schema';
