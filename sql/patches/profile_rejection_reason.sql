-- Rejection reason for pending approvals (Admin / Super Admin)
-- Run in: Supabase → SQL Editor → Run

alter table public.profiles
  add column if not exists rejection_reason text;

alter table public.profiles
  add column if not exists rejected_at timestamptz;

alter table public.profiles
  add column if not exists rejected_by uuid references public.profiles(id) on delete set null;

comment on column public.profiles.rejection_reason is 'Reason entered when Admin/Super Admin rejects a pending registration';
