/**
 * Seeds / repairs demo Admin, Teacher, Student via Supabase REST (no websocket).
 * Run: node seed_demo_users.mjs
 */
const BASE = 'https://hlcxuhzbpugzzbwogfvg.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3h1aHpicHVnenpid29nZnZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTU3NzIsImV4cCI6MjEwMDYzMTc3Mn0.wBEhD14EhYOii0ze1KSOeg4fuuMCgXg_CRVf_NtoCeA';
const PASSWORD = 'Password123';

const ACCOUNTS = [
  { email: 'admin123@gmail.com', full_name: 'Demo Admin', roleName: 'Admin', kind: 'admin' },
  { email: 'teacher123@gmail.com', full_name: 'Demo Teacher', roleName: 'Teacher', kind: 'teacher' },
  { email: 'student123@gmail.com', full_name: 'Demo Student', roleName: 'Student', kind: 'student' },
];

async function api(method, path, { token, body, prefer } = {}) {
  const headers = {
    apikey: ANON,
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = data?.msg || data?.error_description || data?.message || text || res.statusText;
    const err = new Error(`${method} ${path} → ${res.status}: ${msg}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function login(email, password) {
  return api('POST', '/auth/v1/token?grant_type=password', {
    body: { email, password },
  });
}

async function signup(email, password, full_name, roleName) {
  return api('POST', '/auth/v1/signup', {
    body: {
      email,
      password,
      data: { full_name, role: roleName },
    },
  });
}

async function updateUserMeta(token, full_name, roleName) {
  return api('PUT', '/auth/v1/user', {
    token,
    body: { data: { full_name, role: roleName } },
  });
}

async function getRoles(token) {
  return api('GET', '/rest/v1/roles?select=id,name', { token });
}

async function getProfile(token, userId) {
  return api('GET', `/rest/v1/profiles?id=eq.${userId}&select=id,email,status,role_id`, { token });
}

async function upsertProfile(token, row) {
  // Try update by id
  const updated = await api(
    'PATCH',
    `/rest/v1/profiles?id=eq.${row.id}`,
    {
      token,
      body: {
        full_name: row.full_name,
        status: 'Approved',
        ...(row.role_id ? { role_id: row.role_id } : {}),
        email: row.email,
      },
      prefer: 'return=representation',
    }
  );
  if (Array.isArray(updated) && updated.length) return updated[0];

  // Insert
  try {
    const inserted = await api('POST', '/rest/v1/profiles', {
      token,
      body: {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        status: 'Approved',
        ...(row.role_id ? { role_id: row.role_id } : {}),
      },
      prefer: 'return=representation',
    });
    return Array.isArray(inserted) ? inserted[0] : inserted;
  } catch (e) {
    // Update by email
    const byEmail = await api(
      'PATCH',
      `/rest/v1/profiles?email=eq.${encodeURIComponent(row.email)}`,
      {
        token,
        body: {
          full_name: row.full_name,
          status: 'Approved',
          ...(row.role_id ? { role_id: row.role_id } : {}),
        },
        prefer: 'return=representation',
      }
    );
    return Array.isArray(byEmail) ? byEmail[0] : byEmail;
  }
}

async function ensureTeacher(token, profileId) {
  const existing = await api(
    'GET',
    `/rest/v1/teachers?profile_id=eq.${profileId}&select=id`,
    { token }
  );
  if (existing?.length) {
    console.log('  teachers row exists');
    return;
  }
  await api('POST', '/rest/v1/teachers', {
    token,
    body: { profile_id: profileId, specialization: 'Web Development' },
    prefer: 'return=representation',
  });
  console.log('  teachers row created');
}

async function ensureStudent(token, profileId) {
  const existing = await api(
    'GET',
    `/rest/v1/students?profile_id=eq.${profileId}&select=id,batch_id`,
    { token }
  );
  if (existing?.length) {
    console.log('  students row exists');
    if (!existing[0].batch_id) {
      await attachBatch(token, existing[0].id);
    }
    return;
  }
  const created = await api('POST', '/rest/v1/students', {
    token,
    body: {
      profile_id: profileId,
      enrollment_date: new Date().toISOString().slice(0, 10),
    },
    prefer: 'return=representation',
  });
  const studentId = Array.isArray(created) ? created[0]?.id : created?.id;
  console.log('  students row created');
  if (studentId) await attachBatch(token, studentId);
}

async function attachBatch(token, studentId) {
  try {
    const batches = await api('GET', '/rest/v1/batches?select=id,name&limit=1', { token });
    if (!batches?.length) {
      console.log('  no batch to attach');
      return;
    }
    await api('PATCH', `/rest/v1/students?id=eq.${studentId}`, {
      token,
      body: { batch_id: batches[0].id },
    });
    console.log('  attached batch:', batches[0].name || batches[0].id);
  } catch (e) {
    console.warn('  batch attach failed:', e.message);
  }
}

async function ensureAccount(account) {
  console.log(`\n--- ${account.email} (${account.roleName}) ---`);

  let session;
  try {
    session = await login(account.email, PASSWORD);
    console.log('  login OK');
  } catch (e) {
    console.log('  login failed, trying signup...', e.message);
    try {
      await signup(account.email, PASSWORD, account.full_name, account.roleName);
      console.log('  signup OK');
    } catch (se) {
      console.warn('  signup:', se.message);
    }
    session = await login(account.email, PASSWORD);
    console.log('  login after signup OK');
  }

  const token = session.access_token;
  const userId = session.user.id;
  console.log('  uid:', userId);

  try {
    await updateUserMeta(token, account.full_name, account.roleName);
    console.log('  auth metadata role set');
  } catch (e) {
    console.warn('  metadata update failed:', e.message);
  }

  let roleId = null;
  try {
    const roles = await getRoles(token);
    roleId = roles?.find((r) => r.name === account.roleName)?.id ?? null;
    console.log('  role_id:', roleId || '(not found/readable)');
  } catch (e) {
    console.warn('  roles fetch failed:', e.message);
  }

  try {
    const profile = await upsertProfile(token, {
      id: userId,
      email: account.email,
      full_name: account.full_name,
      role_id: roleId,
    });
    console.log('  profile:', JSON.stringify(profile));
    const profileId = profile?.id || userId;

    if (account.kind === 'teacher') await ensureTeacher(token, profileId);
    if (account.kind === 'student') await ensureStudent(token, profileId);
  } catch (e) {
    console.warn('  profile/membership failed:', e.message);
  }

  return { token, userId };
}

async function saRepairPass() {
  console.log('\n--- Super Admin repair pass ---');
  let sa;
  try {
    sa = await login('abdullahwali79@gmail.com', 'Abdullah123@');
  } catch (e) {
    console.warn('  SA login failed:', e.message);
    return;
  }
  const token = sa.access_token;

  let roleMap = {};
  try {
    const roles = await getRoles(token);
    roleMap = Object.fromEntries((roles || []).map((r) => [r.name, r.id]));
    console.log('  SA roles:', Object.keys(roleMap).join(', ') || '(none)');
  } catch (e) {
    console.warn('  SA roles fetch failed:', e.message);
  }

  for (const account of ACCOUNTS) {
    const roleId = roleMap[account.roleName] || null;
    try {
      const updated = await api(
        'PATCH',
        `/rest/v1/profiles?email=eq.${encodeURIComponent(account.email)}`,
        {
          token,
          body: {
            full_name: account.full_name,
            status: 'Approved',
            ...(roleId ? { role_id: roleId } : {}),
          },
          prefer: 'return=representation',
        }
      );
      if (!updated?.length) {
        console.warn(`  SA: no profile for ${account.email}`);
        continue;
      }
      console.log(`  SA updated ${account.email}:`, JSON.stringify(updated[0]));
      const pid = updated[0].id;

      if (account.kind === 'teacher') {
        try {
          await ensureTeacher(token, pid);
        } catch (e) {
          console.warn('  SA teacher:', e.message);
        }
      }
      if (account.kind === 'student') {
        try {
          await ensureStudent(token, pid);
        } catch (e) {
          console.warn('  SA student:', e.message);
        }
      }
    } catch (e) {
      console.warn(`  SA update ${account.email}:`, e.message);
    }
  }
}

async function verify(account) {
  try {
    const session = await login(account.email, PASSWORD);
    const token = session.access_token;
    const uid = session.user.id;
    const metaRole = session.user.user_metadata?.role ?? null;
    const profiles = await getProfile(token, uid);
    const profile = profiles?.[0] ?? null;
    let roleName = null;
    if (profile?.role_id) {
      try {
        const roles = await api(
          'GET',
          `/rest/v1/roles?id=eq.${profile.role_id}&select=name`,
          { token }
        );
        roleName = roles?.[0]?.name ?? null;
      } catch {
        /* ignore */
      }
    }
    const resolved = roleName || metaRole;
    const ok =
      String(resolved || '').toLowerCase() === account.roleName.toLowerCase() ||
      (account.roleName === 'Admin' &&
        String(resolved || '').toLowerCase().includes('admin'));
    console.log(ok ? 'OK  ' : 'FAIL', account.email, {
      status: profile?.status,
      roleName,
      metaRole,
      resolved,
    });
  } catch (e) {
    console.log('FAIL', account.email, e.message);
  }
}

async function main() {
  console.log('=== Seed demo users (REST) ===');
  for (const account of ACCOUNTS) {
    try {
      await ensureAccount(account);
    } catch (e) {
      console.error('  FAILED:', e.message);
    }
  }
  await saRepairPass();
  console.log('\n=== Verification ===');
  for (const account of ACCOUNTS) {
    await verify(account);
  }
  console.log('\nDone. Password for all: Password123');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
