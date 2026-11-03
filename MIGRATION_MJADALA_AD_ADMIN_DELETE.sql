-- Mjadala advertising admin deletion permission (incremental; safe to rerun).
-- The admin UI deletes the campaign row, then removes its media from mjadala-ads.

drop policy if exists "Admins can delete Mjadala ads" on public.mj_ad_campaigns;
create policy "Admins can delete Mjadala ads"
  on public.mj_ad_campaigns
  for delete to authenticated
  using (public.mj_is_creator_admin());

drop policy if exists "Admins can delete Mjadala ad media" on storage.objects;
create policy "Admins can delete Mjadala ad media"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'mjadala-ads'
    and public.mj_is_creator_admin()
  );
