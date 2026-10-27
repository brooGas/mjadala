MJADALA FUNCTIONAL V7 — BUSINESS SHOPPING PASS

Changed files:
- index.html: loads Supabase JS and business integration; adds checkout contact fields; updates labels so the UI does not claim that M-Pesa is already connected.
- business-integration.js: signs in existing Mjadala accounts, saves products, uploads product photos, loads a published listing, and creates orders via a secure SQL RPC. The product pool is selected in the UI and a participant is only added when checkout succeeds.
- MIGRATION_BUSINESS_SHOPPING_FUNCTIONAL.sql: creates the product-images bucket and policies and adds server-side order pricing/validation.

IMPORTANT:
1. The five tables must already exist, as confirmed by the user.
2. Run MIGRATION_BUSINESS_SHOPPING_FUNCTIONAL.sql in Supabase SQL Editor before testing this pass.
3. M-Pesa/STK Push is NOT connected. The order is created with payment_status='pending'; an actual Daraja server-side integration is still needed.
4. The app uses the existing public/publishable Supabase key from the original project. Never add a service_role secret to browser code.
5. Business table row-level-security policies must permit authenticated sellers to manage their own business_profiles and business_products and permit reading published products. If publishing is denied, share the exact Supabase error so policies can be reconciled with the existing schema.
6. This pass does not claim that all Home/social/reels/community actions have been converted to backend functionality; it targets business products and order creation.
