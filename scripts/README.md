# Scripts

One-off Node scripts for seeding and teacher assignment. Not used by the Vite app at runtime.

| Script | Purpose |
|--------|---------|
| `seed_students_from_sheets.mjs` | Bulk-create students/batches from `data/students/*.xlsx` |
| `assign_teachers_from_sheets.mjs` | Set teacher course + gender_scope from sheets |
| `seed_courses_from_students.mjs` | Insert courses from sheet filenames |
| `seed_demo_users.mjs` | Demo Admin/Teacher/Student accounts |
| `seed_trainers_batch.mjs` | Batch-create trainer accounts |

Run from repo root, e.g. `node scripts/seed_students_from_sheets.mjs`.
