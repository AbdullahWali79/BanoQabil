/// <reference path="../deno-shim.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Server misconfigured (missing env)' }, 500);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      return json({ error: 'Unauthorized — missing access token' }, 401);
    }

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const {
      data: { user: adminUser },
      error: userError,
    } = await caller.auth.getUser(jwt);

    if (userError || !adminUser) {
      return json({ error: 'Unauthorized — invalid session' }, 401);
    }

    // Resolve role without fragile nested embed
    const { data: profile, error: profileError } = await caller
      .from('profiles')
      .select('status, role_id')
      .eq('id', adminUser.id)
      .maybeSingle();

    if (profileError || !profile) {
      return json({ error: 'Caller profile not found' }, 403);
    }

    const { data: roleRow } = await caller
      .from('roles')
      .select('name')
      .eq('id', profile.role_id)
      .maybeSingle();

    const roleName = roleRow?.name || '';
    const allowed =
      profile.status === 'Approved' &&
      (roleName === 'Admin' || roleName === 'Super Admin');

    // Email lock backup (principal always treated as Super Admin for this API)
    const email = String(adminUser.email || '').trim().toLowerCase();
    const isPrincipal = email === 'chief_thevehari@live.com';
    const isPrimaryAdmin = email === 'abdullahwali79@gmail.com';
    const canCall =
      allowed ||
      (profile.status === 'Approved' && (isPrincipal || isPrimaryAdmin));

    if (!canCall) {
      return json(
        { error: `Only Admin/Super Admin can update users (role=${roleName || 'none'})` },
        403,
      );
    }

    const effectiveRole = isPrincipal
      ? 'Super Admin'
      : roleName === 'Super Admin'
        ? 'Super Admin'
        : 'Admin';

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const userId = String(body.userId || '').trim();
    const password = String(body.password || '');
    const newEmail = String(body.email || '').trim().toLowerCase();

    if (!userId) {
      return json({ error: 'userId is required' }, 400);
    }

    if (!newEmail && password.length < 6) {
      return json(
        { error: 'Provide password (min 6 chars) and/or a valid email to update' },
        400,
      );
    }

    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return json({ error: 'Invalid email address' }, 400);
    }

    // Teacher email changes: Super Admin only (Admin may still reset passwords)
    if (newEmail) {
      const { data: targetProfile } = await caller
        .from('profiles')
        .select('role_id')
        .eq('id', userId)
        .maybeSingle();

      let targetRoleName = '';
      if (targetProfile?.role_id) {
        const { data: tr } = await caller
          .from('roles')
          .select('name')
          .eq('id', targetProfile.role_id)
          .maybeSingle();
        targetRoleName = tr?.name || '';
      }

      if (targetRoleName === 'Teacher' && effectiveRole !== 'Super Admin') {
        return json({ error: 'Only Super Admin can change teacher email' }, 403);
      }
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const patch: { password?: string; email?: string; email_confirm?: boolean } = {};
    if (password.length >= 6) patch.password = password;
    if (newEmail) {
      patch.email = newEmail;
      patch.email_confirm = true;
    }

    const { data, error } = await admin.auth.admin.updateUserById(userId, patch);

    if (error) {
      return json({ error: error.message }, 400);
    }

    if (newEmail) {
      await admin.from('profiles').update({ email: newEmail }).eq('id', userId);
    }

    return json({ ok: true, userId: data.user?.id, email: newEmail || null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return json({ error: message }, 500);
  }
});
