# Mjadala reference-design rebuild

This package implements a 2-second MV splash after a valid authenticated session is found, the taupe/cream palette, the profile/menu screen labels, creator identity and Follow + three-dot controls on Shorts, and a dedicated Shorts creator-follow interaction.

## Database
The existing `shorts`, `short_categories`, `shorts_likes`, and `shorts_comments` tables are preserved. To enable the new Follow buttons, run `MIGRATION_SHORTS_CREATOR_FOLLOWS.sql` once in Supabase SQL Editor. It creates `public.shorts_creator_follows` with RLS policies.

## Creator copyright privacy
The copyright label is only rendered in the profile menu when the current profile has a staff role and nickname matching “Mark Sixstars”. For stronger security, make sure the actual creator account has the admin role assigned by trusted database administration. UI hiding is not a secret against source inspection.

## Verification limits
HTML and inline JavaScript should be syntax-checked before deployment. Database actions require testing against the live Supabase project and its RLS/storage configuration.
