-- Mjadala live social foundation (additive; preserves existing tables)
-- Run in Supabase SQL Editor before deploying the matching frontend.
begin;
create extension if not exists pgcrypto;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists avatar_url text;

create table if not exists public.mj_communities (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(trim(name)) between 2 and 80),
 slug text not null unique,
 description text not null default '' check (char_length(description) <= 500),
 topic text not null default 'General',
 is_private boolean not null default false,
 approval_required boolean not null default false,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create table if not exists public.mj_community_members (
 community_id uuid not null references public.mj_communities(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'member' check (role in ('member','moderator','owner')),
 joined_at timestamptz not null default now(),
 primary key (community_id,user_id)
);
create table if not exists public.mj_community_join_requests (
 id uuid primary key default gen_random_uuid(),
 community_id uuid not null references public.mj_communities(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 message text not null default '' check (char_length(message) <= 500),
 status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
 created_at timestamptz not null default now(),
 unique (community_id,user_id)
);
create table if not exists public.mj_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references auth.users(id) on delete cascade,
 community_id uuid references public.mj_communities(id) on delete cascade,
 topic text not null default 'General',
 body text not null check (char_length(trim(body)) between 1 and 3000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.mj_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.mj_posts(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 parent_id uuid references public.mj_comments(id) on delete cascade,
 body text not null check (char_length(trim(body)) between 1 and 1500),
 created_at timestamptz not null default now()
);
create table if not exists public.mj_post_likes (
 post_id uuid not null references public.mj_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(post_id,user_id)
);
create table if not exists public.mj_post_saves (
 post_id uuid not null references public.mj_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(post_id,user_id)
);
create table if not exists public.mj_user_presence (
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_seen_at timestamptz not null default now(),
 show_online boolean not null default true
);
create table if not exists public.mj_content_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 content_type text not null check(content_type in ('post','comment','reel','community')),
 content_id text not null,
 reason text not null check(char_length(trim(reason)) between 3 and 1000),
 status text not null default 'pending' check(status in ('pending','reviewed','dismissed','actioned')),
 created_at timestamptz not null default now()
);
create index if not exists mj_content_reports_status_idx on public.mj_content_reports(status,created_at desc);
alter table public.mj_content_reports enable row level security;
drop policy if exists mj_reports_insert_own on public.mj_content_reports;
create policy mj_reports_insert_own on public.mj_content_reports for insert to authenticated with check(reporter_id=auth.uid());
drop policy if exists mj_reports_read_own on public.mj_content_reports;
create policy mj_reports_read_own on public.mj_content_reports for select to authenticated using(reporter_id=auth.uid());
grant insert,select on public.mj_content_reports to authenticated;

create index if not exists mj_posts_feed_idx on public.mj_posts(created_at desc);
create index if not exists mj_posts_community_idx on public.mj_posts(community_id,created_at desc);
create index if not exists mj_comments_post_idx on public.mj_comments(post_id,created_at asc);
create or replace function public.mj_validate_comment_parent()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.parent_id is not null and not exists(select 1 from public.mj_comments parent where parent.id=new.parent_id and parent.post_id=new.post_id) then
   raise exception 'A reply must belong to the same conversation as its parent comment';
 end if;
 return new;
end $$;
drop trigger if exists mj_comment_parent_guard on public.mj_comments;
create trigger mj_comment_parent_guard before insert or update of parent_id,post_id on public.mj_comments for each row execute function public.mj_validate_comment_parent();

create index if not exists mj_communities_topic_idx on public.mj_communities(topic,name);
create index if not exists mj_join_requests_user_idx on public.mj_community_join_requests(user_id,status,created_at desc);

alter table public.mj_communities enable row level security;
alter table public.mj_community_members enable row level security;
alter table public.mj_community_join_requests enable row level security;
alter table public.mj_posts enable row level security;
alter table public.mj_comments enable row level security;
alter table public.mj_post_likes enable row level security;
alter table public.mj_post_saves enable row level security;
alter table public.mj_user_presence enable row level security;

drop policy if exists mj_communities_read on public.mj_communities;
create policy mj_communities_read on public.mj_communities for select to anon,authenticated using (not is_private or exists(select 1 from public.mj_community_members m where m.community_id=id and m.user_id=auth.uid()));
drop policy if exists mj_communities_create on public.mj_communities;
create policy mj_communities_create on public.mj_communities for insert to authenticated with check (created_by=auth.uid());
drop policy if exists mj_communities_owner_update on public.mj_communities;
create policy mj_communities_owner_update on public.mj_communities for update to authenticated using (created_by=auth.uid()) with check (created_by=auth.uid());
drop policy if exists mj_communities_owner_delete on public.mj_communities;
create policy mj_communities_owner_delete on public.mj_communities for delete to authenticated using (created_by=auth.uid());

drop policy if exists mj_members_read on public.mj_community_members;
create policy mj_members_read on public.mj_community_members for select to authenticated using (user_id=auth.uid());
drop policy if exists mj_members_join_self on public.mj_community_members;
create policy mj_members_join_self on public.mj_community_members for insert to authenticated with check (user_id=auth.uid() and ((role='member' and exists(select 1 from public.mj_communities c where c.id=community_id and not c.is_private and not c.approval_required)) or (role='owner' and exists(select 1 from public.mj_communities c where c.id=community_id and c.created_by=auth.uid()))));
drop policy if exists mj_members_leave_self on public.mj_community_members;
create policy mj_members_leave_self on public.mj_community_members for delete to authenticated using (user_id=auth.uid() and role='member');

drop policy if exists mj_join_requests_read_own on public.mj_community_join_requests;
create policy mj_join_requests_read_own on public.mj_community_join_requests for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.mj_community_members m where m.community_id=public.mj_community_join_requests.community_id and m.user_id=auth.uid() and m.role in ('owner','moderator')));
drop policy if exists mj_join_requests_create_own on public.mj_community_join_requests;
create policy mj_join_requests_create_own on public.mj_community_join_requests for insert to authenticated with check (user_id=auth.uid() and status='pending' and exists(select 1 from public.mj_communities c where c.id=community_id and (c.is_private or c.approval_required)));
drop policy if exists mj_join_requests_cancel_own on public.mj_community_join_requests;
create policy mj_join_requests_cancel_own on public.mj_community_join_requests for delete to authenticated using (user_id=auth.uid() and status in ('pending','rejected'));

