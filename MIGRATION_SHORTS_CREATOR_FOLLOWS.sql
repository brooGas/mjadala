-- Mjadala Shorts creator follows. Run once in Supabase SQL Editor.
-- Uses the existing public.profiles(id) and public.shorts(id) UUID identifiers.
begin;
create table if not exists public.shorts_creator_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, creator_id),
  constraint shorts_creator_follows_not_self check (follower_id <> creator_id)
);
create index if not exists shorts_creator_follows_creator_idx on public.shorts_creator_follows(creator_id);
alter table public.shorts_creator_follows enable row level security;
drop policy if exists shorts_creator_follows_read_signed_in on public.shorts_creator_follows;
create policy shorts_creator_follows_read_signed_in on public.shorts_creator_follows for select to authenticated using (true);
drop policy if exists shorts_creator_follows_insert_own on public.shorts_creator_follows;
create policy shorts_creator_follows_insert_own on public.shorts_creator_follows for insert to authenticated with check (follower_id = (select auth.uid()));
drop policy if exists shorts_creator_follows_delete_own on public.shorts_creator_follows;
create policy shorts_creator_follows_delete_own on public.shorts_creator_follows for delete to authenticated using (follower_id = (select auth.uid()));
grant select, insert, delete on public.shorts_creator_follows to authenticated;
commit;
