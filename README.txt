MJADALA — Notifications & Community Panel Visibility Fix

Built from the user's 07:27 Nairobi Mjadala-Trim-Preview-Loading-Optimization baseline.

Files included:
- index.html: retains the 07:27 baseline and adds a modal viewport layer so notification/community dialogs appear above the bottom navigation and remain scrollable.
- live-reels.js: retains the 07:27 Reels logic (including metadata preload and 15-second limit); adds only the Reels notification bell immediately before Sound and opens the page-aware notification panel.
- live-social.js: retains the community management features (creator assigns/removes admins, creator deletes community, admins remove ordinary members, members leave); fixes modal placement and routes Reels notifications to the same page-aware panel.
- MIGRATION_COMMUNITY_MANAGEMENT.sql: same migration from the community roles update; run only if you have not already run it.

Upload/replace these three application files together: index.html, live-reels.js, live-social.js.
Do not replace auth.html/auth.js or any other files.
If MIGRATION_COMMUNITY_MANAGEMENT.sql was already run successfully, do not run it again; otherwise run it in Supabase SQL Editor.

The modal fix moves community/notification dialogs to the document-level overlay and gives them viewport-height scrolling with safe-area padding, so the fixed Home/Explore/Reels/Communities/Profile bar no longer covers their contents.

Validation performed: JavaScript syntax checks passed for live-social.js and live-reels.js; ZIP contents reviewed. No live Supabase/Vercel/device test was performed.
