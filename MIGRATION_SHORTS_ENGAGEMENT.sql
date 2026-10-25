-- Mjadala Shorts: likes and comments. Run once in Supabase SQL Editor.
-- Assumes public.shorts uses the MIGRATION_SHORTS.sql schema.
begin;

create table if not exists public.shorts_likes (
  short_id bigint not null references public.shorts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (short_id, user_id)
);
alter table public.shorts_likes enable row level security;
drop policy if exists shorts_likes_read_signed_in on public.shorts_likes;
create policy shorts_likes_read_signed_in on public.shorts_likes for select to authenticated using (true);
drop policy if exists shorts_likes_insert_own on public.shorts_likes;
create policy shorts_likes_insert_own on public.shorts_likes for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists shorts_likes_delete_own on public.shorts_likes;
create policy shorts_likes_delete_own on public.shorts_likes for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.shorts_comments (
  id bigint generated always as identity primary key,
  short_id bigint not null references public.shorts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists shorts_comments_feed_idx on public.shorts_comments(short_id, created_at desc);
alter table public.shorts_comments enable row level security;
drop policy if exists shorts_comments_read_signed_in on public.shorts_comments;
create policy shorts_comments_read_signed_in on public.shorts_comments for select to authenticated using (true);
drop policy if exists shorts_comments_insert_own on public.shorts_comments;
create policy shorts_comments_insert_own on public.shorts_comments for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists shorts_comments_delete_own on public.shorts_comments;
create policy shorts_comments_delete_own on public.shorts_comments for delete to authenticated using (user_id = (select auth.uid()));
commit;
