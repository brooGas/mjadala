-- Mjadala private Groups foundation. Safe additive migration; does not alter existing rooms/messages.
begin;

create table if not exists public.groups (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 3 and 40),
  description text not null default '' check (char_length(description) <= 180),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id bigint not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_messages (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists group_messages_group_id_id_idx on public.group_messages(group_id, id desc);
create index if not exists group_members_user_id_idx on public.group_members(user_id, group_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

-- Small SECURITY DEFINER helpers avoid recursive membership-policy evaluation.
create or replace function public.is_group_member(p_group_id bigint, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_user_id
  );
$$;

create or replace function public.is_group_creator(p_group_id bigint, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group_id and g.created_by = p_user_id
  );
$$;

revoke all on function public.is_group_member(bigint, uuid) from public, anon;
revoke all on function public.is_group_creator(bigint, uuid) from public, anon;
grant execute on function public.is_group_member(bigint, uuid) to authenticated;
grant execute on function public.is_group_creator(bigint, uuid) to authenticated;

-- A user sees only Groups they belong to; creator is automatically added on creation.
drop policy if exists groups_select_members on public.groups;
create policy groups_select_members on public.groups for select to authenticated
using (public.is_group_member(id, auth.uid()));

drop policy if exists groups_insert_self_creator on public.groups;
create policy groups_insert_self_creator on public.groups for insert to authenticated
with check (created_by = (select auth.uid()) and not coalesce((select is_banned from public.profiles where id = auth.uid()), true));

drop policy if exists groups_update_creator on public.groups;
create policy groups_update_creator on public.groups for update to authenticated
using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

drop policy if exists groups_delete_creator on public.groups;
create policy groups_delete_creator on public.groups for delete to authenticated
using (created_by = (select auth.uid()));

-- Members can view the membership roster of Groups they belong to.
drop policy if exists group_members_select_members on public.group_members;
create policy group_members_select_members on public.group_members for select to authenticated
using (public.is_group_member(group_id, auth.uid()));

-- Only the creator can add members. They cannot assign membership to arbitrary groups.
drop policy if exists group_members_insert_creator on public.group_members;
create policy group_members_insert_creator on public.group_members for insert to authenticated
with check (public.is_group_creator(group_id, auth.uid()) and added_by = (select auth.uid()));

-- Creator manages membership; members may leave themselves, but cannot remove the creator.
drop policy if exists group_members_delete_creator_or_self on public.group_members;
create policy group_members_delete_creator_or_self on public.group_members for delete to authenticated
using (
  public.is_group_creator(group_id, auth.uid())
  or (user_id = (select auth.uid()) and not public.is_group_creator(group_id, user_id))
);

-- Only group members can read/send messages. Sender identity must be the signed-in user.
drop policy if exists group_messages_select_members on public.group_messages;
create policy group_messages_select_members on public.group_messages for select to authenticated
using (public.is_group_member(group_id, auth.uid()));

drop policy if exists group_messages_insert_members on public.group_messages;
create policy group_messages_insert_members on public.group_messages for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.is_group_member(group_id, auth.uid())
  and not coalesce((select is_banned from public.profiles where id = auth.uid()), true)
);

drop policy if exists group_messages_delete_author_or_staff on public.group_messages;
create policy group_messages_delete_author_or_staff on public.group_messages for delete to authenticated
using (
  author_id = (select auth.uid())
  or public.is_staff()
);

-- Creating a Group and its creator membership must happen atomically through this RPC.
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
  insert into public.group_members(group_id, user_id, added_by) values (v_id, v_uid, v_uid);
  return v_id;
end;
$$;
revoke all on function public.create_private_group(text, text) from public, anon;
grant execute on function public.create_private_group(text, text) to authenticated;

-- Creator-only RPC for adding an existing registered user by nickname.
create or replace function public.add_group_member(p_group_id bigint, p_nickname text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_target uuid;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if not public.is_group_creator(p_group_id, v_uid) then raise exception 'Only the Group creator can add members'; end if;
  select id into v_target from public.profiles where lower(nickname) = lower(btrim(p_nickname)) limit 1;
  if v_target is null then raise exception 'No registered user has that nickname'; end if;
  insert into public.group_members(group_id, user_id, added_by)
  values (p_group_id, v_target, v_uid)
  on conflict (group_id, user_id) do nothing;
  return v_target;
end;
$$;
revoke all on function public.add_group_member(bigint, text) from public, anon;
grant execute on function public.add_group_member(bigint, text) to authenticated;

commit;
