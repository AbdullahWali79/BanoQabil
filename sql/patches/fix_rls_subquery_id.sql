-- ============================================================
-- FIX: "more than one row returned by a subquery used as an expression"
-- Cause: In RLS WITH CHECK, unqualified `id` inside a subquery binds to the
--        inner table (p_old.id = p_old.id → ALL rows). Qualify as profiles.id /
--        teachers.id.
--
-- Run in: Supabase → SQL Editor → Run
-- Then try Add Teacher again.
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

-- ---------- profiles UPDATE ----------
drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
on public.profiles for update to authenticated
using (
  id = auth.uid()
  or public.current_role_name() in ('Admin', 'Super Admin')
)
with check (
  id = auth.uid()
  or (
    public.current_role_name() = 'Super Admin'
  )
  or (
    public.current_role_name() = 'Admin'
    and (
      -- Non-teacher profiles: Admin may update freely
      not exists (
        select 1
        from public.roles r
        where r.id = profiles.role_id and r.name = 'Teacher'
      )
      -- Teacher profiles: Admin cannot change status (except leave same / Pending)
      or status is not distinct from (
        select p_old.status
        from public.profiles p_old
        where p_old.id = profiles.id
      )
      or status = 'Pending'
    )
    and (
      not exists (
        select 1
        from public.roles r
        where r.id = profiles.role_id and r.name = 'Teacher'
      )
      or email is not distinct from (
        select p_old.email
        from public.profiles p_old
        where p_old.id = profiles.id
      )
    )
  )
);

-- ---------- profiles INSERT ----------
drop policy if exists profiles_insert_authenticated on public.profiles;
create policy profiles_insert_authenticated
on public.profiles for insert to authenticated
with check (
  id = auth.uid()
  or (
    public.current_role_name() in ('Admin', 'Super Admin')
    and (
      public.current_role_name() = 'Super Admin'
      or not (
        exists (
          select 1
          from public.roles r
          where r.id = role_id and r.name = 'Teacher'
        )
        and status is distinct from 'Pending'
      )
    )
  )
);

-- ---------- teachers INSERT / UPDATE / DELETE ----------
drop policy if exists teachers_write_authenticated on public.teachers;
drop policy if exists teachers_update_admin on public.teachers;
drop policy if exists teachers_insert_admin on public.teachers;
drop policy if exists teachers_delete_super_admin on public.teachers;

create policy teachers_insert_admin
on public.teachers for insert to authenticated
with check (public.current_role_name() in ('Admin', 'Super Admin'));

create policy teachers_update_admin
on public.teachers for update to authenticated
using (public.current_role_name() in ('Admin', 'Super Admin'))
with check (
  public.current_role_name() = 'Super Admin'
  or (
    public.current_role_name() = 'Admin'
    and username is not distinct from (
      select t_old.username
      from public.teachers t_old
      where t_old.id = teachers.id
    )
  )
);

create policy teachers_delete_super_admin
on public.teachers for delete to authenticated
using (public.current_role_name() = 'Super Admin');

-- Deduplicate roles if somehow duplicated (keeps oldest id per name)
delete from public.roles a
using public.roles b
where a.name = b.name
  and a.ctid < b.ctid
  and not exists (select 1 from public.profiles p where p.role_id = a.id);

select 'RLS teacher/profile policies fixed' as message;
