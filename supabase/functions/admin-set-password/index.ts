// Supabase Edge Function: set/reset a user's password (admin only)
// Deploy:
//   supabase functions deploy admin-set-password
// Secrets are auto-available: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
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

    // Verify caller is Approved Admin / Super Admin
    const { data: profile } = await caller
      .from('profiles')
      .select('status, roles(name)')
      .eq('id', adminUser.id)
      .limit(1);

    const row = profile?.[0] as any;
    const roleName = Array.isArray(row?.roles) ? row.roles[0]?.name : row?.roles?.name;
    const allowed =
      row?.status === 'Approved' &&
      (roleName === 'Admin' || roleName === 'Super Admin');

    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Only admins can reset passwords' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const userId = String(body.userId || '').trim();
    const password = String(body.password || '');

    if (!userId || password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'userId and password (min 6 chars) are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data, error } = await admin.auth.admin.updateUserById(userId, { password });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, userId: data.user?.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Unexpected error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
