-- Allow gender_scope to be NULL = class gender not chosen yet (teacher sees 0 students)
-- Run in Supabase SQL Editor if you already ran add_teacher_gender_scope.sql

alter table public.teacher_courses
  drop constraint if exists teacher_courses_gender_scope_check;

alter table public.teacher_courses
  alter column gender_scope drop not null;

alter table public.teacher_courses
  alter column gender_scope drop default;

alter table public.teacher_courses
  add constraint teacher_courses_gender_scope_check
  check (gender_scope is null or gender_scope in ('Male', 'Female', 'Both'));

notify pgrst, 'reload schema';
