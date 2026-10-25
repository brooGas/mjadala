-- MJADALA: allow members to edit their own group messages,
-- and allow creators/group admins to moderate messages in their group.
-- Run AFTER MIGRATION_PRIVATE_GROUPS.sql and MIGRATION_GROUP_ADMIN_TOOLS.sql.
-- Run once in Supabase SQL Editor after backing up the project.

begin;

alter table public.group_messages enable row level security;

-- Members may edit only messages they authored, while they remain group members.
drop policy if exists group_messages_update_own on public.group_messages;
create policy group_messages_update_own
on public.group_messages
for update
to authenticated
using (
  author_id = (select auth.uid())
  and public.is_group_member(group_id, (select auth.uid()))
)
with check (
  author_id = (select auth.uid())
  and public.is_group_member(group_id, (select auth.uid()))
  and char_length(btrim(body)) between 1 and 500
);

-- The existing policy already permits authors/staff to delete. This additional
-- policy lets the creator or a group admin delete messages in that group.
drop policy if exists group_messages_delete_creator_admin
on public.group_messages;
create policy group_messages_delete_creator_admin
on public.group_messages
for delete
to authenticated
using (
  exists (
    select 1
    from public.groups g
    where g.id = group_messages.group_id
      and g.created_by = (select auth.uid())
  )
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = group_messages.group_id
      and gm.user_id = (select auth.uid())
      and gm.group_role = 'admin'
  )
);

commit;
