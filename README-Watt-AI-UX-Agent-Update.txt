WATT AI AGENT + CHAT SURFACE UPDATE

This patch contains ONLY two affected files:
1. watt-ai.html
2. supabase/functions/watt-chat/index.ts

WHAT CHANGED
- Switching agents no longer inserts an announcement into the conversation.
- The selected agent is shown in the chat header and agent selector instead.
- The same conversation history is retained when switching agents.
- Each of the seven agents has a clearer, distinct purpose.
- Watt AI keeps one consistent Mjadala identity and avoids repetitive introductions.
- General mode is a general-purpose assistant, not a finance-only assistant.
- Existing Supabase authentication, OpenAI secret handling, API model setting, and endpoint are preserved.

DEPLOYMENT
- Replace the existing public/watt-ai.html with watt-ai.html.
- Deploy supabase/functions/watt-chat/index.ts as the watt-chat Edge Function.
- Do NOT replace index.html; it is intentionally not included in this patch.
- No new Supabase secrets or schema changes are required.
