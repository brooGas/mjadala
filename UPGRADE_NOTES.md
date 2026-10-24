# Safe update notes for Mjadala

This is a static website deployed through GitHub/Vercel. Frontend updates deploy when the changed files are committed; SQL files do **not** execute automatically.

## Files changed in this release

- `index.html` — refreshed interface, theme switch, and Moments frontend.
- `manifest.json` — updated app description and colours.
- `sw.js` — cache version incremented to `mjadala-web-v3`.
- `MIGRATION_MOMENTS.sql` — database/storage migration draft; manual Supabase step only.
- `CHANGELOG.md` — current scope and known gaps.

Keep `terms.html`, icons, `vercel.json`, and `README.md` unless intentionally changing them. Do not delete the repository or replace Supabase keys. The public publishable key belongs in the frontend; never add a service-role/secret key.

## Recommended future release pattern

1. Make each feature in a separate release with a short changelog.
2. Keep database changes in new, numbered SQL migration files; do not edit already-applied migrations.
3. Back up the database before schema/policy changes.
4. Deploy the frontend, run a short login/chat test, then test the new feature.
5. Add Groups and @mentions in the next feature release, then add a trusted scheduled worker for expired image cleanup.

**Do not run `MIGRATION_MOMENTS.sql` until the current policies and Storage setup have been reviewed.** It adds tables/policies and changes who may create public rooms; it does not replace the existing app database.


## Package refresh (2026-10-25)
- Updated the light/dark theme palette to ivory, charcoal, and sunset amber.
- Kept the existing Moments upload and duplicate/limit logic, theme toggle, and clickable mention code from this package.
- Included the existing private-groups SQL migration in the package; it must be reviewed/applied in Supabase before a group UI can work.
- This package does not yet contain a complete private-groups interface or editable profile screen. Do not treat those features as complete until separately implemented and tested.
- Replace the deployed site files only after retaining a backup of the current version.
