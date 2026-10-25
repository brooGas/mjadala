MJADALA DESIGN REFRESH — PLEASE READ

This update redesigns the existing app's home screen toward the supplied Mjadala reference:
- Indigo, sunset-orange, cream/light, and deep-charcoal/dark theme palette
- Home composer actions for Add Moment and New Group
- Circular Moment shortcuts and circular profile-photo framing
- Conversations list styling and fixed bottom navigation
- Existing Supabase-backed login, rooms, Moments, groups, profile editing, people directory, and theme toggle are retained

INSTALL THE UPDATE
1. Back up your current project folder first.
2. Extract this ZIP.
3. Upload/replace the project files in your existing GitHub repository, keeping the folder contents at the repository root (not inside an extra mjadala-main folder).
4. Let Vercel redeploy, then reopen the app. If the old layout remains, refresh the page or clear the installed PWA's cached site data.

DATABASE / SQL
The visual redesign itself needs NO new SQL. Do not run random schema changes just to change colors/layout.
Your ZIP still includes the existing SQL migrations for profile fields, profile-photo framing, Moments, and private groups. Run only migrations you have not already applied, using the order and prerequisites described in DEPLOY_MOMENTS_FIRST.txt and the migration comments. Never paste a Supabase service_role/secret key into the app.

NOTE
The home Moment circles are shortcuts, not fake user posts; they open the actual Moments, People, or Groups screens. Actual Moments and room contents continue to come from your Supabase database.