drop policy if exists mj_posts_read_public on public.mj_posts;
create policy mj_posts_read_public on public.mj_posts for select to anon,authenticated using (community_id is null or exists(select 1 from public.mj_communities c where c.id=public.mj_posts.community_id and not c.is_private) or exists(select 1 from public.mj_community_members m where m.community_id=public.mj_posts.community_id and m.user_id=auth.uid()));
drop policy if exists mj_posts_insert_own on public.mj_posts;
create policy mj_posts_insert_own on public.mj_posts for insert to authenticated with check (author_id=auth.uid() and (community_id is null or exists(select 1 from public.mj_community_members m where m.community_id=public.mj_posts.community_id and m.user_id=auth.uid())));
drop policy if exists mj_posts_update_own on public.mj_posts;
create policy mj_posts_update_own on public.mj_posts for update to authenticated using (author_id=auth.uid()) with check (author_id=auth.uid() and (community_id is null or exists(select 1 from public.mj_community_members m where m.community_id=public.mj_posts.community_id and m.user_id=auth.uid())));
drop policy if exists mj_posts_delete_own on public.mj_posts;
create policy mj_posts_delete_own on public.mj_posts for delete to authenticated using (author_id=auth.uid());

drop policy if exists mj_comments_read on public.mj_comments;
create policy mj_comments_read on public.mj_comments for select to anon,authenticated using (exists(select 1 from public.mj_posts p where p.id=post_id));
drop policy if exists mj_comments_insert_own on public.mj_comments;
create policy mj_comments_insert_own on public.mj_comments for insert to authenticated with check (author_id=auth.uid() and exists(select 1 from public.mj_posts p where p.id=post_id));
drop policy if exists mj_comments_delete_own on public.mj_comments;
create policy mj_comments_delete_own on public.mj_comments for delete to authenticated using (author_id=auth.uid());

