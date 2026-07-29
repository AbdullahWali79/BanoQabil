-- ============================================================
-- Student Fee Management (Admin + Super Admin)
-- Course-based initial_fee + monthly_fee
-- Payment ledger: student_fee_payments
--
-- Run in: Supabase → SQL Editor → Run
-- ============================================================

create extension if not exists "pgcrypto";

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

alter table public.courses
  add column if not exists initial_fee numeric(12, 2) not null default 0;

alter table public.courses
  add column if not exists monthly_fee numeric(12, 2) not null default 0;

alter table public.courses
  add column if not exists is_free boolean not null default false;

create table if not exists public.student_fee_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  payment_type text not null
    check (payment_type in ('Initial', 'Monthly', 'Adjustment')),
  year int check (year is null or (year between 2000 and 2100)),
  month int check (month is null or (month between 1 and 12)),
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  status text not null default 'Paid'
    check (status in ('Pending', 'Paid', 'Waived')),
  paid_at timestamptz,
  recorded_by uuid references public.profiles(id) on delete set null,
  method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_fee_monthly_needs_ym check (
    payment_type <> 'Monthly'
    or (year is not null and month is not null)
  )
);

create unique index if not exists student_fee_initial_paid_uidx
  on public.student_fee_payments (student_id)
  where payment_type = 'Initial' and status = 'Paid';

create unique index if not exists student_fee_monthly_uidx
  on public.student_fee_payments (student_id, year, month)
  where payment_type = 'Monthly';

create index if not exists idx_student_fee_payments_student
  on public.student_fee_payments (student_id);

create index if not exists idx_student_fee_payments_ym
  on public.student_fee_payments (year, month);

alter table public.student_fee_payments enable row level security;

drop policy if exists student_fee_payments_admin_all on public.student_fee_payments;
create policy student_fee_payments_admin_all
on public.student_fee_payments for all to authenticated
using (public.current_role_name() in ('Admin', 'Super Admin'))
with check (public.current_role_name() in ('Admin', 'Super Admin'));
