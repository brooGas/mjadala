MJADALA AUTHENTICATION UPDATE — OTP REMOVED

The signup interface no longer asks for or verifies a six-digit email OTP.
To allow immediate signup, open Supabase Dashboard > Authentication > Sign In / Providers (or Authentication > Settings, depending on dashboard version) and turn OFF email confirmation / Confirm email. Save the setting.

The app still requires users to accept Terms of Service and Privacy Policy before signup. Signup stores consent metadata and attempts to save the consent record if the mjadala_user_consents table exists.

IMPORTANT: If Supabase still returns 'Database error saving new user', that is a database trigger/function failure, not an OTP screen problem. The auth trigger must be fixed before signup can complete.
