MJADALA SHORTS — VISUAL + SCHEMA REPAIR

This package updates the Shorts section in index.html while preserving the rest of the Mjadala project.

Database schema compatibility:
- Reads categories from public.short_categories (id, name, slug).
- Publishes shorts using shorts.category_id and the selected short_categories.id.
- Uses shorts.video_path for playback and deletion.
- Uses shorts_likes and shorts_comments for reactions and comments.

Shorts experience:
- Separate, responsive vertical-video feed with compact action buttons on the right.
- Like button turns pink when liked and animates a floating heart; existing likes by the signed-in user are shown on load.
- Comments open in a compact, attractive panel instead of a browser prompt.
- Share uses the device share sheet when available, with copy/prompt fallbacks.
- Creator delete uses a clear red danger style and remains available only on the creator's own Shorts.
- Category filters and upload options are populated from short_categories.

No new SQL migration is required for the category-name fix if the existing Shorts tables and engagement policies are already installed. Playback still depends on the private `mjadala-shorts` storage bucket and each row's video_path pointing to an object inside that bucket.

Deploy by replacing the project files in your repository with the contents of this ZIP, then commit and redeploy. The JavaScript syntax and ZIP structure were checked locally; live Supabase playback and permissions cannot be verified from this package build alone.
