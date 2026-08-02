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

    const { data: profile, error: profileError } = await caller
      .from('profiles')
      .select('status, role_id, permissions')
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
    const email = String(adminUser.email || '').trim().toLowerCase();
    const isPrincipal = email === 'chief_thevehari@live.com';
    const isPrimaryAdmin = email === 'abdullahwali79@gmail.com';

    const isSuperAdmin =
      isPrincipal || roleName === 'Super Admin';
    const isAdmin =
      isPrimaryAdmin || roleName === 'Admin' || roleName === 'Super Admin';

    if (profile.status !== 'Approved' || (!isSuperAdmin && !isAdmin)) {
      return json(
        { error: `Only Admin/Super Admin can update users (role=${roleName || 'none'})` },
        403,
      );
    }

    const effectiveRole = isSuperAdmin ? 'Super Admin' : 'Admin';

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const userId = String(body.userId || '').trim();
    const password = String(body.password || '');
    const newEmail = String(body.email || '').trim().toLowerCase();
    const hintEmail = String(body.hintEmail || '').trim().toLowerCase();

    if (!userId) {
      return json({ error: 'userId is required' }, 400);
    }

    if (!newEmail && password.length < 6) {
      return json(
        { error: 'Provide password (min 6 chars) and/or a valid email to update' },
        400,
      );
    }

    if (password && password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, 400);
    }

    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return json({ error: 'Invalid email address' }, 400);
    }

    // Admin password permission (Super Admin always allowed)
    if (password.length >= 6 && effectiveRole !== 'Super Admin') {
      const perms = (profile.permissions ?? {}) as Record<string, boolean>;
      const keys = Object.keys(perms);
      const allowedReset =
        keys.length === 0 ? true : Boolean(perms.can_reset_passwords);
      if (!allowedReset) {
        return json({ error: 'You do not have permission to reset passwords' }, 403);
      }
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Load target profile (source of truth for UI email)
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id, email, role_id')
      .eq('id', userId)
      .maybeSingle();

    let targetRoleName = '';
    if (targetProfile?.role_id) {
      const { data: tr } = await admin
        .from('roles')
        .select('name')
        .eq('id', targetProfile.role_id)
        .maybeSingle();
      targetRoleName = tr?.name || '';
    }

    if (newEmail) {
      if (targetRoleName === 'Teacher' && effectiveRole !== 'Super Admin') {
        return json({ error: 'Only Super Admin can change teacher email' }, 403);
      }
    }

    // Ensure Auth user exists for this profile id
    const { data: existingAuth, error: getUserErr } = await admin.auth.admin.getUserById(userId);
    if (getUserErr || !existingAuth?.user) {
      return json(
        {
          error:
            'Auth account not found for this user. Password cannot be set until the account exists in Auth.',
        },
        404,
      );
    }

    const authEmail = String(existingAuth.user.email || '').trim().toLowerCase();
    const profileEmail = String(targetProfile?.email || hintEmail || '')
      .trim()
      .toLowerCase();

    const patch: { password?: string; email?: string; email_confirm?: boolean } = {};
    if (password.length >= 6) patch.password = password;

    // Explicit email change from caller
    if (newEmail) {
      patch.email = newEmail;
      patch.email_confirm = true;
    } else if (
      // Critical: UI shows profiles.email — if Auth email differs, login with UI email fails
      password.length >= 6 &&
      profileEmail &&
      profileEmail !== authEmail &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail)
    ) {
      patch.email = profileEmail;
      patch.email_confirm = true;
    }

    if (!patch.password && !patch.email) {
      return json({ error: 'Nothing to update' }, 400);
    }

    const { data, error } = await admin.auth.admin.updateUserById(userId, patch);

    if (error) {
      const msg = error.message || 'Password update failed';
      if (/already.*(registered|been)|email.*exist/i.test(msg)) {
        return json(
          {
            error:
              'That email is already used by another Auth account. Fix the profile email or merge accounts first.',
          },
          400,
        );
      }
      return json({ error: msg }, 400);
    }

    const loginEmail = String(data.user?.email || patch.email || authEmail || '').toLowerCase();

    if (patch.email) {
      await admin.from('profiles').update({ email: patch.email }).eq('id', userId);
    }

    // Confirm password was actually applied when requested
    if (patch.password && !data.user?.id) {
      return json({ error: 'Auth update returned no user' }, 500);
    }

    return json({
      ok: true,
      userId: data.user?.id ?? userId,
      loginEmail: loginEmail || null,
      emailSynced: Boolean(patch.email && patch.email !== authEmail),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return json({ error: message }, 500);
  }
});
