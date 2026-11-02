MJADALA BUSINESS PLAN MANAGEMENT + PUBLIC PRICING TABLE

Replace only these two files in the deployed project:
1. business-directory.js
2. index.html

Keep business-integration.js and all checkout / M-Pesa files unchanged.

What changed:
- Creator admin plan table now shows Active or Suspended status.
- Admin can Edit, Suspend, Activate, and Delete a plan.
- New plans remain active by default.
- Deletion is attempted normally. If a plan is already referenced by subscriptions, the database foreign-key protection may reject deletion; suspend that plan instead.
- The Register a business tab now displays a clean public pricing comparison table using active plans only.
- The public table shows plan, price, access duration, trial and description.
- Script cache version was updated in index.html.

No SQL migration is required for these changes: they use existing mj_business_plans fields and existing creator-admin RLS policies from MIGRATION_BUSINESS_DIRECTORY_ADMIN.sql.

Note: the pricing table is informational. This update does not introduce a payment checkout or charge applicants. Existing approval and plan-assignment flow remains in place.

Validation: business-directory.js passed node --check. The archive was checked after creation. No live Supabase or deployed-browser end-to-end test was performed.
