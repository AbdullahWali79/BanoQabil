-- ============================================================
-- BanoQabil: complete demo Admin / Teacher / Student setup
-- Run in Supabase Dashboard → SQL Editor → Run
-- ============================================================
-- CURRENT WORKING LOGINS (as of seed):
--   student123@gmail.com  /  Password123
--   teacher123@gmail.com  /  password123   ← note lowercase 'p'
--   admin123@gmail.com    → set password in Auth → Users if login fails
--
-- This SQL adds/repairs profiles, roles, teachers/students rows, sample batch.
-- ============================================================

-- 1) Ensure roles exist
insert into public.roles (name)
select 'Super Admin'
where not exists (select 1 from public.roles where name = 'Super Admin');

insert into public.roles (name)
select 'Admin'
where not exists (select 1 from public.roles where name = 'Admin');

insert into public.roles (name)
select 'Teacher'
where not exists (select 1 from public.roles where name = 'Teacher');

insert into public.roles (name)
select 'Student'
where not exists (select 1 from public.roles where name = 'Student');

-- 2) Ensure profiles exist for auth users (if auth users already created)
insert into public.profiles (id, email, full_name, status, role_id)
select u.id, u.email, 'Demo Admin', 'Approved', r.id
from auth.users u
cross join public.roles r
where u.email = 'admin123@gmail.com'
  and r.name = 'Admin'
  and not exists (select 1 from public.profiles p where p.id = u.id);

insert into public.profiles (id, email, full_name, status, role_id)
select u.id, u.email, 'Demo Teacher', 'Approved', r.id
from auth.users u
cross join public.roles r
where u.email = 'teacher123@gmail.com'
  and r.name = 'Teacher'
  and not exists (select 1 from public.profiles p where p.id = u.id);

insert into public.profiles (id, email, full_name, status, role_id)
select u.id, u.email, 'Demo Student', 'Approved', r.id
from auth.users u
cross join public.roles r
where u.email = 'student123@gmail.com'
  and r.name = 'Student'
  and not exists (select 1 from public.profiles p where p.id = u.id);

-- 3) Approve + assign roles (Approved)
update public.profiles p
set
  full_name = 'Demo Admin',
  status = 'Approved',
  role_id = r.id,
  email = coalesce(p.email, 'admin123@gmail.com')
from public.roles r
where lower(p.email) = 'admin123@gmail.com'
  and r.name = 'Admin';

update public.profiles p
set
  full_name = 'Demo Teacher',
  status = 'Approved',
  role_id = r.id,
  email = coalesce(p.email, 'teacher123@gmail.com')
from public.roles r
where lower(p.email) = 'teacher123@gmail.com'
  and r.name = 'Teacher';

update public.profiles p
set
  full_name = 'Demo Student',
  status = 'Approved',
  role_id = r.id,
  email = coalesce(p.email, 'student123@gmail.com')
from public.roles r
where lower(p.email) = 'student123@gmail.com'
  and r.name = 'Student';

-- Also map by auth.users id if email on profile is missing/wrong
update public.profiles p
set
  full_name = 'Demo Teacher',
  status = 'Approved',
  role_id = r.id,
  email = 'teacher123@gmail.com'
from auth.users u
join public.roles r on r.name = 'Teacher'
where p.id = u.id
  and lower(u.email) = 'teacher123@gmail.com';

update public.profiles p
set
  full_name = 'Demo Student',
  status = 'Approved',
  role_id = r.id,
  email = 'student123@gmail.com'
from auth.users u
join public.roles r on r.name = 'Student'
where p.id = u.id
  and lower(u.email) = 'student123@gmail.com';

update public.profiles p
set
  full_name = 'Demo Admin',
  status = 'Approved',
  role_id = r.id,
  email = 'admin123@gmail.com'
from auth.users u
join public.roles r on r.name = 'Admin'
where p.id = u.id
  and lower(u.email) = 'admin123@gmail.com';

-- 4) Teacher row
insert into public.teachers (profile_id, specialization)
select p.id, 'Web Development'
from public.profiles p
where lower(p.email) = 'teacher123@gmail.com'
  and not exists (
    select 1 from public.teachers t where t.profile_id = p.id
  );

-- 5) Student row
insert into public.students (profile_id, enrollment_date)
select p.id, current_date
from public.profiles p
where lower(p.email) = 'student123@gmail.com'
  and not exists (
    select 1 from public.students s where s.profile_id = p.id
  );

-- 6) Sample course + batch (optional, for student setup)
insert into public.courses (name, description)
select 'Web Development', 'HTML, CSS, JavaScript and modern frontend workflow'
where not exists (select 1 from public.courses c where c.name = 'Web Development');

insert into public.batches (course_id, name, timing, start_date, end_date, teacher_id)
select
  c.id,
  'WD-Batch-01',
  'Mon-Wed-Fri 7:00 PM',
  '2026-08-01'::date,
  '2026-11-01'::date,
  t.id
from public.courses c
left join public.profiles p on lower(p.email) = 'teacher123@gmail.com'
left join public.teachers t on t.profile_id = p.id
where c.name = 'Web Development'
  and not exists (select 1 from public.batches b where b.name = 'WD-Batch-01');

-- Attach student to batch
update public.students s
set batch_id = b.id
from public.profiles p
join public.batches b on b.name = 'WD-Batch-01'
where s.profile_id = p.id
  and lower(p.email) = 'student123@gmail.com';

-- 7) Verify
select
  p.email,
  p.full_name,
  p.status,
  r.name as role_name,
  exists(select 1 from public.teachers t where t.profile_id = p.id) as has_teacher_row,
  exists(select 1 from public.students s where s.profile_id = p.id) as has_student_row
from public.profiles p
left join public.roles r on r.id = p.role_id
where lower(p.email) in (
  'admin123@gmail.com',
  'teacher123@gmail.com',
  'student123@gmail.com'
)
order by p.email;
