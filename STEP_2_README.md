# Mjadala Step 2 — People and public profiles

## Included
- People tab with nickname/bio search and clickable public profile cards.
- Public profile view with circular avatar, nickname and bio.
- Horizontal/vertical photo framing controls and a circular preview.
- Saved framing percentages on `public.profiles`, applied consistently in directory cards and public profiles.
- Existing auth, rooms/chats, Moments, private Groups, admin/moderation and service functions retained from the supplied Step 1 ZIP.
- Indigo/orange theme variables retained and reinforced.

## Before deploying: Supabase migration
1. Open the Supabase project connected to Mjadala.
2. Open SQL Editor and create a new query.
3. Paste and run `MIGRATION_STEP_2_PUBLIC_PROFILES.sql`.
4. Confirm the verification query returns both `avatar_position_x` and `avatar_position_y`.
5. If SQL reports an error, stop and resolve it before deploying; do not assume the migration succeeded.

This migration only adds two constrained columns. It does not modify RLS policies or grant new table/storage permissions. The People directory relies on the existing `profiles` SELECT policy permitting authenticated users to read the public profile fields. If it doesn't, review your current policy deliberately; do not disable RLS or add a broad unrestricted policy.

## Upload to GitHub from Android
1. Download and extract this ZIP.
2. Open `mjadala-main/index.html` in the extracted folder.
3. In GitHub, open `brooGas/mjadala` and replace the repository-root `index.html` with this file (upload file / commit changes).
4. Upload `MIGRATION_STEP_2_PUBLIC_PROFILES.sql` to the repository root as a documentation/migration file too (optional, but recommended). Do not upload the entire nested `mjadala-main` folder into the repository.
5. Vercel should deploy from the commit. Wait for its deployment to finish, then hard-refresh `https://mjadala.vercel.app`.

## Test checklist
- Log in and open People.
- Search for a known nickname and a distinctive word from a profile bio.
- Open a result and confirm nickname, bio and circular image display.
- In Profile, choose a photo, adjust both sliders, save, then reload the page and verify the framing is retained.
- Log in as another account and check the same profile framing.
- Re-test login, existing chat send/read, Moments, private Groups, theme switching and moderator/admin functions.
- If People returns a permission error, stop and inspect the existing profiles RLS policy; do not disable RLS.

## Verification status
The ZIP was inspected and edited locally. The code has not been deployed to Supabase/Vercel or tested against your live project from this package. Run the checklist above after deployment.
