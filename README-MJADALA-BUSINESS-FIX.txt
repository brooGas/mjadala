MJADALA BUSINESS DIRECTORY + ADMIN FIX

Files in this update:
- index.html: only changes are cache-busting versions on business-integration.js and business-directory.js.
- business-directory.js: refreshed creator dashboard with compact metric cards and clean tables for applications, existing businesses and plans. Plan assignment sends p_user, p_plan, p_days and p_admin_note.
- business-integration.js: All products returns to the full marketplace list and closes product detail instead of immediately opening the first item. Publishing checks creator approval and an active plan before uploading/inserting a product.
- MIGRATION_BUSINESS_APPROVAL_GATE_PATCH.sql: database enforcement so a seller cannot self-approve and cannot publish/republish unless approved with an active plan.

UPLOAD
1. Replace the existing root index.html, business-directory.js and business-integration.js with the three files in this ZIP. Keep all other app files unchanged.
2. Commit/push to GitHub and wait for Vercel deployment.
3. Run MIGRATION_BUSINESS_APPROVAL_GATE_PATCH.sql once in Supabase SQL Editor.
4. Open the deployed site in a fresh browser tab / hard refresh. The script URLs are versioned to avoid the previous cached JavaScript.

IMPORTANT
- This patch assumes the business directory migration has already been run and the mj_business_* tables/functions exist.
- It does not replace the original business shopping migration or modify checkout / Daraja payment functions.
- The database trigger is the final enforcement layer. Frontend checks only provide a clear message sooner.
