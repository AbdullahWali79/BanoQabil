# Admin password reset (Edge Function)

Direct password set/reset needs the service role, so it runs in this Edge Function (not in the browser).

## Deploy once

```bash
# from project root (requires Supabase CLI logged in)
supabase functions deploy admin-set-password
```

Or in Supabase Dashboard → Edge Functions → create `admin-set-password` and paste
`supabase/functions/admin-set-password/index.ts`.

## After deploy

Admin → Manage Teachers → key icon → **Set New Password** works.

If function is not deployed yet, use **Send Reset Email Instead**.
