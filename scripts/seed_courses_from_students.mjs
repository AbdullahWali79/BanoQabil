/**
 * Add unique courses from data/students/*.xlsx filenames.
 * - Strips leading numbers
 * - Strips (Male)/(Female) — one course per subject only
 * - Merges CIT* into Computer Information & Technology
 * - Does not insert duplicates
 *
 * Run from repo root: node scripts/seed_courses_from_students.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'https://hlcxuhzbpugzzbwogfvg.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3h1aHpicHVnenpid29nZnZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTU3NzIsImV4cCI6MjEwMDYzMTc3Mn0.wBEhD14EhYOii0ze1KSOeg4fuuMCgXg_CRVf_NtoCeA';

const STUDENTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/students');

function normalizeCourseName(fileName) {
  let name = fileName.replace(/\.(xlsx|xls|csv)$/i, '');
  name = name.replace(/^\d+\s*/, '').trim();
  // Remove gender suffix from filename-based course titles
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

function collectUniqueCourseNames() {
  const files = fs.readdirSync(STUDENTS_DIR).filter((f) => /\.(xlsx|xls|csv)$/i.test(f));
  const unique = new Map();

  for (const file of files) {
    const courseName = normalizeCourseName(file);
    if (!courseName) continue;
    const key = courseName.toLowerCase();
    if (!unique.has(key)) unique.set(key, courseName);
  }

  return [...unique.values()].sort((a, b) => a.localeCompare(b));
}

async function api(method, pathName, { token, body, prefer } = {}) {
  const headers = {
    apikey: ANON,
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
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
    throw new Error(`${method} ${pathName} → ${res.status}: ${msg}`);
  }
  return data;
}

async function main() {
  const courseNames = collectUniqueCourseNames();
  console.log('=== Unique courses (no Male/Female split) ===');
  courseNames.forEach((n, i) => console.log(`${i + 1}. ${n}`));
  console.log('');

  const sa = await api('POST', '/auth/v1/token?grant_type=password', {
    body: { email: 'abdullahwali79@gmail.com', password: 'Abdullah123@' },
  });
  const token = sa.access_token;

  const existing = await api('GET', '/rest/v1/courses?select=id,name', { token });
  const existingMap = new Map(
    (existing || []).map((c) => [String(c.name || '').trim().toLowerCase(), c]),
  );

  let added = 0;
  let skipped = 0;

  for (const name of courseNames) {
    const key = name.toLowerCase();
    if (existingMap.has(key)) {
      console.log(`SKIP (exists): ${name}`);
      skipped += 1;
      continue;
    }

    const created = await api('POST', '/rest/v1/courses', {
      token,
      body: { name, description: `${name} course` },
      prefer: 'return=representation',
    });
    const row = Array.isArray(created) ? created[0] : created;
    console.log(`ADD: ${name} (${row?.id || 'ok'})`);
    existingMap.set(key, row);
    added += 1;
  }

  console.log('\n=== DONE ===');
  console.log(`Added: ${added}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total unique: ${courseNames.length}`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
