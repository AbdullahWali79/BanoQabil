/**
 * Seed multiple trainers (password = username for script-added accounts).
 * Prerequisite: run extend_teachers_schema.sql once (for extra columns).
 * Run: node seed_trainers_batch.mjs
 */
const BASE = 'https://hlcxuhzbpugzzbwogfvg.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3h1aHpicHVnenpid29nZnZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTU3NzIsImV4cCI6MjEwMDYzMTc3Mn0.wBEhD14EhYOii0ze1KSOeg4fuuMCgXg_CRVf_NtoCeA';

const TRAINERS = [
  {
    full_name: 'Hafiz Muhammad Naeem',
    username: 'hafiznaeem',
    email: 'hnaeemabbas1@gmail.com',
    cnic: '3660301685523',
    province: 'Punjab',
    region: 'South Punjab',
    district: 'Vehari',
    city: 'Vehari',
    phone: '03044342966',
    experience: '5 Years',
    address: 'House No. 67, Model Town Vehari',
    trainer_code: '524',
    specialization: 'Trainer',
  },
  {
    full_name: 'Muhammad Abdullah',
    username: 'm.abdullah',
    email: 'abdullahwale@gmail.com',
    cnic: '3660303415627',
    province: 'Punjab',
    region: 'South Punjab',
    district: 'Vehari',
    city: 'Vehari',
    phone: '03046983794',
    experience: '9 Years',
    address: 'House No. 23, Street No. 2, Al-Jannat Colony, Vehari',
    trainer_code: '541',
    specialization: 'Trainer',
  },
  {
    full_name: 'Qasim Nazir',
    username: 'qasim.nazir',
    // Fixed obvious typo gmai.com → gmail.com so login/email works
    email: 'qasimlibra28@gmail.com',
    cnic: '3320386059249',
    province: 'Punjab',
    region: 'South Punjab',
    district: 'Vehari',
    city: 'Vehari',
    phone: '03145250544',
    experience: '10 Years',
    address: 'Majeed Town, Vehari',
    trainer_code: '548',
    specialization: 'Trainer',
  },
  {
    full_name: 'Zunaira Tariq',
    username: 'ZunairaTariq',
    email: 'zunairat69@gmail.com',
    cnic: '3660396962362',
    province: 'Punjab',
    region: 'South Punjab',
    district: 'Vehari',
    city: 'Vehari',
    phone: '03014249810',
    experience: '5 Years',
    address: 'Chak No. 9/WB, House No. 67, Model Town, Vehari',
    trainer_code: '532',
    specialization: 'Trainer',
  },
  {
    full_name: 'Sajjad Khan',
    username: 'sajjad.khan',
    email: 'sajjadkhanggg@gmail.com',
    cnic: '3840236234451',
    province: 'Punjab',
    region: 'South Punjab',
    district: 'Vehari',
    city: 'Vehari',
    phone: '03366896492',
    experience: '4 Years',
    address: 'U-Block, Peoples Colony, Vehari',
    trainer_code: 'CIT',
    specialization: 'CIT',
  },
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
    throw err;
  }
  return data;
}

async function ensureAuthUser(trainer) {
  const password = trainer.username; // script rule: password = username
  try {
    const session = await api('POST', '/auth/v1/token?grant_type=password', {
      body: { email: trainer.email, password },
    });
    return { session, created: false, password };
  } catch {
    try {
      await api('POST', '/auth/v1/signup', {
        body: {
          email: trainer.email,
          password,
          data: {
            full_name: trainer.full_name,
            role: 'Teacher',
            username: trainer.username,
          },
        },
      });
    } catch (e) {
      // User may already exist with different password
      console.warn(`  signup note (${trainer.email}):`, e.message);
    }
    const session = await api('POST', '/auth/v1/token?grant_type=password', {
      body: { email: trainer.email, password },
    });
    return { session, created: true, password };
  }
}

