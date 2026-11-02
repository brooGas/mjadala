MJADALA REELS NOTIFICATION ICON FIX

Replace only live-reels.js in your deployed project with the file in this package.
No SQL changes are required. No changes to index.html, auth files, or live-social.js are required.

Fix: Adds the missing bell SVG to the Reels icon renderer. The button and its existing click handler were already present; the icon renderer did not define the 'bell' icon, so it rendered an empty/black button.

After replacing the file, redeploy the app and refresh the PWA. If the old appearance remains, fully close and reopen the app or refresh the site once to load the new JavaScript.
