# SQL (Supabase)

Run scripts in **Supabase → SQL Editor** when needed.  
Do **not** delete these files — they are the source of truth for schema and one-off ops.

## Folders

| Folder | Purpose |
|--------|---------|
| `schema/` | Core tables / features (LMS, staff pay, student fees) |
| `patches/` | Incremental alters, RLS, constraints |
| `seeds/` | Demo / trainer seed data (optional) |
| `ops/` | One-off admin setup / cleanup (run carefully) |

## Fresh database (typical order)

1. `schema/fix_lms_schema.sql`
2. Patches (as needed):
   - `patches/fix_roles.sql`
   - `patches/add_permissions_col.sql`
   - `patches/fix_batches_teacher.sql`
   - `patches/assign_teacher_courses.sql`
   - `patches/extend_teachers_schema.sql`
   - `patches/add_student_gender.sql`
   - `patches/add_teacher_gender_scope.sql` → `patches/allow_null_teacher_gender_scope.sql`
   - `patches/teacher_attendance_notifications.sql`
   - `patches/assignment_submission_rls.sql`
   - `patches/application_id_unique.sql`
   - `patches/teacher_approval_super_admin_only.sql`
   - `patches/fix_rls_subquery_id.sql` (fixes teacher add: subquery id bug)
3. Feature schemas:
   - `schema/staff_pay_schema.sql`
   - `schema/student_fee_schema.sql` (includes `is_free` on courses)
4. Ops (production lock / cleanup):
   - `ops/setup_super_admin.sql`
   - `ops/cleanup_demo_admins.sql` (only if cleaning demo admins)
5. Optional seeds: `seeds/setup_demo_accounts.sql`, `seeds/dummy_lms_seed.sql`, `seeds/seed_trainers_fill.sql`

## Notes

- Re-running `schema/*` scripts is designed to be mostly idempotent (`if not exists` / `drop policy if exists`).
- Student Excel imports live in `data/students/` (used by `scripts/seed_students_from_sheets.mjs`).
