MJADALA + WATT AI INTEGRATION UPDATE
Build date: 2026-11-15

WHAT THIS UPDATE ADDS
1. Shopping-to-marketplace navigation:
   - Watt recognises product-search requests and common budget expressions such as 20k or KSh 20,000.
   - After answering, Watt sends a structured request to Mjadala.
   - Mjadala opens Explore, filters the existing published marketplace catalogue by product words and maximum price, and scrolls to the results.
   - A visible marketplace search field and a Clear control are included.
   - Search uses real published rows already loaded from public.business_products. It does not invent products.

2. Ask Watt on Engineering:
   - A small Ask Watt button appears on the Engineering Hub and Engineering community detail pages.
   - The Engineering page text currently visible is passed to Watt as context (up to 9,000 characters).
   - Watt opens as a compact panel, starts in Learning mode, and can answer questions about that page without navigating away.
   - The normal full-screen Watt launcher is hidden while the Engineering Hub/community detail is open, avoiding duplicate Watt buttons.

3. Creator flag:
   - The watt-chat Edge Function can securely identify the creator using Supabase Auth app_metadata.watt_creator === true.
   - Watt then displays “Creator access active” and disables subscription purchase buttons in the Watt interface.
   - This is controlled by server-verified app_metadata, not a browser-supplied flag.

FILES IN THIS PACKAGE
Copy these into the existing Mjadala repository, keeping the paths shown:
- mjadala-main/index.html
- mjadala-main/business-integration.js
- mjadala-main/engineering.js
- mjadala-main/watt-ai.html
- mjadala-main/sw.js
- mjadala-main/supabase/functions/watt-chat/index.ts

DEPLOYMENT
A. Replace the six listed files in the repository, preserving their exact names and paths.
B. Deploy the updated Supabase Edge Function at:
   supabase/functions/watt-chat/index.ts
   Function name: watt-chat
   Keep JWT verification enabled. Keep OPENAI_API_KEY in Supabase Edge Function secrets; do not put it in browser files.
C. Deploy the updated repository to Vercel. The script query versions and service-worker cache version have been bumped to avoid stale files.

ENABLE CREATOR ACCESS (ONE-TIME ADMIN ACTION)
1. Open Supabase Dashboard for the Mjadala project.
2. Go to Authentication -> Users and select the creator account.
3. Edit that user's Raw App Metadata. Preserve all existing keys and add:
   "watt_creator": true
   Example only: {"provider":"email","providers":["email"],"watt_creator":true}
4. Save, sign out of Mjadala, sign in again, then reopen Watt AI.

Only an administrator should set this app_metadata flag. Do not add watt_creator to user_metadata or let users set it from the browser.

IMPORTANT SCOPE / SAFETY
- No SQL migration is required for this update.
- No changes are made to M-Pesa checkout, subscription payment/callback functions, API secrets, Reels, Communities, or the Mjadala Home content.
- The marketplace search uses the existing latest 60 published products returned by the current marketplace loader. Product type matching is based on product name/description/business name because the existing product schema in this project does not expose a dedicated category field in the supplied source.
- Engineering context is page text only. It does not grant Watt access to private account data, files, or unrelated pages.
- The creator flag is verified by watt-chat. The existing subscription-status function was not changed because its source was not included in the supplied project files. This package does not alter that function or invent its database schema.

VALIDATION PERFORMED
- Browser JavaScript syntax checks passed for index.html inline scripts, watt-ai.html inline scripts, business-integration.js and engineering.js.
- Budget parsing tested with: “Find me a laptop under KSh 20,000”, “I need a laptop for 20k in products”, “Show me laptops of lets say 20k”, and “laptop 20k”. All resolved to laptop + KSh 20,000 maximum.
- The live Vercel deployment, Supabase tables, and mobile browser were not accessible from this build environment, so end-to-end production testing still needs to be done after deployment.
