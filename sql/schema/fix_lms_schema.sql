-- ============================================================
-- BanoQabil LMS schema fix
-- Run in: Supabase Dashboard → SQL Editor → Run
-- Fixes:
--   1) assignments.status (and other missing assignment columns)
--   2) public.submissions table (missing from schema cache)
--   3) basic RLS so Admin / Teacher / Student tabs can work
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1) Ensure core tables exist (safe if already present)
-- ------------------------------------------------------------
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  status text not null default 'Pending',
  full_name text,
  email text,
  phone text,
  address text,
  avatar_url text,
  permissions jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  specialization text,
  created_at timestamptz not null default now(),
  unique (profile_id)
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete set null,
  name text not null,
  timing text,
  teacher_id uuid references public.teachers(id) on delete set null,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  father_name text,
  application_id text,
  enrollment_date date,
  created_at timestamptz not null default now(),
  unique (profile_id)
);

-- Unique Application IDs (password / lookup key). See also sql/application_id_unique.sql
create unique index if not exists students_application_id_unique
  on public.students (lower(btrim(application_id)))
  where application_id is not null and btrim(application_id) <> '';

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete cascade,
  teacher_id uuid,
  title text not null,
  description text,
  due_date timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2) Add missing columns on assignments
-- ------------------------------------------------------------
alter table public.assignments
  add column if not exists status text;

alter table public.assignments
  add column if not exists pdf_url text;

alter table public.assignments
  add column if not exists description text;

alter table public.assignments
  add column if not exists due_date timestamptz;

alter table public.assignments
  add column if not exists batch_id uuid;

alter table public.assignments
  add column if not exists teacher_id uuid;

alter table public.assignments
  add column if not exists title text;

alter table public.assignments
  add column if not exists created_at timestamptz default now();

-- Default existing/null statuses so UI filters work
update public.assignments
set status = 'Open'
where status is null or btrim(status) = '';

alter table public.assignments
  alter column status set default 'Open';

-- Optional check constraint (drop first if re-running)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assignments_status_check'
  ) then
    alter table public.assignments
      add constraint assignments_status_check
      check (status in ('Open', 'Closed'));
  end if;
exception
  when others then
    -- Ignore if existing bad values prevent constraint; column still exists
    raise notice 'assignments_status_check skipped: %', sqlerrm;
end $$;

-- ------------------------------------------------------------
-- 3) Create submissions table (app uses public.submissions)
-- ------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  youtube_url text,
  drive_url text,
  status text not null default 'Submitted',
  marks numeric,
  remarks text,
  submitted_at timestamptz,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

-- In case table existed with fewer columns, add any missing ones
alter table public.submissions add column if not exists youtube_url text;
alter table public.submissions add column if not exists drive_url text;
alter table public.submissions add column if not exists status text;
alter table public.submissions add column if not exists marks numeric;
alter table public.submissions add column if not exists remarks text;
alter table public.submissions add column if not exists submitted_at timestamptz;
alter table public.submissions add column if not exists graded_at timestamptz;
alter table public.submissions add column if not exists created_at timestamptz default now();
alter table public.submissions add column if not exists assignment_id uuid;
alter table public.submissions add column if not exists student_id uuid;

update public.submissions
set status = 'Submitted'
where status is null or btrim(status) = '';

alter table public.submissions
  alter column status set default 'Submitted';

-- Helpful indexes
create index if not exists idx_assignments_batch_id on public.assignments(batch_id);
create index if not exists idx_assignments_teacher_id on public.assignments(teacher_id);
create index if not exists idx_assignments_status on public.assignments(status);
create index if not exists idx_submissions_assignment_id on public.submissions(assignment_id);
create index if not exists idx_submissions_student_id on public.submissions(student_id);

-- ------------------------------------------------------------
-- 4) Enable RLS
-- ------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.batches enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

-- ------------------------------------------------------------
-- 5) Policies (drop + recreate for idempotency)
-- Keep simple authenticated access so LMS tabs work in this project.
-- Tighten later if needed.
-- ------------------------------------------------------------

-- roles
drop policy if exists roles_select_authenticated on public.roles;
create policy roles_select_authenticated
on public.roles for select to authenticated
using (true);

-- profiles
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
on public.profiles for select to authenticated
using (true);

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
on public.profiles for update to authenticated
using (
  id = auth.uid()
  or public.current_role_name() in ('Admin', 'Super Admin')
)
with check (
  id = auth.uid()
  or (
    public.current_role_name() in ('Admin', 'Super Admin')
    and (
      -- Super Admin can update anything
      public.current_role_name() = 'Super Admin'
      or (
        -- For teacher profiles: allow Admin updates only when status does NOT change
        -- (or admin sets it back to Pending).
        not exists (
          select 1
          from public.roles r
          where r.id = role_id and r.name = 'Teacher'
        )
        or status is not distinct from (
          select p_old.status
          from public.profiles p_old
          where p_old.id = profiles.id
        )
        or status = 'Pending'
      )
    )
  )
);

