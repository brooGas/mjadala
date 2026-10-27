MJADALA MARKETPLACE FIXES — v3

Replace ONLY these two files in the ROOT of your existing GitHub repository:
- index.html
- business-integration.js

Keep a backup of the current files first. Do not upload SQL and do not run a database migration for this UI/layout fix.

Fixes:
- Locks the selected product thumbnail to a true 56 x 56 px square, clips its contents, and constrains the image so it cannot overflow into the warranty section.
- After publishing succeeds, refreshes the owner's inventory and clears the product name, description, price and selected photos to reduce accidental duplicate submissions.
- Keeps the owner inventory's publish/unpublish controls for every product owned by the signed-in account, including unpublished products.
- Unpublishing preserves existing orders.

Important:
The app intentionally only shows owner controls for records whose seller_id matches the currently signed-in account. If older listings do not appear in My Products or have no owner controls, they may belong to a different account or have a different seller_id. Do not change database ownership or delete orders blindly. Send the exact message from My Products if inventory access fails.

The code is syntax-checked, but it has not been tested against your live Supabase project.
