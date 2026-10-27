-- Mjadala Draft 2: additive community visibility and join requests.
-- Safe to run after MIGRATION_PRIVATE_GROUPS.sql and MIGRATION_GROUP_ADMIN_TOOLS.sql.
-- Does not delete or rewrite existing groups, members, messages, or rooms.
begin;

alter table public.groups
  add column if not exists visibility text not null default 'private',
  add column if not exists avatar_url text,
  add column if not exists cover_url text,
  add column if not exists rules text not null default '';

alter table public.groups drop constraint if exists groups_visibility_check;
alter table public.groups add constraint groups_visibility_check
  check (visibility in ('public','private','hidden'));

create table if not exists public.group_join_requests (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null default '' check (char_length(message) <= 240),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  unique (group_id,user_id)
);
create index if not exists group_join_requests_owner_queue_idx
  on public.group_join_requests(group_id,status,created_at desc);

alter table public.groups enable row level security;
alter table public.group_join_requests enable row level security;

drop policy if exists groups_select_members on public.groups;
drop policy if exists groups_select_visible_draft2 on public.groups;
create policy groups_select_visible_draft2 on public.groups for select to authenticated
using (
  public.is_group_member(id,auth.uid())
  or visibility = 'public'
  or (visibility = 'private' and auth.uid() is not null)
);

-- Join requests are visible to the requester and the community owner/admins.
drop policy if exists group_join_requests_select_parties on public.group_join_requests;
create policy group_join_requests_select_parties on public.group_join_requests for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_group_creator(group_id,(select auth.uid()))
  or exists (select 1 from public.group_members gm where gm.group_id = group_join_requests.group_id and gm.user_id = (select auth.uid()) and gm.group_role = 'admin')
);
drop policy if exists group_join_requests_insert_self on public.group_join_requests;
create policy group_join_requests_insert_self on public.group_join_requests for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending' and exists (select 1 from public.groups g where g.id = group_id and g.visibility = 'private') and not public.is_group_member(group_id,(select auth.uid())));
drop policy if exists group_join_requests_update_owner on public.group_join_requests;
create policy group_join_requests_update_owner on public.group_join_requests for update to authenticated
using (public.is_group_creator(group_id,(select auth.uid())) or exists (
  select 1 from public.group_members gm where gm.group_id = group_join_requests.group_id and gm.user_id = (select auth.uid()) and gm.group_role = 'admin'
))
with check (status in ('approved','rejected','cancelled'));

create or replace function public.create_community_group(p_name text,p_description text default '',p_visibility text default 'private')
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_id bigint; v_visibility text := lower(coalesce(p_visibility,'private'));
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if coalesce((select is_banned from public.profiles where id=v_uid),true) then raise exception 'Posting is not allowed for this account'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 3 and 40 then raise exception 'Community name must be 3–40 characters'; end if;
  if char_length(coalesce(p_description,'')) > 180 then raise exception 'Description must be 180 characters or fewer'; end if;
  if v_visibility not in ('public','private','hidden') then raise exception 'Choose public, private, or hidden'; end if;
  insert into public.groups(name,description,created_by,visibility)
  values(btrim(p_name),btrim(coalesce(p_description,'')),v_uid,v_visibility) returning id into v_id;
  insert into public.group_members(group_id,user_id,added_by,group_role) values(v_id,v_uid,v_uid,'admin');
  return v_id;
end;
$$;
revoke all on function public.create_community_group(text,text,text) from public,anon;
grant execute on function public.create_community_group(text,text,text) to authenticated;

create or replace function public.join_public_community(p_group_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_visibility text;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  select visibility into v_visibility from public.groups where id=p_group_id;
  if v_visibility is distinct from 'public' then raise exception 'This community is not open for direct joining'; end if;
  if coalesce((select is_banned from public.profiles where id=v_uid),true) then raise exception 'Posting is not allowed for this account'; end if;
  insert into public.group_members(group_id,user_id,added_by,group_role) values(p_group_id,v_uid,v_uid,'member') on conflict(group_id,user_id) do nothing;
end;
$$;
revoke all on function public.join_public_community(bigint) from public,anon;
grant execute on function public.join_public_community(bigint) to authenticated;

create or replace function public.request_private_community_join(p_group_id bigint,p_message text default '')
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_visibility text; v_request_id bigint;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  select visibility into v_visibility from public.groups where id=p_group_id;
  if v_visibility is distinct from 'private' then raise exception 'Join requests are only for private communities'; end if;
  if public.is_group_member(p_group_id,v_uid) then raise exception 'You already belong to this community'; end if;
  insert into public.group_join_requests(group_id,user_id,message,status)
  values(p_group_id,v_uid,left(coalesce(p_message,''),240),'pending')
  on conflict(group_id,user_id) do update set message=excluded.message,status='pending',created_at=now(),reviewed_at=null,reviewed_by=null
  returning id into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function public.request_private_community_join(bigint,text) from public,anon;
grant execute on function public.request_private_community_join(bigint,text) to authenticated;

create or replace function public.review_private_community_join(p_request_id bigint,p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_group_id bigint; v_user_id uuid; v_status text;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  select group_id,user_id,status into v_group_id,v_user_id,v_status from public.group_join_requests where id=p_request_id for update;
  if v_group_id is null then raise exception 'Join request not found'; end if;
  if not (public.is_group_creator(v_group_id,v_uid) or exists(select 1 from public.group_members gm where gm.group_id=v_group_id and gm.user_id=v_uid and gm.group_role='admin')) then raise exception 'Only the owner or an admin can review requests'; end if;
  if v_status <> 'pending' then raise exception 'This request has already been reviewed'; end if;
  update public.group_join_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewed_at=now(),reviewed_by=v_uid where id=p_request_id;
  if p_approve then insert into public.group_members(group_id,user_id,added_by,group_role) values(v_group_id,v_user_id,v_uid,'member') on conflict(group_id,user_id) do nothing; end if;
end;
$$;
revoke all on function public.review_private_community_join(bigint,boolean) from public,anon;
grant execute on function public.review_private_community_join(bigint,boolean) to authenticated;

-- WhatsApp-style group media/file messages. Storage remains private; clients receive short-lived signed links.
alter table public.group_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text,
  add column if not exists edited_at timestamptz;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('group-media','group-media',false,20971520,array['image/jpeg','image/png','image/webp','image/avif','image/gif','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public=false,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists group_media_read_members on storage.objects;
create policy group_media_read_members on storage.objects for select to authenticated
using (case when bucket_id='group-media' and (storage.foldername(name))[1] ~ '^[0-9]+$' then public.is_group_member(((storage.foldername(name))[1])::bigint,(select auth.uid())) else false end);
drop policy if exists group_media_upload_members on storage.objects;
create policy group_media_upload_members on storage.objects for insert to authenticated
with check (case when bucket_id='group-media' and (storage.foldername(name))[1] ~ '^[0-9]+$' then (storage.foldername(name))[2]=(select auth.uid())::text and public.is_group_member(((storage.foldername(name))[1])::bigint,(select auth.uid())) else false end);
drop policy if exists group_media_delete_uploader_or_owner on storage.objects;
create policy group_media_delete_uploader_or_owner on storage.objects for delete to authenticated
using (case when bucket_id='group-media' and (storage.foldername(name))[1] ~ '^[0-9]+$' then (storage.foldername(name))[2]=(select auth.uid())::text or public.is_group_creator(((storage.foldername(name))[1])::bigint,(select auth.uid())) else false end);

commit;
