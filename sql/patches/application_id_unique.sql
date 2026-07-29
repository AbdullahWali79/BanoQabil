-- Unique Application IDs + safe next-ID generator (exactly 7 digits, e.g. 3117830)
-- Run in Supabase SQL Editor (safe to re-run).

-- 1) Unique index (case-insensitive, ignore blanks)
create unique index if not exists students_application_id_unique
  on public.students (lower(btrim(application_id)))
  where application_id is not null and btrim(application_id) <> '';

-- 2) Next Application ID — ONLY considers existing 7-digit IDs
--    (ignores longer sheet IDs so we never emit 8+ digits)
create or replace function public.next_application_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_id bigint;
begin
  perform pg_advisory_xact_lock(87236401);

  select coalesce(max(application_id::bigint), 3117829) + 1
    into next_id
  from public.students
  where application_id ~ '^[0-9]{7}$';

  if next_id < 1000000 or next_id > 9999999 then
    raise exception 'Application ID must stay within 7 digits (1000000–9999999)';
  end if;

  return lpad(next_id::text, 7, '0');
end;
$$;

revoke all on function public.next_application_id() from public;
grant execute on function public.next_application_id() to anon, authenticated, service_role;
