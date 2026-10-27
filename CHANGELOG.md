# Mjadala changelog

## 0.2.0 — visual refresh and Moments groundwork

- Redesigned the sign-in, discussion list, chat, admin panel, and Moments surfaces with responsive spacing, modern cards, improved contrast, and a more consistent Mjadala green identity.
- Added a manual light/dark theme switch. The choice is remembered on the same browser/device. First visit follows the device colour preference.
- Retained the existing Supabase authentication, invite flow, discussions, chat, reporting, moderation, and installable web-app setup.
- Included a draft Supabase migration for private photo storage, active Moments metadata, 24-hour expiry, a five-active-Moment limit, duplicate checks, and staff-only public-room creation.
- Bumped the service-worker cache version so the deployed site can pick up the refreshed app shell.

## Not yet complete

- The SQL migration has not been tested against the live Supabase project. Apply only after reviewing it and making a database backup.
- Expired Moment image files need a trusted scheduled cleanup worker; expiry hides Moments immediately, but physical file cleanup is a separate deployment task.
- Groups and @mentions are planned next and are not implemented by this package.
- The photo hash is computed by the browser; the reservation flow blocks ordinary duplicate uploads, but a determined client can forge a supplied hash. Stronger server-side content verification should be added before broad public launch.


## Step 2 — People and public profiles
- Added searchable People directory and public profile view.
- Added circular profile photo preview with persistent horizontal/vertical framing.
- Added additive profile-framing migration SQL; existing RLS policies are unchanged.


## Group admin tools
- Added creator-only group deletion and group-admin assignment controls.
- Group admins can invite members and remove regular members; only creators can appoint admins or delete groups.
- Added additive Supabase migration: `MIGRATION_GROUP_ADMIN_TOOLS.sql`.

## Live upgrade — October 2026
- Reframed the app as a customer-facing, mobile-first app rather than a design-review mockup.
- Applied the MV monogram immediately to the left of `mjadala`; replaced the fixed status-bar clock with a Supabase-backed signed-in/online indicator.
- Added a Supabase live social foundation: paginated public posts, comment/reply threads, optimistic likes and saves with rollback, real trending counts, realtime refresh, community discovery, membership, private-community join requests, community discussions, profile editing, and adjustable profile-photo crop/upload.
- Connected Reels to the existing `shorts` schema for playback, likes, comments, saves, reporting, owner-only deletion, and upload with a 15-second duration check. This depends on the existing Shorts schema/storage policies.
- Added a multi-product marketplace catalogue backed by published Supabase listings and a saved My Business profile with owner display.
- Added Daraja STK Push and callback Edge Function source plus payment-tracking migration. It stays inactive until functions are deployed, secrets configured, and sandbox callback tests pass.
- Added release and test instructions. Local syntax checks do not constitute a live Supabase or Safaricom certification.
