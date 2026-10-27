MJADALA MARKETPLACE FIXES — FILES ONLY

This ZIP contains two updated files for the existing repository:
- index.html
- business-integration.js

Before replacing anything, keep a copy of your current versions.

Upload both files to the ROOT of your existing GitHub repository (the same folder where index.html and business-integration.js currently live), replacing those two files only.
Do not upload this README to the app if you do not want to; it is instructions only.
Do not run any SQL from older ZIPs as part of this update.

Changes included:
- Removes the default Smart LED sample name/description/price so new listings do not accidentally copy the sample product.
- Replaces the generic “MV” no-photo tile with initials based on each product's own name.
- Clears the old detail image when a selected product has no photo.
- Makes product details scroll into view when “View product” is tapped.
- Adds a scrollable marketplace listing area to reduce overlap with warranty/terms.
- Hides seller creation controls until a signed-in user opens My Business.
- Shows “Remove my product” only on listings owned by the signed-in account and asks for confirmation before requesting deletion.

Important limitation:
The app's Supabase Row Level Security must permit the seller to delete their own business_products row. If the database rejects deletion, the UI will show an error; do not weaken database security or run a guessed SQL policy. We should inspect the live table policies first.

The paid business-website/admin control feature is not included in this focused marketplace patch.
