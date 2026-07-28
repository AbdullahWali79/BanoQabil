/**
 * Assign teacher courses + gender_scope from data/students/*.xlsx
 *
 * - Trainer named on sheet → that course + Male/Female/Both (Both if both genders in sheets)
 * - Teacher NOT in sheets → No Course
 * - Same course+overlapping gender not double-assigned
 *
 * Prerequisite: run sql/add_teacher_gender_scope.sql in Supabase
 * Run from repo root: node scripts/assign_teachers_from_sheets.mjs
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

const TRAINER_EMAIL_MAP = [
  { match: /zunaira/i, email: 'zunairat69@gmail.com' },
  { match: /ashmeera|ashmira/i, email: 'ashmiramajeed14@gmail.com' },
  { match: /qasim/i, email: 'qasimlibra28@gmail.com' },
  { match: /hafiz|naeem/i, email: 'hnaeemabbas1@gmail.com' },
  { match: /sajjad/i, email: 'sajjadkhanggg@gmail.com' },
  { match: /abdullah/i, email: 'abdullahwale@gmail.com' },
];

async function api(method, pathName, { token, body, prefer } = {}) {
  const headers = {
    apikey: ANON,
    Authorization: `Bearer ${token || ANON}`,
    'Content-Type': 'application/json',
  };
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
    throw new Error(`${method} ${pathName} → ${res.status}: ${data?.message || data?.msg || text}`);
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

function genderFromFile(file) {
  // Use word boundaries — "Female" must not match /male/
  if (/\(\s*female\s*\)/i.test(file) || /\bfemale\b/i.test(file)) return 'Female';
  if (/\(\s*male\s*\)/i.test(file) || /\bmale\b/i.test(file)) return 'Male';
  return null;
}

function parseTrainer(cell) {
  let t = String(cell || '')
    .replace(/Trainer/gi, '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .replace(/\(B-?\d+\)/i, '')
    .trim();
  if (!t || /^signature$/i.test(t)) return '';
  return t;
}

function resolveEmail(trainerLabel) {
  for (const row of TRAINER_EMAIL_MAP) {
    if (row.match.test(trainerLabel || '')) return row.email;
  }
  return null;
}

function mergeScope(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;
  return 'Both';
}

async function main() {
  console.log('=== Parse sheets ===');
  const files = fs.readdirSync(STUDENTS_DIR).filter((f) => /\.xlsx$/i.test(f));
  /** @type {Map<string, { course: string, scope: string, trainers: Set<string> }>} */
  const byEmail = new Map();

  for (const file of files) {
    const course = normalizeCourseName(file);
    const gender = genderFromFile(file) || 'Both';
    const wb = XLSX.readFile(path.join(STUDENTS_DIR, file));
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', header: 1 });
    let trainer = '';
    if (/cit\s*female/i.test(file)) trainer = 'Sajjad Khan';
    else trainer = parseTrainer(rows[1]?.[18] ?? rows[1]?.[rows[1].length - 1]);

    const email = resolveEmail(trainer);
    console.log(`${file} → ${course} | ${gender} | ${trainer || '(none)'} | ${email || 'NO EMAIL'}`);
    if (!email) continue;

    const prev = byEmail.get(email);
    if (!prev) {
      byEmail.set(email, { course, scope: gender, trainers: new Set([trainer]) });
    } else if (prev.course !== course) {
      console.warn(`WARN: ${email} has multiple courses (${prev.course} vs ${course}) — keeping ${prev.course}`);
    } else {
      prev.scope = mergeScope(prev.scope, gender);
      prev.trainers.add(trainer);
    }
  }

  console.log('\n=== Plan ===');
  for (const [email, plan] of byEmail) {
    console.log(`  ${email} → ${plan.course} (${plan.scope})`);
  }

  const sa = await api('POST', '/auth/v1/token?grant_type=password', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = sa.access_token;

  const courses = await api('GET', '/rest/v1/courses?select=id,name', { token });
  const courseByName = new Map(courses.map((c) => [String(c.name).toLowerCase(), c]));

  const teachers = await api(
    'GET',
    '/rest/v1/teachers?select=id,profiles!inner(email,full_name)',
    { token },
  );
  const teacherByEmail = new Map(
    teachers.map((t) => [String(t.profiles?.email || '').toLowerCase(), t]),
  );

  console.log('\n=== Clear all teacher_courses ===');
  for (const t of teachers) {
    await api('DELETE', `/rest/v1/teacher_courses?teacher_id=eq.${t.id}`, {
      token,
      prefer: 'return=minimal',
    });
  }

  console.log('\n=== Apply sheet assignments ===');
  for (const [email, plan] of byEmail) {
    const teacher = teacherByEmail.get(email.toLowerCase());
    const course = courseByName.get(plan.course.toLowerCase());
    if (!teacher) {
      console.warn(`SKIP missing teacher: ${email}`);
      continue;
    }
    if (!course) {
      console.warn(`SKIP missing course: ${plan.course}`);
      continue;
    }
    try {
      await api('POST', '/rest/v1/teacher_courses', {
        token,
        body: {
          teacher_id: teacher.id,
          course_id: course.id,
          gender_scope: plan.scope,
        },
        prefer: 'return=minimal',
      });
      console.log(`OK ${teacher.profiles.full_name} → ${plan.course} (${plan.scope})`);
    } catch (err) {
      if (/gender_scope/i.test(err.message)) {
        console.error('gender_scope column missing — inserting course only. Run add_teacher_gender_scope.sql then re-run.');
        await api('POST', '/rest/v1/teacher_courses', {
          token,
          body: { teacher_id: teacher.id, course_id: course.id },
          prefer: 'return=minimal',
        });
        console.log(`OK (no scope yet) ${teacher.profiles.full_name} → ${plan.course}`);
      } else {
        console.error(`FAIL ${email}: ${err.message}`);
        process.exit(1);
      }
    }
  }

  const unnamed = teachers.filter((t) => !byEmail.has(String(t.profiles?.email || '').toLowerCase()));
  console.log('\n=== No Course (not in sheets) ===');
  for (const t of unnamed) {
    console.log(`  ${t.profiles.full_name} <${t.profiles.email}>`);
  }

  console.log('\nDONE');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
