MJADALA GROUP ADMIN TOOLS

1. Back up your current Supabase project first.
2. Supabase Dashboard -> SQL Editor -> New query.
3. Paste and run MIGRATION_GROUP_ADMIN_TOOLS.sql once.
4. Upload the updated index.html and new SQL/readme files to the same GitHub repository. Keep your existing Supabase URL/key and other files. Vercel will redeploy automatically.
5. Test with a second account: creator invites member, promotes member to group admin, admin invites/removes a regular member, and creator deletes a test group.

Permissions:
- Group creator: invite/remove members, appoint/demote group admins, delete the group.
- Group admin: invite members and remove regular members; cannot appoint admins, remove other admins, or delete the group.
- Regular member: chat only.

The SQL migration is separate from deployment; uploading SQL to GitHub does not run it. Never put a Supabase service-role key in index.html.

Safety fix: this migration also updates create_private_group so newly created groups store the creator role correctly, and protects the creator from removal even if an old membership row has an incorrect role.
