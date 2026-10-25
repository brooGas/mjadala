Mjadala Profile + Reels Upgrade

IMPORTANT: Back up your current deployment before replacing files.

1. In Supabase SQL Editor, review and run MIGRATION_PROFILE_FEATURES.sql.
   It creates/extends notification preferences, saved Shorts, privacy preference
   storage, and adds signed-in read policies for published Shorts and the Shorts
   storage bucket. Check existing RLS policies first if your project has custom rules.
2. Upload the contents of this ZIP's mjadala-main folder to the same hosting root
   as the existing app, replacing the old static files.
3. If installed as a PWA, close the installed app completely and reopen it after
   deployment. If the old icon remains, remove the installed shortcut and install
   again so the phone refreshes its cached icon.
4. My Posts currently lists this project's database-backed Shorts/Reels. This
   codebase does not expose a general social-post table, so it does not pretend
   ordinary text/photo posts are connected. Saved currently saves Reels.
5. Privacy controls save preferences; enforcement of profile visibility and DM
   restrictions must also be added to the people-search and DM-delivery queries
   before treating those choices as security controls.
6. Video uploads require the app to remain open until upload completes. For clips
   over 15 seconds, users get trimming controls where the browser supports them;
   otherwise the app explains how to trim with the phone's video editor.

Checked in this package: ZIP integrity, JavaScript syntax, manifest JSON, and icon sizes.
Not verified here: live Supabase credentials/policies, real-device playback, upload speed,
or live notification delivery.
