WATT AI SUBSCRIPTIONS + M-PESA CHECKOUT
======================================

This is a separate Watt AI subscription system. It does NOT use or modify
Mjadala's Business Plans, business applications, marketplace orders or
business customer checkout.

WHAT IS INCLUDED
----------------
1. watt-ai.html
   - Agent Pro and All-Access pricing cards.
   - M-Pesa checkout dialog and payment status polling.
   - Displays the signed-in user's active Watt AI entitlements.
   - Existing conversation, response actions, image request UI and agent UI
     are retained.

2. index.html
   - A small change to the existing Watt AI iframe greeting: it securely
     passes the signed-in Supabase access token and user ID to the same-origin
     Watt AI iframe. This is required for authenticated payments and plan
     checks. No service-role key or Daraja secret is sent to the browser.

3. supabase/functions/watt-chat/index.ts
   - Keeps the existing OpenAI gateway and image route.
   - Reads active Watt AI subscriptions server-side.
   - Enforces paid specialist capabilities before calling OpenAI.
   - Returns polite 402 plan-required responses when access is missing.
   - Keeps each agent's specialist identity and scope.

4. supabase/functions/watt-subscription-stk-push/index.ts
   - Authenticates the Mjadala user.
   - Reads the selected plan and price from the database (never trusts a
     client-supplied price).
   - Creates a pending payment and sends an M-Pesa STK push.

5. supabase/functions/watt-subscription-callback/index.ts
   - Public Safaricom callback; validates payment amount and receipt through
     the database finalisation function before granting access.

6. supabase/functions/watt-subscription-status/index.ts
   - Authenticated endpoint for the user's own payment status and active plan.

7. MIGRATION_WATT_AI_SUBSCRIPTIONS.sql
   - Creates the Watt AI plan catalogue, payment ledger, subscriptions, RLS
     policies and an idempotent trusted callback finalisation function.

LAUNCH PRICING
--------------
Initial editable launch prices:
- Shopping Agent Pro:       KSh 199 / 30 days
- Business Agent Pro:       KSh 199 / 30 days
- Learning Agent Pro:       KSh 199 / 30 days
- Research Agent Pro:       KSh 199 / 30 days
- Innovation Agent Pro:     KSh 199 / 30 days
- Community Agent Pro:      KSh 199 / 30 days
- Watt AI All-Access:       KSh 599 / 30 days

These are launch proposals encoded in the migration. They can be changed in
public.watt_ai_plans before launch. All-Access grants all six specialist
entitlements. General assistant and Starter-level agent help remain free.
Subscriptions are 30-day passes and do NOT auto-renew; users manually renew.

PAYMENT PROVIDER
----------------
Safaricom Daraja M-Pesa STK Push is used because Mjadala serves Kenyan users.
The implementation reuses the standard Daraja secrets already used by the
Mjadala Daraja integration:
- DARAJA_ENV (sandbox or production)
- DARAJA_CONSUMER_KEY
- DARAJA_CONSUMER_SECRET
- DARAJA_SHORTCODE
- DARAJA_PASSKEY
- DARAJA_TRANSACTION_TYPE (optional; defaults to CustomerPayBillOnline)

IMPORTANT: The existing DARAJA_CALLBACK_URL is NOT changed. Watt AI uses its
own callback secret so it does not interfere with existing business/ad flows:
WATT_DARAJA_CALLBACK_URL=https://olqwfscmhtdseljvfqvm.supabase.co/functions/v1/watt-subscription-callback

DEPLOYMENT ORDER
----------------
A. BACK UP the deployed Mjadala project first.

B. Supabase Dashboard -> SQL Editor:
   Run MIGRATION_WATT_AI_SUBSCRIPTIONS.sql once.
   Do not run MJADALA_SUBSCRIPTION_SCHEMA.sql for this Watt AI feature; that
   schema belongs to the separate Mjadala business subscription workflow.

C. Add/update the secret WATT_DARAJA_CALLBACK_URL with the exact URL above.
   Reuse the existing DARAJA_* credentials if they are already configured.
   Do NOT replace DARAJA_CALLBACK_URL and do NOT create a new OpenAI key.
   If the existing M-Pesa integration uses different secret names, stop and
   map those names in the new STK function before deployment; do not paste
   credentials into chat or source code.

D. Copy these function folders into the existing Supabase functions folder:
   supabase/functions/watt-chat/index.ts                 (replace whole file)
   supabase/functions/watt-subscription-stk-push/index.ts (new function)
   supabase/functions/watt-subscription-callback/index.ts (new function)
   supabase/functions/watt-subscription-status/index.ts  (new function)
   Keep any existing supabase/functions/_shared and all other functions.

E. Deploy:
   supabase functions deploy watt-chat
   supabase functions deploy watt-subscription-stk-push
   supabase functions deploy watt-subscription-status
   supabase functions deploy watt-subscription-callback --no-verify-jwt

   Only the Safaricom callback must have Verify JWT OFF. Keep Verify JWT ON
   for watt-chat, watt-subscription-stk-push and watt-subscription-status.

F. Frontend:
   Replace the deployed root watt-ai.html with this package's watt-ai.html.
   Replace the deployed root index.html with this package's index.html.
   Deploy the site. The index.html change only adds the access token to the
   already-existing same-origin Watt AI iframe greeting.

G. Test in SANDBOX first:
   - Sign in to Mjadala.
   - Open Watt AI -> Agent Plans -> choose one Pro plan.
   - Enter a sandbox-eligible phone number and trigger the STK prompt.
   - Complete the sandbox flow and confirm the payment record becomes paid.
   - Confirm the selected agent displays active access and advanced capability
     is allowed. Test a different agent without Pro and confirm it receives
     the polite upgrade response.
   - Test All-Access and verify all six specialist agents unlock.

LIVE PAYMENTS
-------------
Do not switch DARAJA_ENV to production until Safaricom production credentials,
shortcode, transaction type and callback URL have been approved and tested.
A Till may require CustomerBuyGoodsOnline rather than CustomerPayBillOnline;
set DARAJA_TRANSACTION_TYPE to the value matching the shortcode type.

SECURITY / LIMITATIONS
----------------------
- Prices come from the database, not browser input.
- Payment records and subscriptions have owner-only read policies.
- Only the server callback can activate a subscription.
- A payment is not treated as paid until Safaricom returns success, a receipt
  and the exact expected amount.
- No automatic recurring debit is attempted.
- Advanced-feature enforcement is server-side and uses explicit request
  pattern rules. It is not a general-purpose metering or token quota system.
- The deployment package cannot access your private Supabase account, Daraja
  credentials, live Till/Paybill settings or Safaricom callback logs. Live
  end-to-end payment must be tested by you in the configured environment.
