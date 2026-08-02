# Admin password / email update (Edge Function)

Browser cannot use the service role. This function updates Auth password/email securely.

## Important

- **Vercel deploy ≠ Edge Function deploy**
- You must deploy this function on **Supabase**, not only the React app.

## Deploy (CLI)

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-set-password
```

## Deploy (Dashboard)

1. Open Supabase project → **Edge Functions**
2. Create function named exactly: `admin-set-password`
3. Paste code from `index.ts`
4. Deploy
5. Confirm URL works:  
   `https://YOUR_PROJECT.supabase.co/functions/v1/admin-set-password`

## After deploy

Admin / Super Admin → Manage Teachers → key icon → **Set New Password**

## Check JWT setting

In function settings, **Verify JWT with legacy secret** can stay ON.  
App sends the logged-in Admin access token.
