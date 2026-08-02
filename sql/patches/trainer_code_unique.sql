-- ============================================================
-- Trainer Code unique (same idea as students.application_id)
-- Run in: Supabase → SQL Editor → Run
-- ============================================================

alter table public.teachers add column if not exists trainer_code text;
alter table public.teachers add column if not exists username text;

-- Clear empty strings so unique index is clean
update public.teachers
set trainer_code = null
where trainer_code is not null and btrim(trainer_code) = '';

update public.teachers
set username = null
where username is not null and btrim(username) = '';

create unique index if not exists teachers_trainer_code_unique
  on public.teachers (trainer_code)
  where trainer_code is not null and btrim(trainer_code) <> '';

create unique index if not exists teachers_username_unique
  on public.teachers (lower(btrim(username)))
  where username is not null and btrim(username) <> '';

select 'teachers trainer_code + username unique indexes ready' as message;
