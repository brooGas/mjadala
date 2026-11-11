WATT AI FLOATING ASSISTANT — INTEGRATION PATCH

Files:
- index.html: adds the Watt AI script to the existing Mjadala app shell.
- watt-ai.js: adds the floating Watt AI launcher and full-screen assistant interface.

Installation:
1. Back up the current deployed project.
2. Replace the root index.html with this index.html.
3. Add watt-ai.js to the project root beside index.html.
4. Deploy both files together.

Behavior:
- Floating power-inspired Watt AI launcher appears above the bottom navigation.
- Tapping it opens a full-screen overlay, covering the app pages; closing it returns to the underlying page.
- Greeting uses profiles.nickname for the authenticated Supabase user, with auth metadata/email fallback. Guest fallback is "Hello! I'm Watt AI."
- Six specialist agent entry points and Starter / Agent Pro / All-Access plan presentation are included.

Important implementation boundary:
This patch is the frontend interface only. It does not connect an LLM, execute shopping/business actions, create subscriptions, charge users, or enforce plan entitlements. Those require secure server-side integrations, provider configuration, usage limits, database design and payment confirmation. No secrets or service-role keys are added.
