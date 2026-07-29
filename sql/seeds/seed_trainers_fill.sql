-- ============================================================
-- Fill complete trainer fields for batch-seeded teachers
-- Run AFTER or AFTER seed_trainers_batch.mjs (columns must exist)
-- Prefer: 1) extend_teachers_schema.sql  2) node seed_trainers_batch.mjs  3) this file
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

notify pgrst, 'reload schema';

-- Helper: update teacher extras by email
-- Hafiz Muhammad Naeem
update public.profiles p
set full_name='Hafiz Muhammad Naeem', phone='03044342966',
    address='House No. 67, Model Town Vehari', status='Approved',
    role_id = r.id
from public.roles r
where lower(p.email)='hnaeemabbas1@gmail.com' and r.name='Teacher';

update public.teachers t set
  username='hafiznaeem', cnic='3660301685523', province='Punjab', region='South Punjab',
  district='Vehari', city='Vehari', experience='5 Years',
  address='House No. 67, Model Town Vehari', trainer_code='524', specialization='Trainer'
from public.profiles p where t.profile_id=p.id and lower(p.email)='hnaeemabbas1@gmail.com';

-- Muhammad Abdullah
update public.profiles p
set full_name='Muhammad Abdullah', phone='03046983794',
    address='House No. 23, Street No. 2, Al-Jannat Colony, Vehari', status='Approved',
    role_id = r.id
from public.roles r
where lower(p.email)='abdullahwale@gmail.com' and r.name='Teacher';

update public.teachers t set
  username='m.abdullah', cnic='3660303415627', province='Punjab', region='South Punjab',
  district='Vehari', city='Vehari', experience='9 Years',
  address='House No. 23, Street No. 2, Al-Jannat Colony, Vehari', trainer_code='541', specialization='Trainer'
from public.profiles p where t.profile_id=p.id and lower(p.email)='abdullahwale@gmail.com';

-- Qasim Nazir
update public.profiles p
set full_name='Qasim Nazir', phone='03145250544',
    address='Majeed Town, Vehari', status='Approved',
    role_id = r.id
from public.roles r
where lower(p.email)='qasimlibra28@gmail.com' and r.name='Teacher';

update public.teachers t set
  username='qasim.nazir', cnic='3320386059249', province='Punjab', region='South Punjab',
  district='Vehari', city='Vehari', experience='10 Years',
  address='Majeed Town, Vehari', trainer_code='548', specialization='Trainer'
from public.profiles p where t.profile_id=p.id and lower(p.email)='qasimlibra28@gmail.com';

-- Zunaira Tariq
update public.profiles p
set full_name='Zunaira Tariq', phone='03014249810',
    address='Chak No. 9/WB, House No. 67, Model Town, Vehari', status='Approved',
    role_id = r.id
from public.roles r
where lower(p.email)='zunairat69@gmail.com' and r.name='Teacher';

update public.teachers t set
  username='ZunairaTariq', cnic='3660396962362', province='Punjab', region='South Punjab',
  district='Vehari', city='Vehari', experience='5 Years',
  address='Chak No. 9/WB, House No. 67, Model Town, Vehari', trainer_code='532', specialization='Trainer'
from public.profiles p where t.profile_id=p.id and lower(p.email)='zunairat69@gmail.com';

-- Sajjad Khan
update public.profiles p
set full_name='Sajjad Khan', phone='03366896492',
    address='U-Block, Peoples Colony, Vehari', status='Approved',
    role_id = r.id
from public.roles r
where lower(p.email)='sajjadkhanggg@gmail.com' and r.name='Teacher';

update public.teachers t set
  username='sajjad.khan', cnic='3840236234451', province='Punjab', region='South Punjab',
  district='Vehari', city='Vehari', experience='4 Years',
  address='U-Block, Peoples Colony, Vehari', trainer_code='CIT', specialization='CIT'
from public.profiles p where t.profile_id=p.id and lower(p.email)='sajjadkhanggg@gmail.com';

-- Verify
select p.full_name, p.email, p.phone, p.status, t.username, t.cnic, t.city, t.trainer_code, t.experience
from public.profiles p
left join public.teachers t on t.profile_id = p.id
where lower(p.email) in (
  'hnaeemabbas1@gmail.com',
  'abdullahwale@gmail.com',
  'qasimlibra28@gmail.com',
  'zunairat69@gmail.com',
  'sajjadkhanggg@gmail.com',
  'ashmiramajeed14@gmail.com'
)
order by p.full_name;
