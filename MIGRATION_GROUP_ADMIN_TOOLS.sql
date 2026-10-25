-- Mjadala Group Creator + Group Admin tools (additive migration)
-- Run once in Supabase SQL Editor. Does not change global app-admin roles.
begin;

alter table public.group_members
  add column if not exists group_role text not null default 'member';

alter table public.group_members drop constraint if exists group_members_group_role_check;
alter table public.group_members add constraint group_members_group_role_check
  check (group_role in ('creator','admin','member'));

-- Mark existing creators in their own groups; preserve any unrelated membership rows.
update public.group_members gm
set group_role = 'creator'
from public.groups g
where g.id = gm.group_id and g.created_by = gm.user_id;

-- New Groups must record their creator role explicitly too.
create or replace function public.create_private_group(p_name text, p_description text default '')
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_id bigint;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if coalesce((select is_banned from public.profiles where id = v_uid), true) then raise exception 'Posting is not allowed for this account'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 3 and 40 then raise exception 'Group name must be 3–40 characters'; end if;
  if char_length(coalesce(p_description, '')) > 180 then raise exception 'Description must be 180 characters or fewer'; end if;
  insert into public.groups(name, description, created_by)
  values (btrim(p_name), btrim(coalesce(p_description, '')), v_uid)
  returning id into v_id;
  insert into public.group_members(group_id, user_id, added_by, group_role)
  values (v_id, v_uid, v_uid, 'creator');
  return v_id;
end;
$$;
revoke all on function public.create_private_group(text, text) from public, anon;
grant execute on function public.create_private_group(text, text) to authenticated;

create or replace function public.is_group_admin(p_group_id bigint, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_user_id and gm.group_role = 'admin'
  );
$$;
revoke all on function public.is_group_admin(bigint, uuid) from public, anon;
grant execute on function public.is_group_admin(bigint, uuid) to authenticated;

-- Only the creator can delete a group; dependent members/messages cascade away.
create or replace function public.delete_private_group(p_group_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not public.is_group_creator(p_group_id, auth.uid()) then raise exception 'Only the group creator can delete this group'; end if;
  delete from public.groups where id = p_group_id and created_by = auth.uid();
  if not found then raise exception 'Group not found or you are not its creator'; end if;
end;
$$;
revoke all on function public.delete_private_group(bigint) from public, anon;
grant execute on function public.delete_private_group(bigint) to authenticated;

-- Creator alone can promote/demote group admins. Target is looked up by exact nickname.
create or replace function public.set_group_admin(p_group_id bigint, p_nickname text, p_make_admin boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_target uuid;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if not public.is_group_creator(p_group_id, v_uid) then raise exception 'Only the group creator can assign group admins'; end if;
  select id into v_target from public.profiles where lower(nickname) = lower(btrim(p_nickname)) limit 1;
  if v_target is null then raise exception 'No registered user has that nickname'; end if;
  if v_target = v_uid then raise exception 'The creator already has full group control'; end if;
  if not exists (select 1 from public.group_members where group_id=p_group_id and user_id=v_target) then
    raise exception 'That user is not a member of this group';
  end if;
  update public.group_members
  set group_role = case when p_make_admin then 'admin' else 'member' end
  where group_id=p_group_id and user_id=v_target and group_role <> 'creator';
end;
$$;
revoke all on function public.set_group_admin(bigint, text, boolean) from public, anon;
grant execute on function public.set_group_admin(bigint, text, boolean) to authenticated;

-- Creator or group admin can remove members. Group admins cannot remove the creator or another admin.
create or replace function public.remove_group_member(p_group_id bigint, p_nickname text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_target uuid; v_actor_is_creator boolean; v_actor_is_admin boolean; v_target_role text;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  v_actor_is_creator := public.is_group_creator(p_group_id, v_uid);
  v_actor_is_admin := public.is_group_admin(p_group_id, v_uid);
  if not v_actor_is_creator and not v_actor_is_admin then raise exception 'Only group creators or admins can remove members'; end if;
  select id into v_target from public.profiles where lower(nickname) = lower(btrim(p_nickname)) limit 1;
  if v_target is null then raise exception 'No registered user has that nickname'; end if;
  select group_role into v_target_role from public.group_members where group_id=p_group_id and user_id=v_target;
  if v_target_role is null then raise exception 'That user is not in this group'; end if;
  if v_target = v_uid then raise exception 'Use Leave group to remove yourself'; end if;
  if public.is_group_creator(p_group_id, v_target) then raise exception 'The group creator cannot be removed'; end if;
  if not v_actor_is_creator and v_target_role <> 'member' then raise exception 'Group admins can only remove regular members'; end if;
  delete from public.group_members where group_id=p_group_id and user_id=v_target;
end;
$$;
revoke all on function public.remove_group_member(bigint, text) from public, anon;
grant execute on function public.remove_group_member(bigint, text) to authenticated;

-- Replace invite function so group admins can invite too; role assignment remains creator-only.
create or replace function public.add_group_member(p_group_id bigint, p_nickname text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_target uuid;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if not public.is_group_creator(p_group_id, v_uid) and not public.is_group_admin(p_group_id, v_uid) then
    raise exception 'Only the group creator or a group admin can invite members';
  end if;
  select id into v_target from public.profiles where lower(nickname) = lower(btrim(p_nickname)) limit 1;
  if v_target is null then raise exception 'No registered user has that nickname'; end if;
  insert into public.group_members(group_id, user_id, added_by, group_role)
  values (p_group_id, v_target, v_uid, 'member')
  on conflict (group_id, user_id) do nothing;
  return v_target;
end;
$$;
revoke all on function public.add_group_member(bigint, text) from public, anon;
grant execute on function public.add_group_member(bigint, text) to authenticated;

commit;
