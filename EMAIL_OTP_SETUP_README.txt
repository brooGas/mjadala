MJADALA EMAIL OTP + REELS CATEGORY UPDATE

OTP behavior included in the client:
- Signup requires name, email, password, and consent to Terms + Privacy Policy.
- Signup requests Supabase email confirmation and presents a six-digit OTP input.
- Verify uses supabase.auth.verifyOtp({ email, token, type: 'signup' }).
- Resend uses supabase.auth.resend({ type: 'signup', email }).
- After verification, consent versions and timestamp are stored in public.mjadala_user_consents.

REQUIRED SUPABASE SETUP BEFORE TESTING:
1. In Supabase Authentication > Providers > Email, enable email confirmations.
2. In Authentication > Email Templates > Confirm signup, use the numeric token placeholder {{ .Token }} in the email body. Do not use only {{ .ConfirmationURL }} for this OTP screen.
3. Set a suitable email subject and test with an email address you control. Ensure SMTP/provider delivery is configured for production.
4. Run MIGRATION_EMAIL_OTP_CONSENT.sql in Supabase SQL Editor.
5. Deploy the updated index.html, live-reels.js, privacy.html, terms.html, and SQL migration file (SQL itself must be run in Supabase, not uploaded as a web page).
6. Test signup, correct code, wrong/expired code, resend, sign-in, and consent row in the database.

Notes:
- Supabase email templates/settings are external project settings; this ZIP cannot change them automatically.
- Reels category chips are a single horizontal ribbon and duplicate category names are suppressed. Filtering is based on short_categories IDs and shorts.category_id. For You shows all published Reels; Following shows followed creators' Reels for a signed-in user.
- Existing Reel features remain in live-reels.js. Validate schema/storage policies and actions in your Supabase project before public launch.
- Privacy policy contains a placeholder instruction to add Mjadala's official support email before public launch.
