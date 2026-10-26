-- Mjadala Shorts: optional external link attached to a Short.
-- Run once in Supabase SQL Editor before deploying the updated app.
ALTER TABLE public.shorts
ADD COLUMN IF NOT EXISTS external_url text;

-- Only allow normal web links; null is valid when no link is attached.
ALTER TABLE public.shorts
DROP CONSTRAINT IF EXISTS shorts_external_url_http_check;
ALTER TABLE public.shorts
ADD CONSTRAINT shorts_external_url_http_check
CHECK (external_url IS NULL OR external_url ~* '^https?://');
