# Mjadala Design Upgrade — Step 1

This package is the first visual pass toward the approved Mjadala reference: indigo `#4F46E5`, sunset orange `#F59E0B`, ivory light surfaces, and charcoal/navy dark surfaces.

## Upload
1. Extract this ZIP.
2. In your GitHub repository, replace `index.html` with `mjadala-main/index.html` and commit.
3. Replace `terms.html` with `mjadala-main/terms.html` and commit if you want the Terms page palette refreshed.
4. Leave all other files unchanged.
5. Let Vercel deploy, then refresh the site.

## Safety and scope
- Existing HTML markup and JavaScript in `index.html` were retained; this pass adjusts CSS/theme styling only.
- Existing SQL migrations, Supabase functions, service worker, manifest and icons are included unchanged.
- This pass does not add the People directory or other new functionality; we will implement those in a later step after the visual foundation is checked.
- Test login, chat, Moments, groups, profile editing, and theme switching after deployment.
