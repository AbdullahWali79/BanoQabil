-- Dummy LMS seed script (run in Supabase SQL Editor)
-- Creates test courses, batches, and links demo teacher/student profiles.

-- 1) Ensure core roles exist
insert into public.roles (name)
select 'Admin'
where not exists (select 1 from public.roles where name = 'Admin');

insert into public.roles (name)
select 'Teacher'
where not exists (select 1 from public.roles where name = 'Teacher');

insert into public.roles (name)
select 'Student'
where not exists (select 1 from public.roles where name = 'Student');

-- 2) Approve and assign role to demo users if they exist
update public.profiles p
set role_id = r.id, status = 'Approved'
from public.roles r
where p.email = 'admin123@gmail.com' and r.name = 'Admin';

update public.profiles p
set role_id = r.id, status = 'Approved'
from public.roles r
where p.email = 'teacher123@gmail.com' and r.name = 'Teacher';

update public.profiles p
set role_id = r.id, status = 'Approved'
from public.roles r
where p.email = 'student123@gmail.com' and r.name = 'Student';

-- 3) Ensure teacher/student rows exist
insert into public.teachers (profile_id, specialization)
select p.id, 'Web Development'
from public.profiles p
where p.email = 'teacher123@gmail.com'
  and not exists (select 1 from public.teachers t where t.profile_id = p.id);

insert into public.students (profile_id, enrollment_date)
select p.id, now()::date
from public.profiles p
where p.email = 'student123@gmail.com'
  and not exists (select 1 from public.students s where s.profile_id = p.id);

-- 4) Insert sample courses
insert into public.courses (name, description)
select v.name, v.description
from (
  values
    ('Web Development', 'HTML, CSS, JavaScript and modern frontend workflow'),
    ('Python Programming', 'Core Python for automation and backend basics')
) as v(name, description)
where not exists (select 1 from public.courses c where c.name = v.name);

-- 5) Insert sample batches (generic insert; if schema differs, insert manually)
insert into public.batches (course_id, name, timing, start_date, end_date)
select c.id, v.batch_name, v.timing, v.start_date::date, v.end_date::date
from (
  values
    ('Web Development', 'WD-Batch-01', 'Mon-Wed-Fri 7:00 PM', '2026-08-01', '2026-11-01'),
    ('Python Programming', 'PY-Batch-01', 'Tue-Thu-Sat 7:00 PM', '2026-08-05', '2026-11-05')
) as v(course_name, batch_name, timing, start_date, end_date)
join public.courses c on c.name = v.course_name
where not exists (select 1 from public.batches b where b.name = v.batch_name);

-- 6) Link demo student to first web batch
update public.students s
set batch_id = b.id
from public.profiles p
join public.batches b on b.name = 'WD-Batch-01'
where p.id = s.profile_id
  and p.email = 'student123@gmail.com';
