MJADALA UPGRADE — READ FIRST

This bundle adds the mobile Groups and Profile interfaces to the existing Mjadala app and preserves the existing login, discussion rooms, messages, Moments, theme toggle, and moderation code.

DEPLOY ORDER
1. Keep a copy of your current working repository. Do not delete the live app or database.
2. Replace the repository's app files with the files in this bundle (merge the files; do not remove existing unrelated files).
3. In Supabase SQL Editor, run MIGRATION_PROFILE_FIELDS.sql once to add profile bio/photo fields and the profile-photos bucket.
4. If you have NOT already run MIGRATION_PRIVATE_GROUPS.sql, run it once. If you already ran it, do not needlessly rerun it.
5. Do NOT rerun MIGRATION_MOMENTS.sql if Moments is already working. Keep your existing edge functions/secrets and deployed cleanup schedule.
6. Deploy the repository to Vercel and test with two separate accounts.

IMPORTANT FEATURE NOTES
- Private Groups UI uses the SQL RPCs in MIGRATION_PRIVATE_GROUPS.sql. Groups are only visible to members under the supplied RLS policies; the creator can invite an existing member by exact nickname.
- Profile text saves to profiles.nickname and profiles.bio. Profile photo upload requires the profile-photos bucket/policies from MIGRATION_PROFILE_FIELDS.sql.
- This is a prepared code upgrade, not a claim that production has already been deployed or that every behavior has been verified against your live Supabase project. Test group membership isolation with two accounts before announcing it publicly.
- Existing account and message data are not dropped by these migrations.
