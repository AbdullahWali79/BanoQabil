-- ============================================================
-- BanoQabil: optional demo Teacher / Student ONLY (no demo Admin)
-- ============================================================
-- Real accounts:
--   Super Admin: chief_thevehari@live.com / password123  → sql/ops/cleanup_demo_admins.sql
--   Admin:       abdullahwali79@gmail.com
--
-- Optional (if auth users already exist):
--   teacher123@gmail.com  /  password123
--   student123@gmail.com  /  Password123
-- ============================================================

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

insert into public.teachers (profile_id, specialization)
select p.id, 'Web Development'
from public.profiles p
where lower(p.email) = 'teacher123@gmail.com'
  and not exists (
    select 1 from public.teachers t where t.profile_id = p.id
  );

insert into public.students (profile_id, enrollment_date)
select p.id, current_date
from public.profiles p
where lower(p.email) = 'student123@gmail.com'
  and not exists (
    select 1 from public.students s where s.profile_id = p.id
  );

insert into public.courses (name, description)
select 'Web Development', 'HTML, CSS, JavaScript and modern frontend workflow'
where not exists (select 1 from public.courses c where c.name = 'Web Development');

insert into public.batches (course_id, name, timing, teacher_id)
select
  c.id,
  'WD-Batch-01',
  'Mon-Wed-Fri 7:00 PM',
  t.id
from public.courses c
left join public.profiles p on lower(p.email) = 'teacher123@gmail.com'
left join public.teachers t on t.profile_id = p.id
where c.name = 'Web Development'
  and not exists (select 1 from public.batches b where b.name = 'WD-Batch-01');

update public.students s
set batch_id = b.id
from public.profiles p
join public.batches b on b.name = 'WD-Batch-01'
where s.profile_id = p.id
  and lower(p.email) = 'student123@gmail.com';

select
  p.email,
  p.full_name,
  p.status,
  r.name as role_name
from public.profiles p
left join public.roles r on r.id = p.role_id
where lower(p.email) in ('teacher123@gmail.com', 'student123@gmail.com')
order by p.email;
