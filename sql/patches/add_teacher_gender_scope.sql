-- Teacher course assignment: also store who they teach (Male / Female / Both)
-- Run in Supabase SQL Editor

alter table public.teacher_courses
  add column if not exists gender_scope text;

-- NULL = class gender not chosen yet (teacher sees 0 students)
update public.teacher_courses
set gender_scope = 'Both'
where gender_scope is not null
  and btrim(gender_scope) <> ''
  and gender_scope not in ('Male', 'Female', 'Both');

alter table public.teacher_courses
  drop constraint if exists teacher_courses_gender_scope_check;

alter table public.teacher_courses
  add constraint teacher_courses_gender_scope_check
  check (gender_scope is null or gender_scope in ('Male', 'Female', 'Both'));

notify pgrst, 'reload schema';

-- Quick check
select t.id, p.full_name, c.name as course, tc.gender_scope
from public.teacher_courses tc
join public.teachers t on t.id = tc.teacher_id
join public.profiles p on p.id = t.profile_id
join public.courses c on c.id = tc.course_id
order by c.name, tc.gender_scope;
