MJADALA BUSINESS DIRECTORY + CREATOR ADMIN UPDATE

FILES IN THIS UPDATE
- index.html: latest saved app shell with the directory script included.
- business-integration.js: existing marketplace integration plus seller-filter support. Existing checkout, order and pool functions are retained.
- business-directory.js: searchable directory, individual storefront filter, business application form and creator admin dashboard.
- MIGRATION_BUSINESS_DIRECTORY_ADMIN.sql: database tables, RLS, plan management, creator-only RPCs and publish-access enforcement.
- live-social.js: latest saved social file, unchanged.
- live-reels.js: latest Reels file with the missing bell SVG included.

DEPLOY STEPS
1. Back up the current GitHub repository.
2. Upload/replace the five app files: index.html, business-integration.js, business-directory.js, live-social.js and live-reels.js. Do not remove other existing project files.
3. In Supabase SQL Editor, run the existing business migrations first if they have not already been run. Then run MIGRATION_BUSINESS_DIRECTORY_ADMIN.sql.
4. In Supabase Dashboard > Authentication > Users, find the creator account (your own account) and copy its User UID.
5. Run this one-time SQL, replacing the placeholder with that exact creator UID:
   update public.mj_business_control set creator_user_id='YOUR-OWN-USER-UUID' where singleton=true;
   Do not use another user's UID. This is the only account that receives creator-admin controls.
6. Deploy the site and sign in with the creator account. The Creator · Business control panel appears in Explore > Business.

HOW IT WORKS
- New businesses submit a simple application using a trading name; formal company documents are not required.
- The creator can open/close applications, approve/reject applications, assign plans/trials, and edit plan pricing/duration.
- Only approved businesses with an active/trial subscription can newly publish products. This is checked by a database trigger, not just the UI.
- Customers can search approved businesses and open a seller-filtered storefront. All products returns to the existing marketplace.
- Existing product/order/checkout/pool code is retained. No payment gateway or subscription charging was added; plan prices are administrative settings until a subscription payment flow is separately connected.

IMPORTANT NOTES
- Existing businesses are not automatically approved or assigned a free plan. The creator must approve them and assign the Pilot/Free plan where appropriate.
- Existing already-published product rows are not deleted by this migration. Review and approve existing sellers before asking them to republish or edit listings.
- The creator UID must be configured before the creator panel or admin RPCs will work.
- The SQL assumes the existing business_profiles and business_products tables from the Mjadala business-shopping migration, including business_profiles.user_id and business_products.seller_id/published.
- No service_role key is used or added to browser JavaScript.
