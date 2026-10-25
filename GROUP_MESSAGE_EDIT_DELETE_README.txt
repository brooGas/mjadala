MJADALA GROUP MESSAGE EDIT / DELETE FIX

Fixes included:
- Member roster avoids ambiguous PostgREST joins by fetching group_members and profiles separately.
- Members see Edit and Delete actions on their own group messages.
- Group creators and group admins can delete messages in their group.
- Database RLS controls these permissions; UI buttons alone are not the security boundary.

Apply SQL:
1. Back up Supabase first.
2. Ensure MIGRATION_PRIVATE_GROUPS.sql and MIGRATION_GROUP_ADMIN_TOOLS.sql have already been applied.
3. Paste and run MIGRATION_GROUP_MESSAGE_EDIT_DELETE.sql in Supabase SQL Editor.
4. Deploy the updated index.html and SQL/readme files to the existing GitHub repository.
5. Test using a regular member account and a creator/admin account.

Note: editing is limited to the original author. Creator/admin message moderation includes deletion, not editing someone else's message.
