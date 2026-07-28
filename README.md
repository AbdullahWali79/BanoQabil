# BanoQabil LMS

React + TypeScript + Vite learning management system for BanoQabil Educational Institute (Supabase backend).

## Quick start

```bash
npm install
npm run dev
```

## Project structure

```
src/           App source (features by role: admin, teacher, student, auth)
public/        Static assets (logo, favicons)
sql/           Database schema / migration SQL (run in Supabase SQL editor)
scripts/       One-off seed & data scripts (not part of the web app)
data/students/ Excel sheets used by seed scripts
supabase/      Edge functions
```

## Useful scripts

Run from the repo root:

```bash
node scripts/seed_students_from_sheets.mjs
node scripts/assign_teachers_from_sheets.mjs
node scripts/seed_courses_from_students.mjs
```

SQL files live in `sql/` — apply in order as needed when setting up a new database.
