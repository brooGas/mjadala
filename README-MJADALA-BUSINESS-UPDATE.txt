MJADALA BUSINESS ADMIN / SCROLL / ASSIGNMENT UPDATE

Replace these three root files in your project:
1. index.html
2. business-directory.js
3. business-integration.js

The index change removes the unguarded page-swipe handler and leaves one guarded handler. Gestures starting inside the business directory, admin panel, tables, tabs, buttons and form controls no longer switch Home/Explore/Reels.

The business-directory.js retains the plan management/public pricing work. Existing-business assignment now explicitly requires an active plan, shows the exact Supabase error code/message, and reports success/failure without silently doing nothing.

Run MIGRATION_DIAGNOSE_BUSINESS_ASSIGNMENT.sql in Supabase SQL Editor. It is READ ONLY. Please paste its three result sets back before applying a database repair. The source package available here does not contain the deployed SQL definition of mj_creator_assign_plan, so I will not guess its internal table columns and risk corrupting subscription records.

Payment-first plan checkout and trial payment activation are not enabled in this patch. The existing Daraja flow is for product orders, not subscription invoices; a separate subscription payment record and verified callback are required.

No other app modules or M-Pesa product-order code have been changed.
