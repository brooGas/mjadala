# Mjadala Draft 2 — coordinated foundation release

This release updates the existing app rather than replacing its backend or deleting previous features.

## Included

- Reworked the main app surface to use Mjadala forest green and warm ivory while preserving the existing light/dark theme toggle.
- Reorganized the bottom navigation labels and added consistent inline SVG icons for Home, Explore, Reels, Communities, and Profile.
- Added topic shortcuts on Home for Engineering, Business, Innovation, Education, and Agriculture.
- Reframed the Groups screen as Communities and added Public, Private, and Hidden visibility choices.
- Added public-community joining and private-community join requests with owner/admin approval.
- Added private group file/image attachments with signed download links and a 20 MB limit.
- Added explicit profile-photo actions for taking a photo or choosing from Gallery/files.
- Added drag-and-drop selection for profile photos, Moments, and Reels video files.
- Added client-side image compression for larger profile photos and Moment uploads to reduce data use.
- Kept the existing account system, rooms, profile editing, Reels controls, and theme behavior in place. Sound/delete implementations were not intentionally edited in this release.

## Required database step

1. Open Supabase Dashboard → SQL Editor.
2. Open `MIGRATION_DRAFT2_COMMUNITIES.sql` from this package and paste the complete file into a new SQL query.
3. Run it once. It is additive and preserves existing rooms, groups, memberships, and messages.
4. It assumes `MIGRATION_PRIVATE_GROUPS.sql` and `MIGRATION_GROUP_ADMIN_TOOLS.sql` have already been applied. If those migrations have not been run, apply them first in that order.

## Important limits

This is a coordinated redesign foundation, not a claim that every screen in the visual concept is now a fully connected production feature. Full one-to-one direct messaging, business mini-sites/product catalog, M-Pesa Daraja STK Push, and a complete post feed with optimistic background upload queue still require their own backend/UI integration stages. Daraja requires merchant credentials and a server-side function; never put Daraja secrets in `index.html`.

## Verification performed

- JavaScript syntax check passed for both inline application scripts.
- ZIP integrity check passed after packaging.
- No live browser/device test or live Supabase migration execution was performed in this environment.
