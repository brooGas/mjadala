# Mjadala Profile Settings Update

This update improves the profile editor and adds an Account settings card with Sign out and Delete account actions.

- Sign out uses the existing app sign-out flow.
- Delete account asks for two confirmations. It invokes a Supabase Edge Function named `delete-account`.
- **Important:** permanent account deletion will only work after you deploy a secure `delete-account` Edge Function that verifies the authenticated user and deletes the account through the Supabase service role on the server. Never put the service-role key in `index.html` or any browser code. If the function is not deployed, the app shows a message and does not pretend deletion succeeded.
- No SQL migration is required for the visual settings update.

Replace the matching files in your repository and let Vercel redeploy. Test sign-out first.
