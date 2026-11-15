MJADALA WATT AI CHAT COMPOSER UPDATE

This update changes ONE file only:
  mjadala-main/watt-ai.html

What changed:
- Replaces the emoji microphone with a clean microphone outline icon.
- Adds browser speech-to-text when the browser supports it and microphone permission is granted.
- Replaces the one-line input with an expanding multi-line message box.
- Enter sends; Shift+Enter inserts a new line.
- Adds a copy button to each fenced code block in Watt AI replies.
- Adds a Copy response control to assistant replies.

INSTALL:
1. Unzip this package.
2. In your Mjadala project, replace the existing file at:
     mjadala-main/watt-ai.html
   with the supplied file at the same path.
3. Do not replace index.html, any Supabase function, or any other file.
4. Commit/push the changed file and let Vercel deploy.
5. Open Mjadala, close any already-open Watt AI screen, then reopen it to load the new version.

No Supabase Edge Function changes or new secrets are required.
