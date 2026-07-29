-- ============================================================
-- Staff Pay (Super Admin only)
-- Teachers + Admins appear from profiles (read-only here).
-- Other staff (Cleaner, Guard, etc.) live in staff_members.
-- Monthly paid/pending tracked in staff_monthly_pay.
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

-- Non-login staff (cleaners, guards, etc.)
create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  job_title text not null,
  monthly_salary numeric(12, 2),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_members_active
  on public.staff_members (is_active);

create index if not exists idx_staff_members_job
  on public.staff_members (job_title);

-- Monthly pay ledger (Teachers/Admins via profile_id; others via staff_member_id)
create table if not exists public.staff_monthly_pay (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  staff_member_id uuid references public.staff_members(id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  month int not null check (month between 1 and 12),
  amount numeric(12, 2) not null default 0,
  status text not null default 'Pending'
    check (status in ('Pending', 'Paid')),
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_pay_one_subject check (
    (profile_id is not null and staff_member_id is null)
    or (profile_id is null and staff_member_id is not null)
  )
);

create unique index if not exists staff_monthly_pay_profile_month_uidx
  on public.staff_monthly_pay (profile_id, year, month)
  where profile_id is not null;

create unique index if not exists staff_monthly_pay_member_month_uidx
  on public.staff_monthly_pay (staff_member_id, year, month)
  where staff_member_id is not null;

create index if not exists idx_staff_monthly_pay_ym
  on public.staff_monthly_pay (year, month);

-- RLS
alter table public.staff_members enable row level security;
alter table public.staff_monthly_pay enable row level security;

drop policy if exists staff_members_super_admin_all on public.staff_members;
create policy staff_members_super_admin_all
on public.staff_members for all to authenticated
using (public.current_role_name() = 'Super Admin')
with check (public.current_role_name() = 'Super Admin');

drop policy if exists staff_monthly_pay_super_admin_all on public.staff_monthly_pay;
create policy staff_monthly_pay_super_admin_all
on public.staff_monthly_pay for all to authenticated
using (public.current_role_name() = 'Super Admin')
with check (public.current_role_name() = 'Super Admin');
