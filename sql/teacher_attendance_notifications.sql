-- ============================================================
-- Teacher Attendance + Notifications + batches.teacher_id
-- Safe re-run for broken/old tables
-- Run in Supabase SQL Editor
-- ============================================================

alter table public.batches
  add column if not exists teacher_id uuid references public.teachers(id) on delete set null;

create index if not exists idx_batches_teacher_id on public.batches(teacher_id);

alter table public.students
  add column if not exists course_id uuid references public.courses(id) on delete set null;

-- ---------- Attendance (recreate clean) ----------
drop table if exists public.attendance cascade;

create table public.attendance (
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

create index idx_attendance_student on public.attendance(student_id);
create index idx_attendance_date on public.attendance(attendance_date);
create index idx_attendance_teacher on public.attendance(teacher_id);

alter table public.attendance enable row level security;

drop policy if exists attendance_select_authenticated on public.attendance;
create policy attendance_select_authenticated
on public.attendance for select to authenticated
using (true);

drop policy if exists attendance_write_authenticated on public.attendance;
create policy attendance_write_authenticated
on public.attendance for all to authenticated
using (true)
with check (true);

-- ---------- Notifications (recreate clean — old table lacked recipient_id) ----------
drop table if exists public.notifications cascade;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_recipient on public.notifications(recipient_id);
create index idx_notifications_sender on public.notifications(sender_id);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_authenticated on public.notifications;
create policy notifications_select_authenticated
on public.notifications for select to authenticated
using (true);

drop policy if exists notifications_write_authenticated on public.notifications;
create policy notifications_write_authenticated
on public.notifications for all to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';

-- Verify
select 'attendance' as tbl, string_agg(column_name, ', ' order by ordinal_position) as columns
from information_schema.columns
where table_schema = 'public' and table_name = 'attendance'
union all
select 'notifications', string_agg(column_name, ', ' order by ordinal_position)
from information_schema.columns
where table_schema = 'public' and table_name = 'notifications';
