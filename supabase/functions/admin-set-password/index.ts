// Supabase Edge Function: admin updates another user's password and/or email
// Deploy:
//   supabase functions deploy admin-set-password
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: adminUser },
      error: userError,
    } = await caller.auth.getUser();

    if (userError || !adminUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await caller
      .from('profiles')
      .select('status, roles(name)')
      .eq('id', adminUser.id)
      .limit(1);

    const row = profile?.[0] as Record<string, unknown> | undefined;
    const roles = row?.roles as { name?: string } | { name?: string }[] | null | undefined;
    const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name;
    const allowed =
      row?.status === 'Approved' &&
      (roleName === 'Admin' || roleName === 'Super Admin');

    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Only admins can update users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const userId = String(body.userId || '').trim();
    const password = String(body.password || '');
    const email = String(body.email || '').trim().toLowerCase();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!email && password.length < 6) {
      return new Response(
        JSON.stringify({
          error: 'Provide password (min 6 chars) and/or a valid email to update',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Teacher email changes: Super Admin only (Admin may still reset passwords)
    if (email) {
      const { data: targetProfile } = await caller
        .from('profiles')
        .select('roles(name)')
        .eq('id', userId)
        .limit(1);
      const targetRow = targetProfile?.[0] as Record<string, unknown> | undefined;
      const targetRoles = targetRow?.roles as
        | { name?: string }
        | { name?: string }[]
        | null
        | undefined;
      const targetRoleName = Array.isArray(targetRoles) ? targetRoles[0]?.name : targetRoles?.name;
      if (targetRoleName === 'Teacher' && roleName !== 'Super Admin') {
        return new Response(
          JSON.stringify({ error: 'Only Super Admin can change teacher email' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const patch: { password?: string; email?: string; email_confirm?: boolean } = {};
    if (password.length >= 6) patch.password = password;
    if (email) {
      patch.email = email;
      patch.email_confirm = true;
    }

    const { data, error } = await admin.auth.admin.updateUserById(userId, patch);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (email) {
      await admin.from('profiles').update({ email }).eq('id', userId);
    }

    return new Response(JSON.stringify({ ok: true, userId: data.user?.id, email: email || null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
