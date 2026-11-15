MJADALA WATT AI — RESPONSE TOOLS + IMAGE GENERATION UPDATE

This update changes ONLY these two files:
1. mjadala-main/watt-ai.html
2. mjadala-main/supabase/functions/watt-chat/index.ts

WHAT IT ADDS
- Copy, Read aloud, Share and More controls below assistant text responses.
- More menu includes Regenerate response and a Report a problem notice.
- Long-press (or right-click) a previous user message to Edit message or Copy message.
- Editing a previous message removes the later part of the current conversation from the active context; the edited text is placed in the composer for review before sending.
- An image button in the composer, plus automatic detection of common create/draw/design image requests.
- Image generation uses OpenAI GPT Image 2.5 Flare through the existing authenticated Supabase Edge Function. The OpenAI key stays on the server.
- Generated images can be saved to the device or shared where supported.

INSTALL — DO BOTH FILES
A. FRONTEND
1. Replace the existing project file mjadala-main/watt-ai.html with the supplied watt-ai.html.
2. Do not replace index.html or any other frontend file.

B. SUPABASE EDGE FUNCTION
1. Supabase Dashboard → Edge Functions → watt-chat → Code.
2. Open index.ts, select all, and replace it with the supplied index.ts.
3. Deploy updates.
4. Keep Verify JWT OFF as in the working setup. The function still verifies the user's Supabase session itself.
5. Keep the existing OPENAI_API_KEY secret. No new secret is required.

C. DEPLOY WEBSITE
Commit/push the changed watt-ai.html and allow Vercel to deploy it.

IMPORTANT
- Do not replace index.html, other Mjadala files, or secrets.
- Image generation is billed separately by OpenAI and requires image-generation access for the OpenAI project. If OpenAI requires organization verification, complete that in the OpenAI developer console.
- Speech playback uses the browser's built-in speech synthesis. Share support depends on the device/browser.
- The Report a problem menu item is a local notice only; no reporting backend has been connected.
- Generated image data is returned directly to the current chat view; it is not yet saved to a permanent Mjadala storage bucket.

TEST AFTER DEPLOYMENT
1. Send a normal text question and check Copy / Read aloud / Share / More.
2. Long-press your own earlier message; choose Edit message; confirm it returns to the composer and removes later messages from the active thread.
3. Tap the image button, describe a picture, and send. Or type: “Create an image of a clean modern product poster for a solar-powered water pump.”
