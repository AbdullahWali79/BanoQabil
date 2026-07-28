-- Assignment / submission access rules
-- Run in Supabase SQL Editor after existing LMS schema.
-- Goal: students submit for their own record; course teachers grade their assignments;
-- admin does NOT manage day-to-day assignment submission/grading.

-- Helper: current user's role name
create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.is_admin_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name(), '') in ('Admin', 'Super Admin');
$$;

create or replace function public.current_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.teachers t
  where t.profile_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.students s
  where s.profile_id = auth.uid()
  limit 1;
$$;

create or replace function public.teacher_owns_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    where a.id = p_assignment_id
      and (
        a.teacher_id = auth.uid()
        or a.teacher_id = public.current_teacher_id()
        or exists (
          select 1
          from public.batches b
          where b.id = a.batch_id
            and (
              b.teacher_id = auth.uid()
              or b.teacher_id = public.current_teacher_id()
            )
        )
      )
  );
$$;

-- ASSIGNMENTS ---------------------------------------------------------------
alter table public.assignments enable row level security;

drop policy if exists assignments_select_authenticated on public.assignments;
drop policy if exists assignments_insert_authenticated on public.assignments;
drop policy if exists assignments_update_authenticated on public.assignments;
drop policy if exists assignments_delete_authenticated on public.assignments;
drop policy if exists assignments_select_scoped on public.assignments;
drop policy if exists assignments_insert_teacher on public.assignments;
drop policy if exists assignments_update_teacher on public.assignments;
drop policy if exists assignments_delete_teacher on public.assignments;

-- Read: students see their batch; teachers see own; admins can monitor via reports only if needed
create policy assignments_select_scoped
on public.assignments for select to authenticated
using (
  public.is_admin_role()
  or public.teacher_owns_assignment(id)
  or batch_id in (
    select s.batch_id from public.students s where s.profile_id = auth.uid()
  )
);

create policy assignments_insert_teacher
on public.assignments for insert to authenticated
with check (
  public.current_role_name() = 'Teacher'
  and (
    teacher_id = auth.uid()
    or teacher_id = public.current_teacher_id()
  )
);

create policy assignments_update_teacher
on public.assignments for update to authenticated
using (
  public.current_role_name() = 'Teacher'
  and public.teacher_owns_assignment(id)
)
with check (
  public.current_role_name() = 'Teacher'
  and public.teacher_owns_assignment(id)
);

create policy assignments_delete_teacher
on public.assignments for delete to authenticated
using (
  public.current_role_name() = 'Teacher'
  and public.teacher_owns_assignment(id)
);

-- SUBMISSIONS ---------------------------------------------------------------
alter table public.submissions enable row level security;

drop policy if exists submissions_select_authenticated on public.submissions;
drop policy if exists submissions_insert_authenticated on public.submissions;
drop policy if exists submissions_update_authenticated on public.submissions;
drop policy if exists submissions_delete_authenticated on public.submissions;
drop policy if exists submissions_select_scoped on public.submissions;
drop policy if exists submissions_insert_student on public.submissions;
drop policy if exists submissions_update_student on public.submissions;
drop policy if exists submissions_update_teacher_grade on public.submissions;

create policy submissions_select_scoped
on public.submissions for select to authenticated
using (
  public.is_admin_role()
  or student_id = public.current_student_id()
  or public.teacher_owns_assignment(assignment_id)
);

-- Students may insert/update only their own non-admin submission rows
create policy submissions_insert_student
on public.submissions for insert to authenticated
with check (
  public.current_role_name() = 'Student'
  and student_id = public.current_student_id()
);

create policy submissions_update_student
on public.submissions for update to authenticated
using (
  public.current_role_name() = 'Student'
  and student_id = public.current_student_id()
  and coalesce(status, '') <> 'Graded'
  and marks is null
)
with check (
  public.current_role_name() = 'Student'
  and student_id = public.current_student_id()
);

-- Teachers grade submissions for their assignments only
create policy submissions_update_teacher_grade
on public.submissions for update to authenticated
using (
  public.current_role_name() = 'Teacher'
  and public.teacher_owns_assignment(assignment_id)
)
with check (
  public.current_role_name() = 'Teacher'
  and public.teacher_owns_assignment(assignment_id)
);
