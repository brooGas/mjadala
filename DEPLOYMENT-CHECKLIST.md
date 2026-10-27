# mjadala deployment and test checklist

## Before upload
- Keep the approved forest-green / ivory layout and the MV monogram next to `mjadala`.
- Upload the whole `mjadala-main` app root. Do not upload the preview HTML by itself.
- Do not commit any service-role key, Daraja secret, passkey, or callback secret.
- Confirm the existing Supabase project is the intended project and make a database backup.

## Supabase SQL (run in this order)
1. Verify the existing business tables and current policies; keep the migrations that are already installed.
2. Run `MIGRATION_LIVE_SOCIAL.sql` once. It is additive and uses `mj_`-prefixed social tables.
3. If the business image storage / secure order RPC migration is not already installed, review `MIGRATION_BUSINESS_SHOPPING_FUNCTIONAL.sql` against the actual `business_products` and `business_orders` schema before running it. Do not blindly rerun an older, differently shaped migration.
4. Review `MIGRATION_DARAJA.sql` against the current `business_orders` columns, then run it for payment tracking.

## Manual functional tests
- Sign in with a test account; sign out and back in; confirm session survives refresh.
- Create a post from one account and open it in a second browser/account.
- Like, unlike, save, unsave, open the full conversation, add comments and replies, and verify counts from the second account.
- Join a public community, open discussions, publish a discussion, and confirm membership persists. Create a private community with account A; send a join request from account B; approve/reject as A; confirm B's membership state.
- Upload a profile photo from camera/gallery, adjust zoom and position, save, refresh, and verify the cropped photo persists.
- Publish a 15-second-or-shorter Reel, view it in another account, test sound, comments, likes, save, report, and owner-only deletion. Test oversized and over-duration video rejection.
- Publish multiple business products and verify the marketplace lists them; check product details, seller-set delivery fees, checkout totals, and order visibility.
- Daraja sandbox: test success, cancellation, wrong PIN, timeout, duplicate callback, wrong amount, and callback phone mismatch. Confirm the order is only `paid` after a verified success callback.

## Honest release boundaries
- Syntax and archive checks are local checks, not a live backend/device certification.
- Posts, comments, community actions and profile photos depend on the live social SQL migration and existing `profiles` policies.
- Reels depend on the existing `shorts`, `short_categories`, `shorts_likes`, `shorts_comments`, `saved_shorts` tables and the `mjadala-shorts` bucket policies.
- Business publishing/order creation depend on existing business schema and RLS.
- Daraja will not initiate payment until the Edge Functions are deployed and server-side secrets are configured. A payment request is not proof of payment; the callback must confirm it.