drop policy if exists mj_post_likes_read on public.mj_post_likes;
create policy mj_post_likes_read on public.mj_post_likes for select to authenticated using (user_id=auth.uid());
drop policy if exists mj_post_likes_insert_own on public.mj_post_likes;
create policy mj_post_likes_insert_own on public.mj_post_likes for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.mj_posts p where p.id=post_id and (p.community_id is null or exists(select 1 from public.mj_communities c where c.id=p.community_id and not c.is_private) or exists(select 1 from public.mj_community_members m where m.community_id=p.community_id and m.user_id=auth.uid()))));
drop policy if exists mj_post_likes_delete_own on public.mj_post_likes;
create policy mj_post_likes_delete_own on public.mj_post_likes for delete to authenticated using (user_id=auth.uid());
drop policy if exists mj_post_saves_read_own on public.mj_post_saves;
create policy mj_post_saves_read_own on public.mj_post_saves for select to authenticated using (user_id=auth.uid());
drop policy if exists mj_post_saves_insert_own on public.mj_post_saves;
create policy mj_post_saves_insert_own on public.mj_post_saves for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.mj_posts p where p.id=post_id and (p.community_id is null or exists(select 1 from public.mj_communities c where c.id=p.community_id and not c.is_private) or exists(select 1 from public.mj_community_members m where m.community_id=p.community_id and m.user_id=auth.uid()))));
drop policy if exists mj_post_saves_delete_own on public.mj_post_saves;
create policy mj_post_saves_delete_own on public.mj_post_saves for delete to authenticated using (user_id=auth.uid());

