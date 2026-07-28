# SQL

Supabase schema / migration snippets. Apply in the SQL editor when needed.

Typical order for a fresh setup:

1. `fix_lms_schema.sql`
2. `fix_roles.sql` / `add_permissions_col.sql` / `fix_batches_teacher.sql`
3. `assign_teacher_courses.sql` / `extend_teachers_schema.sql`
4. `add_student_gender.sql`
5. `add_teacher_gender_scope.sql` → `allow_null_teacher_gender_scope.sql`
6. `teacher_attendance_notifications.sql`
7. Optional seed: `setup_demo_accounts.sql`, `dummy_lms_seed.sql`, `seed_trainers_fill.sql`
8. Assignment RLS (student submit / teacher grade): `assignment_submission_rls.sql`
