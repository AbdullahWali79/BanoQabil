-- ============================================================
-- FIX teachers RLS (insert + update for Admin/Super Admin)
-- Fixes: "new row violates row-level security policy for table teachers"
--
-- Cause: Admin create flow INSERTs a bare teachers row, then UPDATEs username.
--        Old policy blocked Admin from changing username (null → value).
--
-- Run in: Supabase → SQL Editor → Run
-- ============================================================

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

create or replace function public.is_staff_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid()
        and coalesce(p.status, '') = 'Approved'
        and r.name in ('Admin', 'Super Admin')
    )
    or lower(coalesce(
      (select p.email from public.profiles p where p.id = auth.uid() limit 1),
      ''
    )) in (
      'chief_thevehari@live.com',
      'abdullahwali79@gmail.com'
    );
$$;

-- Drop every teachers policy we know about, then recreate cleanly
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'teachers'
  loop
    execute format('drop policy if exists %I on public.teachers', pol.policyname);
  end loop;
end $$;

alter table public.teachers enable row level security;

create policy teachers_select_authenticated
on public.teachers for select to authenticated
using (true);

create policy teachers_insert_admin
on public.teachers for insert to authenticated
with check (public.is_staff_admin());

create policy teachers_update_admin
on public.teachers for update to authenticated
using (public.is_staff_admin())
with check (
  public.current_role_name() = 'Super Admin'
  or lower(coalesce(
    (select p.email from public.profiles p where p.id = auth.uid() limit 1),
    ''
  )) = 'chief_thevehari@live.com'
  or (
    public.is_staff_admin()
    and (
      -- Admin may SET username once (null → value) on create, but not CHANGE later
      (
        select t_old.username
        from public.teachers t_old
        where t_old.id = teachers.id
      ) is null
      or username is not distinct from (
        select t_old.username
        from public.teachers t_old
        where t_old.id = teachers.id
      )
    )
  )
);

create policy teachers_delete_super_admin
on public.teachers for delete to authenticated
using (
  public.current_role_name() = 'Super Admin'
  or lower(coalesce(
    (select p.email from public.profiles p where p.id = auth.uid() limit 1),
    ''
  )) = 'chief_thevehari@live.com'
);

-- Keep profile policies qualified (from fix_rls_subquery_id) if missing
drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
on public.profiles for update to authenticated
using (
  id = auth.uid()
  or public.is_staff_admin()
)
with check (
  id = auth.uid()
  or public.current_role_name() = 'Super Admin'
  or lower(coalesce(
    (select p.email from public.profiles p where p.id = auth.uid() limit 1),
    ''
  )) = 'chief_thevehari@live.com'
  or (
    public.is_staff_admin()
    and (
      not exists (
        select 1 from public.roles r
        where r.id = profiles.role_id and r.name = 'Teacher'
      )
      or status is not distinct from (
        select p_old.status from public.profiles p_old where p_old.id = profiles.id
      )
      or status = 'Pending'
    )
    and (
      not exists (
        select 1 from public.roles r
        where r.id = profiles.role_id and r.name = 'Teacher'
      )
      or email is not distinct from (
        select p_old.email from public.profiles p_old where p_old.id = profiles.id
      )
    )
  )
);

select 'teachers + profiles RLS fixed for Admin teacher create' as message;
