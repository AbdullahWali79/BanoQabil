-- ============================================================
-- Extend teachers table + fill Ashmira Majeed complete record
-- Run in Supabase SQL Editor (one shot)
-- ============================================================

alter table public.teachers add column if not exists username text;
alter table public.teachers add column if not exists cnic text;
alter table public.teachers add column if not exists province text;
alter table public.teachers add column if not exists region text;
alter table public.teachers add column if not exists district text;
alter table public.teachers add column if not exists city text;
alter table public.teachers add column if not exists experience text;
alter table public.teachers add column if not exists address text;
alter table public.teachers add column if not exists trainer_code text;

create unique index if not exists teachers_username_unique
  on public.teachers (username)
  where username is not null and btrim(username) <> '';

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists address text;

insert into public.roles (name)
select 'Teacher'
where not exists (select 1 from public.roles where name = 'Teacher');

-- Approve Ashmira profile
update public.profiles p
set
  full_name = 'Ashmira Majeed',
  email = 'ashmiramajeed14@gmail.com',
  phone = '03018980222',
  address = 'House No. 4A, Opposite Fauji Foundation School, Canal View',
  status = 'Approved',
  role_id = r.id
from public.roles r
where lower(p.email) = 'ashmiramajeed14@gmail.com'
  and r.name = 'Teacher';

update public.profiles p
set
  full_name = 'Ashmira Majeed',
  email = 'ashmiramajeed14@gmail.com',
  phone = '03018980222',
  address = 'House No. 4A, Opposite Fauji Foundation School, Canal View',
  status = 'Approved',
  role_id = r.id
from auth.users u
join public.roles r on r.name = 'Teacher'
where p.id = u.id
  and lower(u.email) = 'ashmiramajeed14@gmail.com';

-- Ensure teachers row exists
insert into public.teachers (profile_id, specialization)
select p.id, 'Trainer'
from public.profiles p
where lower(p.email) = 'ashmiramajeed14@gmail.com'
  and not exists (select 1 from public.teachers t where t.profile_id = p.id);

-- Fill ALL trainer fields
update public.teachers t
set
  username = 'ashmira.majeed',
  cnic = '3660273084452',
  province = 'Punjab',
  region = 'South Punjab',
  district = 'Vehari',
  city = 'Vehari',
  experience = '6 Years',
  address = 'House No. 4A, Opposite Fauji Foundation School, Canal View',
  trainer_code = '554',
  specialization = 'Trainer'
from public.profiles p
where t.profile_id = p.id
  and lower(p.email) = 'ashmiramajeed14@gmail.com';

notify pgrst, 'reload schema';

-- Verify complete record
select
  p.full_name,
  p.email,
  p.phone,
  p.status,
  r.name as role_name,
  t.username,
  t.cnic,
  t.province,
  t.region,
  t.district,
  t.city,
  t.experience,
  t.address,
  t.trainer_code,
  t.specialization,
  t.id as teacher_id,
  p.id as profile_id
from public.profiles p
join public.roles r on r.id = p.role_id
left join public.teachers t on t.profile_id = p.id
where lower(p.email) = 'ashmiramajeed14@gmail.com';
