-- Mjadala Engineering Hub: additive migration.
-- Requires the existing public.mj_is_creator_admin() security-definer helper,
-- and the tables created by MIGRATION_LIVE_SOCIAL.sql (mj_communities, mj_posts,
-- mj_community_members). Safe to run multiple times. Does not alter Reels,
-- business plans, subscriptions, products, orders, Daraja or advertising.

-- 1. Let a community carry an Engineering subtopic and a verified badge.
--    Both columns are optional/nullable-or-defaulted, so every existing
--    community in every other topic is completely unaffected.
alter table public.mj_communities add column if not exists subtopic text;
alter table public.mj_communities add column if not exists is_verified boolean not null default false;

-- 2. Let a post be tagged with a type (for the Questions / Projects / Tutorials /
--    News tabs on a community page) and carry photos. A post with no type is
--    treated as a plain discussion everywhere else in the app, unchanged.
alter table public.mj_posts add column if not exists post_type text;
alter table public.mj_posts add column if not exists image_urls text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mj_posts_post_type_check'
  ) then
    alter table public.mj_posts
      add constraint mj_posts_post_type_check
      check (post_type is null or post_type in ('question','project','tutorial','news'));
  end if;
end $$;

-- 3. Curated trending stories. live-social.js has quietly expected this table
--    since launch (it degrades gracefully when the table is missing) — this
--    finally creates it, with an optional subtopic for filtering by subject.
create table if not exists public.mj_trending_stories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 500),
  image_url text,
  source_url text,
  source_label text,
  topic text not null default 'General',
  subtopic text,
  post_id uuid references public.mj_posts(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint mj_trending_stories_url check (source_url is null or source_url ~* '^https?://')
);

create index if not exists mj_trending_stories_public_idx
  on public.mj_trending_stories (topic, is_active, created_at desc);

alter table public.mj_trending_stories enable row level security;

drop policy if exists "Public can view active trending stories" on public.mj_trending_stories;
create policy "Public can view active trending stories"
  on public.mj_trending_stories for select to anon, authenticated
  using (is_active = true);

drop policy if exists "Admins can manage trending stories" on public.mj_trending_stories;
create policy "Admins can manage trending stories"
  on public.mj_trending_stories for all to authenticated
  using (public.mj_is_creator_admin())
  with check (public.mj_is_creator_admin());

-- 4. Engineering Learning Hub resources (courses/tutorials list behind "Start Learning").
create table if not exists public.mj_learning_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 500),
  url text,
  topic text not null default 'Engineering',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint mj_learning_resources_url check (url is null or url ~* '^https?://')
);

create index if not exists mj_learning_resources_public_idx
  on public.mj_learning_resources (topic, is_active, sort_order);

alter table public.mj_learning_resources enable row level security;

drop policy if exists "Public can view active learning resources" on public.mj_learning_resources;
create policy "Public can view active learning resources"
  on public.mj_learning_resources for select to anon, authenticated
  using (is_active = true);

drop policy if exists "Admins can manage learning resources" on public.mj_learning_resources;
create policy "Admins can manage learning resources"
  on public.mj_learning_resources for all to authenticated
  using (public.mj_is_creator_admin())
  with check (public.mj_is_creator_admin());

-- 5. Storage: trending-story photos (admin-only upload, public read).
--    live-social.js already uploads here when an admin publishes a story;
--    this bucket was simply never created.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mj-trending-photos', 'mj-trending-photos', true, 6291456,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 6291456,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload trending photos" on storage.objects;
create policy "Admins upload trending photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mj-trending-photos' and public.mj_is_creator_admin());

drop policy if exists "Public read trending photos" on storage.objects;
create policy "Public read trending photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'mj-trending-photos');

drop policy if exists "Admins delete trending photos" on storage.objects;
create policy "Admins delete trending photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mj-trending-photos' and public.mj_is_creator_admin());

-- 6. Storage: photos attached to community posts (e.g. a project photo in
--    Mechanical Engineering). Any member can upload into their own folder;
--    everyone can read; only the uploader or an admin can delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mj-community-posts', 'mj-community-posts', true, 8388608,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 8388608,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners upload own community post photos" on storage.objects;
create policy "Owners upload own community post photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mj-community-posts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Public read community post photos" on storage.objects;
create policy "Public read community post photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'mj-community-posts');

drop policy if exists "Owners or admins delete community post photos" on storage.objects;
create policy "Owners or admins delete community post photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mj-community-posts' and
         ((storage.foldername(name))[1] = auth.uid()::text or public.mj_is_creator_admin()));

-- 7. Seed the five Engineering subtopics from the design as real, joinable
--    communities — only if a community with that slug doesn't already exist.
--    Member counts are never faked: each one starts at its true count (0)
--    and grows only as real members join.
insert into public.mj_communities (name, slug, description, topic, subtopic, is_private, approval_required, is_verified)
values
  ('Mechanical Engineering', 'mechanical-engineering', 'Design. Analyze. Innovate. Discuss mechanical engineering topics, share projects, ask questions and grow together.', 'Engineering', 'Mechanical', false, false, true),
  ('Electrical Engineering', 'electrical-engineering', 'Circuits, power systems and electronics — share projects, ask questions and grow together.', 'Engineering', 'Electrical', false, false, true),
  ('Automation', 'automation-engineering', 'PLCs, robotics and industrial automation — share projects, ask questions and grow together.', 'Engineering', 'Automation', false, false, true),
  ('Control Systems', 'control-systems-engineering', 'Feedback, instrumentation and control theory — share projects, ask questions and grow together.', 'Engineering', 'Control Systems', false, false, true),
  ('NDT & Testing', 'ndt-testing-engineering', 'Non-destructive testing, quality and inspection — share projects, ask questions and grow together.', 'Engineering', 'NDT & Testing', false, false, true)
on conflict (slug) do nothing;

comment on table public.mj_trending_stories is 'Curated Mjadala trending stories, filterable by topic/subtopic; optional, degrades gracefully if absent.';
comment on table public.mj_learning_resources is 'Links/courses shown under a topic''s Learning Hub (e.g. Engineering).';
