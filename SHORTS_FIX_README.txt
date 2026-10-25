MJADALA SHORTS SCHEMA FIX

This build matches the existing public.shorts schema reported by the user: id UUID, user_id UUID, category_id bigint, title text, video_path text, duration_seconds numeric, status text, created_at timestamptz.

- Loads video_path and requests a signed URL from the private mjadala-shorts bucket for playback.
- Deletes the video object using video_path, then deletes only the current user's own database row.
- Includes Like, Comment, and Share controls backed by shorts_likes / shorts_comments and Web Share / copy fallback.
- Upload looks up category names in public.categories and writes video_path, category_id, and status=published. If your category table has a different name or column, publishing will show a clear error; existing playback is independent.

Replace repository index.html with this file and deploy. The engagement SQL migration should already have been run. Existing storage objects must be in the mjadala-shorts bucket and video_path must store each object path, not a full URL.
