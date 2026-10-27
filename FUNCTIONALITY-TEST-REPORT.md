# Mjadala v8 — functionality and code review

## Changes made while preserving the current approved preview design
- Kept the current five-screen layout, forest-green/ivory styling, bottom navigation, and existing business workspace.
- Added Android-friendly SVG controls for Reel sound, more options, like, comment, share, save, report, and delete.
- Added local Reel video selection and preview; sound toggle controls the selected local video, and deleting removes only that local preview.
- Added optimistic local likes/saves/follows/community membership and browser persistence for those UI states.
- Added a working in-app search overlay over currently loaded content.
- Made account panel rows accessible buttons; sign-out calls the Supabase auth client when available.
- Corrected business publishing so the standard and express delivery prices saved to Supabase come from the visible seller inputs, rather than separate duplicate inputs.
- Kept the business checkout on the server-side RPC so browser totals are not trusted. Updated SQL validation for delivery method/address.

## Checks run
- JavaScript syntax checks passed for `business-integration.js` and `interaction-layer.js`.
- JavaScript syntax checks passed for both inline scripts in `index.html`.
- HTML structure checks confirmed five screen sections and five navigation buttons; no duplicate IDs remain in the runtime navigation markup (the initial header buttons are replaced by the header renderer at startup).
- ZIP integrity is checked when packaging.

## Important boundaries — not falsely marked as tested
- This environment could not complete a real Chromium browser session, and no authenticated Supabase session was available for end-to-end server testing.
- Reel preview, likes/saves/follows/community membership, comments drafted from the sample Reel, and sample post actions are local optimistic UI actions. They do not claim to have been saved to the server.
- Product publishing, image upload, and order creation require the Supabase project to have the expected table columns, RLS policies, storage bucket, and the included SQL migration applied. M-Pesa/STK payment is **not** integrated; checkout creates a pending order only.
- Account deletion and admin deletion of sample users/content are deliberately not simulated from the browser. Those require a secure server-side admin workflow and explicit admin authorization.
- The currently displayed Home/Explore/Reels/Communities entries remain sample content until connected to live feed and community queries. The backup legacy app is retained as `index-legacy-backup.html`; it is not used as the active design.

## Deployment
1. Keep the existing Supabase URL and publishable key in the app; never put a service-role key in browser code.
2. Apply `MIGRATION_BUSINESS_SHOPPING_FUNCTIONAL.sql` in Supabase SQL Editor after verifying the five business tables and their columns match this migration.
3. Deploy the contents of `mjadala-main/` as the app root.
4. After deployment, test sign-in, product publication with an image, delivery choices, order creation, pool joining, and sign-out using a real test account before taking orders.
