MJADALA COMMUNITY MANAGEMENT UPDATE

Files in this package:
1. live-social.js — replaces the existing live-social.js in your project.
2. MIGRATION_COMMUNITY_MANAGEMENT.sql — adds secure database functions.

UPLOAD/RUN ORDER:
1. In Supabase Dashboard > SQL Editor, run MIGRATION_COMMUNITY_MANAGEMENT.sql in full.
2. In your GitHub project, replace the existing live-social.js with the one in this ZIP. Do not replace index.html for this update.
3. Commit/push and wait for Vercel deployment. Refresh the app; if installed as a PWA, close and reopen it after deployment.

FEATURES:
- Members can leave a group.
- Creators can delete their group.
- Creators can assign and remove Admin roles (stored as role='moderator' in the existing schema).
- Creators can remove ordinary members.
- Admins can remove ordinary members only; they cannot remove creators or other admins.
- Group creation and creator membership now happen atomically through one RPC, avoiding the prior two-step insert failure.

The SQL does not disable RLS. Permission checks are enforced inside SECURITY DEFINER functions. Existing groups and membership rows are preserved. Deleting a group intentionally cascades to its discussions, memberships and join requests because those records belong to that group.

This patch targets the mj_communities / mj_community_members system used by live-social.js, not the separate legacy groups tables. JavaScript syntax and ZIP contents were checked locally; live Supabase/Vercel execution has not been tested from this environment.