drop policy if exists profiles_insert_authenticated on public.profiles;
create policy profiles_insert_authenticated
on public.profiles for insert to authenticated
with check (
  id = auth.uid()
  or (
    public.current_role_name() in ('Admin', 'Super Admin')
    and (
      public.current_role_name() = 'Super Admin'
      or not (
        exists (
          select 1
          from public.roles r
          where r.id = role_id and r.name = 'Teacher'
        )
        and status is distinct from 'Pending'
      )
    )
  )
);

-- courses
drop policy if exists courses_select_authenticated on public.courses;
create policy courses_select_authenticated
on public.courses for select to authenticated
using (true);

drop policy if exists courses_write_authenticated on public.courses;
create policy courses_write_authenticated
on public.courses for all to authenticated
using (true)
with check (true);

-- batches
drop policy if exists batches_select_authenticated on public.batches;
create policy batches_select_authenticated
on public.batches for select to authenticated
using (true);

drop policy if exists batches_write_authenticated on public.batches;
create policy batches_write_authenticated
on public.batches for all to authenticated
using (true)
with check (true);

-- teachers
drop policy if exists teachers_select_authenticated on public.teachers;
create policy teachers_select_authenticated
on public.teachers for select to authenticated
using (true);

drop policy if exists teachers_write_authenticated on public.teachers;
create policy teachers_write_authenticated
on public.teachers for all to authenticated
using (true)
with check (true);

-- students
drop policy if exists students_select_authenticated on public.students;
create policy students_select_authenticated
on public.students for select to authenticated
using (true);

drop policy if exists students_write_authenticated on public.students;
create policy students_write_authenticated
on public.students for all to authenticated
using (true)
with check (true);

-- assignments
drop policy if exists assignments_select_authenticated on public.assignments;
create policy assignments_select_authenticated
on public.assignments for select to authenticated
using (true);

drop policy if exists assignments_write_authenticated on public.assignments;
create policy assignments_write_authenticated
on public.assignments for all to authenticated
using (true)
with check (true);

-- submissions
drop policy if exists submissions_select_authenticated on public.submissions;
create policy submissions_select_authenticated
on public.submissions for select to authenticated
using (true);

drop policy if exists submissions_write_authenticated on public.submissions;
create policy submissions_write_authenticated
on public.submissions for all to authenticated
using (true)
with check (true);

-- ------------------------------------------------------------
-- 5b) Teacher ↔ Course + student preferred course
-- ------------------------------------------------------------
alter table public.students
  add column if not exists course_id uuid references public.courses(id) on delete set null;

create index if not exists idx_students_course_id on public.students(course_id);

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

drop policy if exists courses_select_anon on public.courses;
create policy courses_select_anon
on public.courses for select to anon
using (true);

drop policy if exists roles_select_anon on public.roles;
create policy roles_select_anon
on public.roles for select to anon
using (true);

-- Reset FIRST (avoid unique index failure on duplicates), then one-per-teacher
delete from public.teacher_courses;

drop index if exists teacher_courses_one_per_teacher;
create unique index teacher_courses_one_per_teacher
  on public.teacher_courses (teacher_id);

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

-- Attendance + notifications (teacher tools)
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete set null,
  batch_id uuid references public.batches(id) on delete set null,
  attendance_date date not null default (current_date),
  status text not null default 'Present'
    check (status in ('Present', 'Absent', 'Late', 'Excused')),
  notes text,
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

alter table public.attendance enable row level security;
drop policy if exists attendance_select_authenticated on public.attendance;
create policy attendance_select_authenticated on public.attendance for select to authenticated using (true);
drop policy if exists attendance_write_authenticated on public.attendance;
create policy attendance_write_authenticated on public.attendance for all to authenticated using (true) with check (true);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
drop policy if exists notifications_select_authenticated on public.notifications;
create policy notifications_select_authenticated on public.notifications for select to authenticated using (true);
drop policy if exists notifications_write_authenticated on public.notifications;
create policy notifications_write_authenticated on public.notifications for all to authenticated using (true) with check (true);

alter table public.batches
  add column if not exists teacher_id uuid references public.teachers(id) on delete set null;

-- ------------------------------------------------------------
-- 6) Reload PostgREST schema cache
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 7) Verify
-- ------------------------------------------------------------
select
  'assignments.status' as check_item,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assignments'
      and column_name = 'status'
  ) as ok
union all
select
  'public.submissions table',
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'submissions'
  );

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('assignments', 'submissions')
order by table_name, ordinal_position;