drop policy if exists mj_presence_read on public.mj_user_presence;
create policy mj_presence_read on public.mj_user_presence for select to authenticated using (show_online or user_id=auth.uid());
drop policy if exists mj_presence_upsert_own on public.mj_user_presence;
create policy mj_presence_upsert_own on public.mj_user_presence for insert to authenticated with check (user_id=auth.uid());
drop policy if exists mj_presence_update_own on public.mj_user_presence;
create policy mj_presence_update_own on public.mj_user_presence for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Owners/moderators can approve or reject requests without exposing broad table updates.
create or replace function public.mj_review_community_join_request(p_request_id uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_req public.mj_community_join_requests%rowtype; v_owner uuid;
begin
 if v_uid is null then raise exception 'Sign in required'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
 select * into v_req from public.mj_community_join_requests where id=p_request_id for update;
 if not found then raise exception 'Join request not found'; end if;
 select created_by into v_owner from public.mj_communities where id=v_req.community_id;
 if v_owner is distinct from v_uid and not exists(select 1 from public.mj_community_members m where m.community_id=v_req.community_id and m.user_id=v_uid and m.role in ('owner','moderator')) then
   raise exception 'Only this community owner or moderator can review requests';
 end if;
 if v_req.status <> 'pending' then raise exception 'This request has already been reviewed'; end if;
 update public.mj_community_join_requests set status=p_decision where id=p_request_id;
 if p_decision='approved' then
   insert into public.mj_community_members(community_id,user_id,role) values(v_req.community_id,v_req.user_id,'member') on conflict(community_id,user_id) do nothing;
 end if;
 return jsonb_build_object('request_id',p_request_id,'status',p_decision);
end $$;
revoke all on function public.mj_review_community_join_request(uuid,text) from public,anon;
grant execute on function public.mj_review_community_join_request(uuid,text) to authenticated;

-- Profile photos: final cropped image uploaded to a user-owned folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mj-profile-photos','mj-profile-photos',true,4194304,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=true,file_size_limit=4194304,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists mj_profile_photo_public_read on storage.objects;
create policy mj_profile_photo_public_read on storage.objects for select to public using(bucket_id='mj-profile-photos');
drop policy if exists mj_profile_photo_insert_own on storage.objects;
create policy mj_profile_photo_insert_own on storage.objects for insert to authenticated with check(bucket_id='mj-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists mj_profile_photo_update_own on storage.objects;
create policy mj_profile_photo_update_own on storage.objects for update to authenticated using(bucket_id='mj-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='mj-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists mj_profile_photo_delete_own on storage.objects;
create policy mj_profile_photo_delete_own on storage.objects for delete to authenticated using(bucket_id='mj-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);

-- Seed a small set of real community records only if not already present.
insert into public.mj_communities(name,slug,description,topic,is_private,approval_required)
values
 ('Engineering & Technology','engineering-technology','Mechanical, electrical, software and practical engineering ideas.','Engineering',false,false),
 ('Business & Entrepreneurship','business-entrepreneurship','Build, market and grow a business with practical advice.','Business',false,false),
 ('Innovation & Invention','innovation-invention','Prototypes, research, design and new ideas.','Innovation',false,false),
 ('Education & Careers','education-careers','Learning, jobs, mentorship and career development.','Education',false,false)
on conflict(slug) do nothing;

-- Return aggregate counts without exposing the user IDs behind individual likes.
create or replace function public.mj_get_post_engagement(p_post_ids uuid[])
returns table(post_id uuid,like_count bigint,comment_count bigint)
language sql stable security definer set search_path='' as $$
 select p.id,
   (select count(*) from public.mj_post_likes l where l.post_id=p.id),
   (select count(*) from public.mj_comments c where c.post_id=p.id)
 from public.mj_posts p
 where p.id=any(coalesce(p_post_ids,'{}'::uuid[]))
   and (p.community_id is null
     or exists(select 1 from public.mj_communities c where c.id=p.community_id and not c.is_private)
     or exists(select 1 from public.mj_community_members m where m.community_id=p.community_id and m.user_id=auth.uid()))
 limit 50
$$;
revoke all on function public.mj_get_post_engagement(uuid[]) from public;
grant execute on function public.mj_get_post_engagement(uuid[]) to anon,authenticated;

grant select on public.mj_communities to anon, authenticated;
grant insert, update, delete on public.mj_communities to authenticated;
grant select, insert, delete on public.mj_community_members to authenticated;
grant select, insert, delete on public.mj_community_join_requests to authenticated;
grant select on public.mj_posts to anon, authenticated;
grant insert, update, delete on public.mj_posts to authenticated;
grant select on public.mj_comments to anon, authenticated;
grant insert, delete on public.mj_comments to authenticated;
grant select on public.mj_post_likes to anon, authenticated;
grant insert, delete on public.mj_post_likes to authenticated;
grant select, insert, delete on public.mj_post_saves to authenticated;
grant select, insert, update on public.mj_user_presence to authenticated;

-- Enable realtime publication only when the standard publication exists.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  begin alter publication supabase_realtime add table public.mj_posts; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.mj_comments; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.mj_communities; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.mj_community_members; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.mj_post_likes; exception when duplicate_object then null; when undefined_object then null; end;
  if to_regclass('public.business_products') is not null then begin execute 'alter publication supabase_realtime add table public.business_products'; exception when duplicate_object then null; end; end if;
  if to_regclass('public.shorts') is not null then begin execute 'alter publication supabase_realtime add table public.shorts'; exception when duplicate_object then null; end; end if;
  if to_regclass('public.shorts_likes') is not null then begin execute 'alter publication supabase_realtime add table public.shorts_likes'; exception when duplicate_object then null; end; end if;
  if to_regclass('public.shorts_comments') is not null then begin execute 'alter publication supabase_realtime add table public.shorts_comments'; exception when duplicate_object then null; end; end if;
 end if;
end $$;
commit;
