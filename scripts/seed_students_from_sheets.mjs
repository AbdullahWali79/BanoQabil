/**
 * Seed students + teacher-course assignments from data/students/*.xlsx
 *
 * - Course from filename (Male/Female merged into one course)
 * - Teacher from sheet "Trainer" cell (CIT Female → Sajjad Khan)
 * - One course per teacher (reassigns teacher_courses)
 * - Creates one batch per sheet file, linked to that teacher + course
 * - Students: email = name@gmail.com (unique via .id if needed), password = application ID
 * - Missing fields left empty
 *
 * Run from repo root: node scripts/seed_students_from_sheets.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const BASE = 'https://hlcxuhzbpugzzbwogfvg.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3h1aHpicHVnenpid29nZnZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTU3NzIsImV4cCI6MjEwMDYzMTc3Mn0.wBEhD14EhYOii0ze1KSOeg4fuuMCgXg_CRVf_NtoCeA';

const STUDENTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/students');
const ADMIN_EMAIL = 'abdullahwali79@gmail.com';
const ADMIN_PASSWORD = 'Abdullah123@';

/** Map sheet trainer labels → existing teacher emails */
const TRAINER_EMAIL_MAP = [
  { match: /zunaira/i, email: 'zunairat69@gmail.com' },
  { match: /ashmeera|ashmira/i, email: 'ashmiramajeed14@gmail.com' },
  { match: /qasim/i, email: 'qasimlibra28@gmail.com' },
  { match: /hafiz|naeem/i, email: 'hnaeemabbas1@gmail.com' },
  { match: /sajjad/i, email: 'sajjadkhanggg@gmail.com' },
  { match: /abdullah/i, email: 'abdullahwale@gmail.com' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIGNUP_DELAY_MS = 1200;
const RATE_LIMIT_WAIT_MS = 65000;

async function api(method, pathName, { token, body, prefer, anon } = {}) {
  const headers = {
    apikey: ANON,
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (anon) headers.Authorization = `Bearer ${ANON}`;
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${BASE}${pathName}`, {
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
    const msg = data?.msg || data?.message || data?.error_description || text || res.statusText;
    const err = new Error(`${method} ${pathName} → ${res.status}: ${msg}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function normalizeCourseName(fileName) {
  let name = fileName.replace(/\.(xlsx|xls|csv)$/i, '');
  name = name.replace(/^\d+\s*/, '').trim();
  name = name.replace(/\s*\((male|female)\)\s*$/i, '').trim();
  name = name.replace(/\s+(male|female)\s*$/i, '').trim();

  if (/^cit(\s|$)/i.test(name) || /^computer information/i.test(name)) {
    return 'Computer Information & Technology';
  }
  if (/essential[s]?\s+of\s+ai/i.test(name)) return 'Essential of AI';
  if (/graphic\s+design/i.test(name)) return 'Graphic Designing';
  if (/digital\s+marketing/i.test(name)) return 'Digital Marketing';
  return name.replace(/\s+/g, ' ');
}

function parseTrainerCell(cell) {
  let t = String(cell || '')
    .replace(/Trainer/gi, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  t = t.replace(/\(B-?\d+\)/i, '').trim();
  if (!t || /^signature$/i.test(t)) return '';
  return t;
}

function extractBatchCode(fileName, trainerCell) {
  const fromTrainer = String(trainerCell || '').match(/\(B-?(\d+)\)/i);
  if (fromTrainer) return `B-${fromTrainer[1]}`;
  const fromFile = fileName.match(/^(\d+)/);
  if (fromFile) return `B-${fromFile[1]}`;
  return 'B-CIT-F';
}

function parseAttendanceStudents(rows) {
  const students = [];
  let cur = null;
  for (let i = 3; i < rows.length; i++) {
    const sr = rows[i][0];
    const c = String(rows[i][1] || '').trim();
    if (!c) continue;

    const isSr = sr !== '' && sr != null && !Number.isNaN(Number(sr));
    const digits = c.replace(/[\s-]/g, '');
    const looksPhone = /^0?3\d{8,}$/.test(digits);
    const looksId = /^\d{5,}$/.test(digits) && !looksPhone;

    if (isSr && looksId) {
      if (cur?.name) students.push(cur);
      cur = { application_id: digits, name: '', phone: '' };
      continue;
    }
    if (!cur) continue;
    if (!cur.name && !looksPhone && !looksId) {
      cur.name = c;
      continue;
    }
    if (!cur.phone && looksPhone) {
      cur.phone = digits.length === 11 ? digits : c.replace(/\s+/g, '');
    }
  }
  if (cur?.name) students.push(cur);
  return students;
}

function parseCitFemaleStudents(rows) {
  const students = [];
  for (let i = 2; i < rows.length; i++) {
    const application_id = String(rows[i][1] || '').trim();
    const name = String(rows[i][2] || '').trim();
    let phone = String(rows[i][3] || '').trim();
    if (!application_id || !name) continue;
    phone = phone.replace(/[\s-]/g, '');
    students.push({ application_id, name, phone });
  }
  return students;
}

function nameToEmailLocal(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
}

function buildEmail(name, applicationId, usedEmails) {
  const local = nameToEmailLocal(name) || `student${applicationId}`;
  let email = `${local}@gmail.com`;
  if (usedEmails.has(email)) {
    email = `${local}.${applicationId}@gmail.com`;
  }
  usedEmails.add(email);
  return email;
}

function resolveTrainerEmail(trainerLabel, courseName) {
  if (!trainerLabel && courseName === 'Computer Information & Technology') {
    return 'sajjadkhanggg@gmail.com';
  }
  for (const row of TRAINER_EMAIL_MAP) {
    if (row.match.test(trainerLabel || '')) return row.email;
  }
  return null;
}

function readAllSheets() {
  const files = fs.readdirSync(STUDENTS_DIR).filter((f) => /\.xlsx$/i.test(f));
  const groups = [];

  for (const file of files) {
    const courseName = normalizeCourseName(file);
    const wb = XLSX.readFile(path.join(STUDENTS_DIR, file));

    let trainerLabel = '';
    let students = [];
    let timing = '';
    let batchCodeSource = '';

    // Read ALL sheets/pages — merge unique students by application_id
    const byAppId = new Map();
    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', header: 1 });
      if (!batchCodeSource) batchCodeSource = rows[1]?.[18] || '';

      if (/cit\s*female/i.test(file)) {
        trainerLabel = 'Sajjad Khan';
        for (const s of parseCitFemaleStudents(rows)) {
          if (!byAppId.has(s.application_id)) byAppId.set(s.application_id, s);
        }
        if (!timing) {
          timing = String(rows[0]?.[0] || '')
            .replace(/[\r\n]+/g, ' | ')
            .trim();
        }
      } else {
        if (!trainerLabel) {
          const trainerCell = rows[1]?.[18] ?? rows[1]?.[rows[1].length - 1];
          trainerLabel = parseTrainerCell(trainerCell);
        }
        for (const s of parseAttendanceStudents(rows)) {
          if (!byAppId.has(s.application_id)) byAppId.set(s.application_id, s);
        }
        if (!timing) {
          timing = String(rows[0]?.[18] || rows[0]?.[rows[0].length - 1] || '')
            .replace(/[\r\n]+/g, ' ')
            .trim();
        }
      }
    }
    students = [...byAppId.values()];

    const batchCode = extractBatchCode(file, batchCodeSource);
    // Prefer (Male)/(Female) in filename — avoid matching "female" inside other words
    const gender = /\(\s*female\s*\)/i.test(file)
      ? 'Female'
      : /\(\s*male\s*\)/i.test(file)
        ? 'Male'
        : /female/i.test(file)
          ? 'Female'
          : /male/i.test(file)
            ? 'Male'
            : '';
    // One clean batch per course + gender (no tid:, no B-xx clutter)
    const batchName = `${courseName}${gender ? ` ${gender}` : ''}`.replace(/\s+/g, ' ').trim();

    groups.push({
      file,
      courseName,
      trainerLabel,
      batchCode,
      batchName,
      timing,
      students,
      gender,
    });
  }

  return groups;
}

async function ensureCourse(token, courseName, cache) {
  const key = courseName.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const existing = await api('GET', `/rest/v1/courses?select=id,name&name=eq.${encodeURIComponent(courseName)}`, {
    token,
  });
  if (existing?.[0]) {
    cache.set(key, existing[0]);
    return existing[0];
  }

  const created = await api('POST', '/rest/v1/courses', {
    token,
    body: { name: courseName, description: `${courseName} course` },
    prefer: 'return=representation',
  });
  const row = Array.isArray(created) ? created[0] : created;
  cache.set(key, row);
  return row;
}

async function main() {
  console.log('=== Parsing Excel sheets ===');
  const groups = readAllSheets();
  let totalStudents = 0;
  for (const g of groups) {
    console.log(
      `${g.file}\n  course=${g.courseName} | trainer=${g.trainerLabel || '(none)'} | students=${g.students.length}`,
    );
    totalStudents += g.students.length;
  }
  console.log(`\nTotal students parsed: ${totalStudents}\n`);

  console.log('=== Admin login ===');
  const sa = await api('POST', '/auth/v1/token?grant_type=password', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = sa.access_token;

  const roles = await api('GET', '/rest/v1/roles?select=id,name', { token });
  const studentRoleId = roles.find((r) => r.name === 'Student')?.id;
  if (!studentRoleId) throw new Error('Student role not found');

  // Load teachers
  const teachers = await api(
    'GET',
    '/rest/v1/teachers?select=id,profile_id,profiles!inner(id,email,full_name)',
    { token },
  );
  const teacherByEmail = new Map();
  for (const t of teachers || []) {
    const email = String(t.profiles?.email || '').toLowerCase();
    if (email) teacherByEmail.set(email, t);
  }

  const courseCache = new Map();
  const existingCourses = await api('GET', '/rest/v1/courses?select=id,name', { token });
  for (const c of existingCourses || []) {
    courseCache.set(String(c.name).toLowerCase(), c);
  }

  // Resolve course assignment per teacher (one course each; last file wins if conflict — prefer first)
  const teacherCoursePlan = new Map(); // teacherId -> courseId
  const teacherCourseName = new Map();

  for (const g of groups) {
    const course = await ensureCourse(token, g.courseName, courseCache);
    const email = resolveTrainerEmail(g.trainerLabel, g.courseName);
    if (!email) {
      console.warn(`WARN: no teacher match for trainer "${g.trainerLabel}" in ${g.file}`);
      continue;
    }
    const teacher = teacherByEmail.get(email.toLowerCase());
    if (!teacher) {
      console.warn(`WARN: teacher not in DB: ${email} (${g.trainerLabel})`);
      continue;
    }
    if (!teacherCoursePlan.has(teacher.id)) {
      teacherCoursePlan.set(teacher.id, course.id);
      teacherCourseName.set(teacher.id, course.name);
    } else if (teacherCoursePlan.get(teacher.id) !== course.id) {
      console.warn(
        `WARN: ${email} already planned for ${teacherCourseName.get(teacher.id)}, skipping also ${course.name}`,
      );
    }
    g.teacherId = teacher.id;
    g.courseId = course.id;
    g.teacherEmail = email;
  }

  console.log('\n=== Assign ONE course per teacher ===');
  // Clear and reinsert
  for (const teacher of teachers || []) {
    await api('DELETE', `/rest/v1/teacher_courses?teacher_id=eq.${teacher.id}`, {
      token,
      prefer: 'return=minimal',
    });
  }
  for (const [teacherId, courseId] of teacherCoursePlan.entries()) {
    await api('POST', '/rest/v1/teacher_courses', {
      token,
      body: { teacher_id: teacherId, course_id: courseId },
      prefer: 'return=minimal',
    });
    console.log(`  ${teacherCourseName.get(teacherId)} ← teacher ${teacherId.slice(0, 8)}…`);
  }

  // Existing student application_ids to skip
  const existingStudents = await api(
    'GET',
    '/rest/v1/students?select=application_id,profile_id',
    { token },
  );
  const existingAppIds = new Set(
    (existingStudents || []).map((s) => String(s.application_id || '')).filter(Boolean),
  );

  // Existing profiles by email
  const existingProfiles = await api('GET', '/rest/v1/profiles?select=id,email', { token });
  const profileByEmail = new Map(
    (existingProfiles || []).map((p) => [String(p.email || '').toLowerCase(), p]),
  );
  const usedEmails = new Set([...profileByEmail.keys()]);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  console.log('\n=== Creating batches + students ===');

  for (const g of groups) {
    if (!g.teacherId || !g.courseId) {
      console.warn(`SKIP group (no teacher/course): ${g.file}`);
      continue;
    }

    // Find or create batch (clean name — teacher_id column links teacher, no tid: prefix)
    const batchName = g.batchName;
    let batchId = null;
    const existingBatch = await api(
      'GET',
      `/rest/v1/batches?select=id,name&or=(name.eq.${encodeURIComponent(batchName)},name.eq.${encodeURIComponent(`tid:${g.teacherId}|${batchName}`)})`,
      { token },
    );
    if (existingBatch?.[0]?.id) {
      batchId = existingBatch[0].id;
      const patchBody = {
        course_id: g.courseId,
        timing: g.timing || null,
        name: batchName,
      };
      try {
        await api('PATCH', `/rest/v1/batches?id=eq.${batchId}`, {
          token,
          body: { ...patchBody, teacher_id: g.teacherId },
          prefer: 'return=minimal',
        });
      } catch {
        await api('PATCH', `/rest/v1/batches?id=eq.${batchId}`, {
          token,
          body: patchBody,
          prefer: 'return=minimal',
        });
      }
    } else {
      let createdBatch;
      try {
        createdBatch = await api('POST', '/rest/v1/batches', {
          token,
          body: {
            name: batchName,
            course_id: g.courseId,
            teacher_id: g.teacherId,
            timing: g.timing || null,
          },
          prefer: 'return=representation',
        });
      } catch (err) {
        if (!String(err.message).includes('teacher_id')) throw err;
        createdBatch = await api('POST', '/rest/v1/batches', {
          token,
          body: {
            name: batchName,
            course_id: g.courseId,
            timing: g.timing || null,
          },
          prefer: 'return=representation',
        });
      }
      batchId = (Array.isArray(createdBatch) ? createdBatch[0] : createdBatch)?.id;
    }

    console.log(`\nBatch: ${g.batchName} (${g.students.length} students) → ${g.teacherEmail}`);

    for (const student of g.students) {
      const appId = String(student.application_id || '').trim();
      if (!appId || !student.name) {
        skipped += 1;
        continue;
      }
      if (existingAppIds.has(appId)) {
        skipped += 1;
        continue;
      }

      const email = buildEmail(student.name, appId, usedEmails);
      const password = appId; // password = ID

      try {
        // Signup auth user (ephemeral — does not use admin session)
        let userId = profileByEmail.get(email)?.id || null;

        if (!userId) {
          let lastErr = null;
          for (let attempt = 1; attempt <= 5; attempt++) {
            try {
              const signup = await api('POST', '/auth/v1/signup', {
                anon: true,
                body: {
                  email,
                  password,
                  data: {
                    full_name: student.name,
                    role: 'Student',
                    application_id: appId,
                  },
                },
              });
              userId = signup?.user?.id || signup?.id || null;
              lastErr = null;
              break;
            } catch (err) {
              lastErr = err;
              const msg = String(err.message || '');
              if (msg.includes('rate limit') || err.status === 429) {
                console.log(`  Rate limited on ${student.name} — wait ${RATE_LIMIT_WAIT_MS / 1000}s (try ${attempt}/5)`);
                await sleep(RATE_LIMIT_WAIT_MS);
                continue;
              }
              // User may already exist
              await sleep(400);
              const found = await api(
                'GET',
                `/rest/v1/profiles?select=id,email&email=eq.${encodeURIComponent(email)}`,
                { token },
              );
              userId = found?.[0]?.id || null;
              if (userId) {
                lastErr = null;
                break;
              }
              throw err;
            }
          }
          if (!userId && lastErr) throw lastErr;
        }

        if (!userId) throw new Error('No user id after signup');

        await sleep(500);

        // Upsert profile
        const existingP = await api(
          'GET',
          `/rest/v1/profiles?select=id&id=eq.${userId}`,
          { token },
        );
        if (existingP?.[0]) {
          await api('PATCH', `/rest/v1/profiles?id=eq.${userId}`, {
            token,
            body: {
              full_name: student.name,
              email,
              phone: student.phone || null,
              role_id: studentRoleId,
              status: 'Approved',
            },
            prefer: 'return=minimal',
          });
        } else {
          await api('POST', '/rest/v1/profiles', {
            token,
            body: {
              id: userId,
              full_name: student.name,
              email,
              phone: student.phone || null,
              role_id: studentRoleId,
              status: 'Approved',
            },
            prefer: 'return=minimal',
          });
        }

        // Students row
        const existingS = await api(
          'GET',
          `/rest/v1/students?select=id&profile_id=eq.${userId}`,
          { token },
        );
        if (existingS?.[0]) {
          await api('PATCH', `/rest/v1/students?id=eq.${existingS[0].id}`, {
            token,
            body: {
              course_id: g.courseId,
              batch_id: batchId,
              application_id: appId,
              ...(g.gender ? { gender: g.gender } : {}),
            },
            prefer: 'return=minimal',
          });
        } else {
          await api('POST', '/rest/v1/students', {
            token,
            body: {
              profile_id: userId,
              course_id: g.courseId,
              batch_id: batchId,
              application_id: appId,
              enrollment_date: new Date().toISOString().slice(0, 10),
              ...(g.gender ? { gender: g.gender } : {}),
            },
            prefer: 'return=minimal',
          });
        }

        existingAppIds.add(appId);
        profileByEmail.set(email, { id: userId, email });
        created += 1;
        if (created % 10 === 0) console.log(`  …created ${created}`);
        await sleep(SIGNUP_DELAY_MS);
      } catch (err) {
        failed += 1;
        console.error(`  FAIL ${student.name} (${appId}): ${err.message}`);
        if (String(err.message).includes('rate limit') || err.status === 429) {
          console.log(`  Cooling down ${RATE_LIMIT_WAIT_MS / 1000}s…`);
          await sleep(RATE_LIMIT_WAIT_MS);
        }
      }
    }
  }

  console.log('\n=== DONE ===');
  console.log(`Created/updated: ${created}`);
  console.log(`Skipped (already exist / empty): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log('\nLogin rule: email = name@gmail.com (or name.id@gmail.com if duplicate)');
  console.log('Password = Application ID from sheet');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
