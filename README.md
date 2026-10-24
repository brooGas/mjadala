# Mjadala (web version)

Copyright (c) 2026 Mark Sixstars. All rights reserved.

Static website + Supabase. No server to run, no terminal needed.

## Put it online (from a phone)

1. Extract the zip (Files app -> tap the zip -> Extract).
2. GitHub: create a free account, tap "+" -> New repository -> name it `mjadala`
   -> Create. Then tap "uploading an existing file", select ALL the extracted files
   (index.html, manifest.json, sw.js, vercel.json, icon-192.png, icon-512.png,
   LICENSE, README.md) and tap Commit changes.
3. Vercel: create a free account (sign in with GitHub) -> Add New -> Project ->
   import `mjadala` -> Framework preset: Other -> Deploy.
4. Vercel gives you an https link. Open it in Chrome, sign up, chat.
   Chrome menu -> "Install app" puts it on your home screen.

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
