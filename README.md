# mjadala — live social app

Mobile-first web app with Supabase-backed social features, community spaces, Reels and business listings. SQL migrations and Edge Functions must be deployed separately before those features are live.

## Put it online (from a phone)

1. Extract the zip (Files app -> tap the zip -> Extract).
2. GitHub: create a free account, tap "+" -> New repository -> name it `mjadala`
   -> Create. Then tap "uploading an existing file", select ALL the extracted files
   (index.html, manifest.json, sw.js, vercel.json, icon-192.png, icon-512.png,
   LICENSE, README.md) and tap Commit changes.
3. Vercel: create a free account (sign in with GitHub) -> Add New -> Project ->
   import `mjadala` -> Framework preset: Other -> Deploy.
4. Vercel gives you an https link. Open it in Chrome, sign up, chat.
   Chrome menu -> "Install app" puts it on your home screen. Keep the app root and its `live-social.js`, `live-reels.js`, `business-integration.js`, and `interaction-layer.js` files together.

## Updating

Edit a file on GitHub (open it, tap the pencil, change, Commit). Vercel republishes
automatically in about a minute. Users get the new version when they reopen the app.

## Make yourself admin (once, after you sign up in the app)

Supabase -> SQL Editor -> run (use your own nickname):

    update public.profiles set role = 'admin' where nickname = 'YOURNICK';

## Safety notes

- index.html contains only the PUBLIC Supabase URL and publishable key. That is
  normal. NEVER put a service_role / secret key in any file.
- The database rules (supabase/schema.sql) are what protect the data.


## Releases and upgrades

See `CHANGELOG.md` for the current release and `UPGRADE_NOTES.md` before uploading updates. SQL migrations are manual Supabase steps and never run merely because a file is uploaded to GitHub.


## Live social and payment setup

Read `LIVE-SOCIAL-README.md` and `DEPLOYMENT-CHECKLIST.md` first. Run `MIGRATION_LIVE_SOCIAL.sql` in Supabase before expecting posts, comments, replies, likes, saves, community membership/requests, or profile cropping to sync. These features require a real signed-in test account and correct existing `profiles` permissions.

For Daraja STK Push, review `MIGRATION_DARAJA.sql`, deploy `supabase/functions/daraja-stk-push` and `supabase/functions/daraja-callback`, and set the documented secrets server-side. Until that is done and callback tests pass, checkout must not be described as a completed payment. Never collect the M-Pesa PIN inside Mjadala.

The code can be syntax-checked locally, but the actual Supabase schema, RLS, storage buckets, Edge Functions and Safaricom credentials must be verified in the target project.
