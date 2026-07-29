-- ============================================================
-- Teacher ↔ Course: ONE course per teacher (round-robin)
-- Students are NOT inserted/modified (except optional course_id column)
-- Run in Supabase SQL Editor
-- ============================================================

-- Optional column for future student course preference (no student rows touched)
alter table public.students
  add column if not exists course_id uuid references public.courses(id) on delete set null;

create index if not exists idx_students_course_id on public.students(course_id);

-- Junction table
create table if not exists public.teacher_courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, course_id)
);

create index if not exists idx_teacher_courses_teacher on public.teacher_courses(teacher_id);
create index if not exists idx_teacher_courses_course on public.teacher_courses(course_id);

alter table public.teacher_courses enable row level security;

drop policy if exists teacher_courses_select_authenticated on public.teacher_courses;
create policy teacher_courses_select_authenticated
on public.teacher_courses for select to authenticated
using (true);

drop policy if exists teacher_courses_write_authenticated on public.teacher_courses;
create policy teacher_courses_write_authenticated
on public.teacher_courses for all to authenticated
using (true)
with check (true);

-- 1) CLEAR old multi-course rows FIRST (fixes duplicate teacher_id error)
delete from public.teacher_courses;

-- 2) Now safe to enforce: one teacher → one course
drop index if exists teacher_courses_one_per_teacher;
create unique index teacher_courses_one_per_teacher
  on public.teacher_courses (teacher_id);

-- 3) Assign ONE course per teacher (round-robin for remaining teachers)
insert into public.teacher_courses (teacher_id, course_id)
select
  t.id as teacher_id,
  c.id as course_id
from (
  select
    id,
    (row_number() over (order by id) - 1) as rn
  from public.teachers
) t
cross join lateral (
  select id
  from (
    select
      id,
      (row_number() over (order by name, id) - 1) as rn,
      count(*) over () as total
    from public.courses
  ) courses_ranked
  where courses_ranked.rn = mod(t.rn, courses_ranked.total)
) c
where exists (select 1 from public.courses limit 1);

notify pgrst, 'reload schema';

-- Signup page needs to read courses/roles
drop policy if exists courses_select_anon on public.courses;
create policy courses_select_anon
on public.courses for select to anon
using (true);

drop policy if exists roles_select_anon on public.roles;
create policy roles_select_anon
on public.roles for select to anon
using (true);

-- Verify teachers only
select
  p.full_name as teacher,
  c.name as assigned_course
from public.teachers t
join public.profiles p on p.id = t.profile_id
left join public.teacher_courses tc on tc.teacher_id = t.id
left join public.courses c on c.id = tc.course_id
order by p.full_name;

select
  c.name as course,
  count(tc.teacher_id) as teachers_count
from public.courses c
left join public.teacher_courses tc on tc.course_id = c.id
group by c.name
order by c.name;