async function upsertTeacher(adminToken, teacherRoleId, trainer, userId) {
  const profileBody = {
    full_name: trainer.full_name,
    email: trainer.email,
    phone: trainer.phone,
    address: trainer.address,
    role_id: teacherRoleId,
    status: 'Approved',
  };

  let profile = await api('PATCH', `/rest/v1/profiles?id=eq.${userId}`, {
    token: adminToken,
    body: profileBody,
    prefer: 'return=representation',
  });

  if (!profile?.length) {
    try {
      profile = await api('POST', '/rest/v1/profiles', {
        token: adminToken,
        body: { id: userId, ...profileBody },
        prefer: 'return=representation',
      });
    } catch (e) {
      // try by email
      profile = await api(
        'PATCH',
        `/rest/v1/profiles?email=eq.${encodeURIComponent(trainer.email)}`,
        {
          token: adminToken,
          body: profileBody,
          prefer: 'return=representation',
        },
      );
    }
  }

  const fullTeacherBody = {
    profile_id: userId,
    specialization: trainer.specialization,
    username: trainer.username,
    cnic: trainer.cnic,
    province: trainer.province,
    region: trainer.region,
    district: trainer.district,
    city: trainer.city,
    experience: trainer.experience,
    address: trainer.address,
    trainer_code: trainer.trainer_code,
  };

  const existing = await api('GET', `/rest/v1/teachers?profile_id=eq.${userId}&select=id`, {
    token: adminToken,
  });

  try {
    if (existing?.length) {
      await api('PATCH', `/rest/v1/teachers?profile_id=eq.${userId}`, {
        token: adminToken,
        body: fullTeacherBody,
        prefer: 'return=representation',
      });
    } else {
      await api('POST', '/rest/v1/teachers', {
        token: adminToken,
        body: fullTeacherBody,
        prefer: 'return=representation',
      });
    }
    return 'full';
  } catch (e) {
    // Schema may not have extended columns yet — create basic row
    console.warn(`  extended fields failed (${trainer.email}):`, e.message);
    if (!existing?.length) {
      await api('POST', '/rest/v1/teachers', {
        token: adminToken,
        body: { profile_id: userId, specialization: trainer.specialization },
        prefer: 'return=representation',
      });
    } else {
      await api('PATCH', `/rest/v1/teachers?profile_id=eq.${userId}`, {
        token: adminToken,
        body: { specialization: trainer.specialization },
      });
    }
    return 'basic';
  }
}

async function main() {
  console.log('=== Seed trainers batch ===\n');

  let adminToken;
  try {
    const sa = await api('POST', '/auth/v1/token?grant_type=password', {
      body: { email: 'abdullahwali79@gmail.com', password: 'Abdullah123@' },
    });
    adminToken = sa.access_token;
    console.log('Super Admin session OK\n');
  } catch (e) {
    throw new Error('Super Admin login failed: ' + e.message);
  }

  const roles = await api('GET', '/rest/v1/roles?select=id,name', { token: adminToken });
  const teacherRoleId = roles?.find((r) => r.name === 'Teacher')?.id;
  if (!teacherRoleId) throw new Error('Teacher role not found');

  const results = [];

  for (const trainer of TRAINERS) {
    console.log(`--- ${trainer.full_name} <${trainer.email}> ---`);
    try {
      const { session, created, password } = await ensureAuthUser(trainer);
      const userId = session.user.id;
      console.log(`  auth ${created ? 'created' : 'exists'}: ${userId}`);

      try {
        await api('PUT', '/auth/v1/user', {
          token: session.access_token,
          body: {
            data: {
              full_name: trainer.full_name,
              role: 'Teacher',
              username: trainer.username,
            },
          },
        });
      } catch {
        /* ignore */
      }

      const mode = await upsertTeacher(adminToken, teacherRoleId, trainer, userId);
      console.log(`  profile/teacher upsert: ${mode}`);

      // verify login
      await api('POST', '/auth/v1/token?grant_type=password', {
        body: { email: trainer.email, password },
      });
      console.log('  login verify: OK');
      results.push({
        ok: true,
        name: trainer.full_name,
        email: trainer.email,
        username: trainer.username,
        password,
        mode,
      });
    } catch (e) {
      console.error('  FAILED:', e.message);
      results.push({
        ok: false,
        name: trainer.full_name,
        email: trainer.email,
        username: trainer.username,
        error: e.message,
      });
    }
    console.log('');
  }

  console.log('=== SUMMARY ===');
  for (const r of results) {
    if (r.ok) {
      console.log(`OK  ${r.name} | ${r.email} | user=${r.username} | pass=${r.password} | ${r.mode}`);
    } else {
      console.log(`FAIL ${r.name} | ${r.email} | ${r.error}`);
    }
  }
  console.log('\nNote: if mode=basic, run extend_teachers_schema.sql then re-run this script for CNIC/city/etc.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
