MJADALA SHORTS FIX

This update changes Shorts to match the database schema in MIGRATION_SHORTS.sql:
- shorts.storage_path, shorts.category, shorts.is_hidden, shorts.mime_type
- temporary signed URLs from the private mjadala-shorts bucket for playback
- upload metadata matching that schema
- Delete button shown only on the current user's own Shorts
- Like, Comment and Share controls

IMPORTANT:
1. Replace the repository's index.html with this ZIP's mjadala-main/index.html and deploy it.
2. Run MIGRATION_SHORTS_ENGAGEMENT.sql once in Supabase SQL Editor to enable Like and Comment storage.
3. Keep the mjadala-shorts bucket private. Signed playback URLs require an authenticated session and a storage SELECT policy for the bucket (the base MIGRATION_SHORTS.sql creates this policy).
4. Test with a newly uploaded MP4 first. Existing Shorts created using the incompatible video_path/category_id/status schema may need migration; do not delete existing database tables.

Like/Comment buttons are wired to Supabase tables. Share uses the phone share sheet when available, or copies/prompts for a link. This initial share link points to the app with a Short identifier; deep-link navigation to a specific Short may be added separately.
