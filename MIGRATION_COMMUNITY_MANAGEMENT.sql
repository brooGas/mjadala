-- Mjadala community management: additive, secure RPCs for mj_communities.
-- Run after MIGRATION_LIVE_SOCIAL.sql. Does not disable RLS.
begin;

-- Atomic community creation + creator membership (fixes split-insert/RLS failure).
create or replace function public.mj_create_community(
  p_name text, p_slug text, p_description text default '',
  p_topic text default 'General', p_is_private boolean default false
) returns public.mj_communities
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_row public.mj_communities;
begin
  if v_uid is null then raise exception 'Sign in to create a community.'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 2 and 80 then raise exception 'Community name must be 2–80 characters.'; end if;
  insert into public.mj_communities(name,slug,description,topic,is_private,approval_required,created_by)
  values(trim(p_name),p_slug,left(coalesce(p_description,''),500),coalesce(nullif(trim(p_topic),''),'General'),coalesce(p_is_private,false),coalesce(p_is_private,false),v_uid)
  returning * into v_row;
  insert into public.mj_community_members(community_id,user_id,role) values(v_row.id,v_uid,'owner')
  on conflict(community_id,user_id) do update set role='owner';
  return v_row;
end; $$;

create or replace function public.mj_leave_community(p_community_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_owner uuid; v_role text;
begin
 if v_uid is null then raise exception 'Sign in first.'; end if;
 select created_by into v_owner from public.mj_communities where id=p_community_id;
 if not found then raise exception 'Community not found.'; end if;
 if v_owner=v_uid then raise exception 'The creator cannot leave their own community. Delete it or transfer ownership first.'; end if;
 select role into v_role from public.mj_community_members where community_id=p_community_id and user_id=v_uid;
 if v_role is null then raise exception 'You are not a member of this community.'; end if;
 delete from public.mj_community_members where community_id=p_community_id and user_id=v_uid;
 delete from public.mj_community_join_requests where community_id=p_community_id and user_id=v_uid;
end; $$;

create or replace function public.mj_delete_community(p_community_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 delete from public.mj_communities where id=p_community_id and created_by=auth.uid();
 if not found then raise exception 'Only the creator can delete this community.'; end if;
end; $$;

create or replace function public.mj_set_community_moderator(p_community_id uuid,p_user_id uuid,p_make_moderator boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_owner uuid; v_target_role text;
begin
 if v_uid is null then raise exception 'Sign in first.'; end if;
 select created_by into v_owner from public.mj_communities where id=p_community_id;
 if v_owner is distinct from v_uid then raise exception 'Only the creator can assign or remove admins.'; end if;
 if p_user_id=v_uid then raise exception 'The creator cannot change their own role.'; end if;
 select role into v_target_role from public.mj_community_members where community_id=p_community_id and user_id=p_user_id;
 if v_target_role is null then raise exception 'That person is not a community member.'; end if;
 if v_target_role='owner' then raise exception 'The creator role cannot be changed here.'; end if;
 update public.mj_community_members set role=case when p_make_moderator then 'moderator' else 'member' end
 where community_id=p_community_id and user_id=p_user_id;
end; $$;

create or replace function public.mj_remove_community_member(p_community_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_owner uuid; v_actor_role text; v_target_role text;
begin
 if v_uid is null then raise exception 'Sign in first.'; end if;
 select created_by into v_owner from public.mj_communities where id=p_community_id;
 select role into v_actor_role from public.mj_community_members where community_id=p_community_id and user_id=v_uid;
 select role into v_target_role from public.mj_community_members where community_id=p_community_id and user_id=p_user_id;
 if v_owner is distinct from v_uid and not (v_actor_role='moderator' and v_target_role='member') then
   raise exception 'Only the creator or an admin removing an ordinary member can do this.';
 end if;
 if p_user_id=v_owner or v_target_role in ('owner','moderator') then raise exception 'Creators and admins cannot be removed by this action.'; end if;
 if v_target_role is null then raise exception 'Member not found.'; end if;
 delete from public.mj_community_members where community_id=p_community_id and user_id=p_user_id;
 delete from public.mj_community_join_requests where community_id=p_community_id and user_id=p_user_id;
end; $$;

create or replace function public.mj_list_community_members(p_community_id uuid)
returns table(user_id uuid,role text,nickname text,avatar_url text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_owner uuid;
begin
 if v_uid is null then raise exception 'Sign in first.'; end if;
 select created_by into v_owner from public.mj_communities where id=p_community_id;
 if v_owner is distinct from v_uid and not exists(select 1 from public.mj_community_members m where m.community_id=p_community_id and m.user_id=v_uid and m.role in ('moderator','owner')) then
   raise exception 'Only the creator or an admin can view the member management list.';
 end if;
 return query select m.user_id,m.role,coalesce(p.nickname,'Mjadala member'),p.avatar_url
 from public.mj_community_members m left join public.profiles p on p.id=m.user_id
 where m.community_id=p_community_id order by case m.role when 'owner' then 0 when 'moderator' then 1 else 2 end, p.nickname;
end; $$;

revoke all on function public.mj_create_community(text,text,text,text,boolean) from public,anon;
revoke all on function public.mj_leave_community(uuid) from public,anon;
revoke all on function public.mj_delete_community(uuid) from public,anon;
revoke all on function public.mj_set_community_moderator(uuid,uuid,boolean) from public,anon;
revoke all on function public.mj_remove_community_member(uuid,uuid) from public,anon;
revoke all on function public.mj_list_community_members(uuid) from public,anon;
grant execute on function public.mj_create_community(text,text,text,text,boolean) to authenticated;
grant execute on function public.mj_leave_community(uuid) to authenticated;
grant execute on function public.mj_delete_community(uuid) to authenticated;
grant execute on function public.mj_set_community_moderator(uuid,uuid,boolean) to authenticated;
grant execute on function public.mj_remove_community_member(uuid,uuid) to authenticated;
grant execute on function public.mj_list_community_members(uuid) to authenticated;
commit;
