# Mjadala live social upgrade

This release adds the frontend wiring and SQL foundation for real posts, comments/replies, likes, saves, community discovery/join requests/discussions, profile photo cropping, and an actual online heartbeat. It uses the existing public Supabase URL and publishable key; no service-role secret is included.

## Required before live use
1. Back up your Supabase project.
2. Run `MIGRATION_LIVE_SOCIAL.sql` in Supabase SQL Editor.
3. Deploy the full `mjadala-main/` folder as the app root (do not deploy the standalone preview HTML).
4. Sign in with a real test account. Create a post, add a comment/reply, like/save, join a community, and crop/save a profile photo. Test a second account on another device/browser for cross-account visibility.
5. Verify the existing `profiles` table includes `id`, `avatar_url`, and (if used) `bio`; `MIGRATION_PROFILE_FIELDS.sql` adds the latter fields if needed. If your profile table uses different identity/name columns, adjust the profile query before production.

## Honest limits
- The app cannot be verified against your Supabase project from this workspace because no authenticated test session/project admin access is available. The ZIP has local syntax/integrity checks, not a claim of successful live deployment.
- Business orders are created by the existing server-side RPC. The current M-Pesa button is **not** a live STK Push integration; do not take live payments until a Daraja Edge Function with server-side credentials and a verified callback is deployed and tested.
- Reels remain dependent on the existing Shorts schema/storage/functions; this upgrade does not pretend local video previews are published Reels.
- Account deletion/admin moderation require secure server-side workflows and are not simulated.

## Daraja STK Push (separate setup)
1. Apply `MIGRATION_DARAJA.sql` only after backing up and confirming `business_orders` has `id`, `buyer_id`, `total_amount`, and `payment_status` as expected.
2. Deploy the two Edge Functions from `supabase/functions/` with Supabase CLI or Dashboard.
3. Configure server-side secrets: `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET`, `DARAJA_SHORTCODE`, `DARAJA_PASSKEY`, `DARAJA_CALLBACK_SECRET`, `DARAJA_ENV=sandbox`, and `DARAJA_TRANSACTION_TYPE=CustomerPayBillOnline` (use the correct type for your shortcode), plus the existing Supabase server secrets. Never place the consumer secret/passkey/service-role key in the HTML or JS.
4. Set `DARAJA_ENV=production` only after Safaricom approves live credentials and you have completed sandbox tests.
5. Test success, cancellation, wrong PIN, timeout, duplicate callbacks, wrong amount, and callback arriving twice. Confirm `business_orders.payment_status` only becomes `paid` after the callback receipt and amount are verified. The UI must never ask for or receive the M-Pesa PIN.
6. Sandbox behavior depends on the Safaricom developer app and test configuration; do not assume a real handset prompt until verified in your account.
