WATT AI VERIFIED CONNECTION PACKAGE

This package was assembled against the latest uploaded Mjadala ZIP (mjadala-main(9).zip) and the Watt AI agent/chat update. It contains only three changed/required files:

1. index.html — updates the existing Watt AI iframe bridge to pass the signed-in Supabase access token.
2. watt-ai.html — seven-agent chat interface, sends authenticated requests to the watt-chat Edge Function, and reads the `answer` response field.
3. supabase/functions/watt-chat/index.ts — complete authenticated Edge Function; verifies the user session, calls the OpenAI Responses API, and returns `{ answer: ... }`.

IMPORTANT DEPLOYMENT ORDER
A. Supabase: open Edge Functions > watt-chat > Code. Replace ALL code in index.ts with the complete file at supabase/functions/watt-chat/index.ts from this package, then Deploy. Keep Verify JWT OFF because this function performs its own Supabase user-token verification. Do not create SUPABASE_* secrets. OPENAI_API_KEY must already exist as a Supabase Function secret.
B. Website: replace the deployed project's index.html and watt-ai.html with the matching files in this package and redeploy the website. Do not replace other project files.
C. Sign into Mjadala, reload the site, open Watt AI, and send `Hello, what can you do?`

The Edge Function returns `answer` (not `reply`) because the browser client reads `data.answer`. The parent page now sends the access token to the iframe; the previous version did not.
