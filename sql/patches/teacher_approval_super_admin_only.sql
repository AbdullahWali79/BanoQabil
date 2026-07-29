-- Teacher approval/reject/suspend only Super Admin
-- Admin may add/edit teacher details (not username/email/status).
-- Super Admin may edit username/email, change status, and delete teachers.
--
-- Run in Supabase → SQL Editor.

-- Self-contained helper
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
      -- Admin cannot change Teacher status (except leave unchanged / set Pending on create flows)
      (
        not exists (
          select 1
          from public.roles r
          where r.id = role_id and r.name = 'Teacher'
        )
        or status is not distinct from (
          select p_old.status
          from public.profiles p_old
          where p_old.id = id
        )
        or status = 'Pending'
      )
      -- Admin cannot change Teacher email
      and (
        not exists (
          select 1
          from public.roles r
          where r.id = role_id and r.name = 'Teacher'
        )
        or email is not distinct from (
          select p_old.email
          from public.profiles p_old
          where p_old.id = id
        )
      )
    )
  )
);

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

-- teachers: Admin may update rows but not username; Super Admin full write; delete Super Admin only
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
      where t_old.id = id
    )
  )
);

create policy teachers_delete_super_admin
on public.teachers for delete to authenticated
using (public.current_role_name() = 'Super Admin');
