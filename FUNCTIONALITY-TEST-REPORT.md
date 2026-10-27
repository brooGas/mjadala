# mjadala live-upgrade test report

## Local checks performed
- `node --check` passed for `business-integration.js`, `interaction-layer.js`, `live-social.js`, `live-reels.js`, and `sw.js`.
- Both inline JavaScript blocks in `index.html` passed Node syntax checks.
- TypeScript syntax/type checks passed for both Daraja Edge Function files after stubbing only the Deno runtime and remote Supabase import for local analysis.
- HTML parsing found 5 navigation screens, 5 bottom-navigation buttons, 168 DOM IDs, no duplicate DOM IDs, and no missing local script/image/link assets.
- `manifest.json` and `vercel.json` parsed as valid JSON.
- Source audit confirmed the fixed mock clock and sample social post/person cards were removed; the brand uses the MV monogram beside `mjadala`.

## What is wired in code
- Supabase live feed, paginated posts, comments/replies, likes/saves, trending counts, realtime refresh and live search.
- Community discovery, creation, public joining, private join requests, request review, and community discussions.
- Profile editing, photo crop/zoom/position controls, cropped-image upload and signed-in online heartbeat.
- Existing Shorts schema adapter for live Reel playback, likes, comments, saves, reports, owner-only delete, and 15-second upload validation.
- Multi-product marketplace from published business listings, saved My Business profile and seller-defined delivery fees.
- Daraja STK initiation/callback Edge Function source, payment tracking and realtime order-status UI.

## Not certified in this environment
- Headless Chromium could not complete a browser session in this environment, so a full visual/browser interaction run was not possible.
- No authenticated test session or administrative access to the target Supabase project was available. The new SQL migrations have not been executed against the live database, and live RLS/storage/realtime behavior is not certified.
- Daraja functions have not been deployed and no Safaricom sandbox transaction was run. Payment prompts and callbacks are therefore **not yet live**.

## Must be completed before public launch
1. Run and verify `MIGRATION_LIVE_SOCIAL.sql` in Supabase.
2. Verify the existing business and Shorts tables, RLS policies, storage buckets and profile policies.
3. Apply `MIGRATION_DARAJA.sql` only after checking the existing `business_orders` schema.
4. Deploy both Daraja Edge Functions and configure server-side secrets.
5. Test with at least two real test accounts and a second browser/device; then test Daraja sandbox success, cancellation, timeout, duplicate callback, wrong amount and phone mismatch.
6. Do not accept real customer payments until those tests pass and production credentials are approved.
