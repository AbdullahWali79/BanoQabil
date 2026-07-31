-- ============================================================
-- FIX roles (run after Super Admin transfer)
-- 1) chief_thevehari@live.com  → Super Admin
-- 2) abdullahwali79@gmail.com   → Admin (kept safe)
-- 3) Delete legacy superadmin@gmail.com
--
-- Run in: Supabase → SQL Editor → Run
-- Then deploy app (roles.ts already locks these emails)
-- ============================================================

insert into public.roles (name)
select 'Super Admin'
where not exists (select 1 from public.roles where name = 'Super Admin');

insert into public.roles (name)
select 'Admin'
where not exists (select 1 from public.roles where name = 'Admin');

do $$
declare
  v_principal text := 'chief_thevehari@live.com';
  v_admin_email text := 'abdullahwali79@gmail.com';
  v_principal_id uuid;
  v_admin_id uuid;
  v_sa uuid;
  v_admin uuid;
begin
  select id into v_sa from public.roles where name = 'Super Admin' limit 1;
  select id into v_admin from public.roles where name = 'Admin' limit 1;

  if v_sa is null or v_admin is null then
    raise exception 'Roles Super Admin / Admin missing';
  end if;

  select id into v_principal_id from auth.users where lower(email) = lower(v_principal) limit 1;
  select id into v_admin_id from auth.users where lower(email) = lower(v_admin_email) limit 1;

  if v_principal_id is null then
    raise exception 'Principal user % not found in auth.users', v_principal;
  end if;

  -- ---------- Super Admin (principal) ----------
  update auth.users
  set
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_user_meta_data =
      coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'Super Admin', 'full_name', 'Principal'),
    updated_at = now()
  where id = v_principal_id;

  insert into public.profiles (id, email, full_name, status, role_id)
  values (v_principal_id, v_principal, 'Principal', 'Approved', v_sa)
  on conflict (id) do update
  set
    email = v_principal,
    full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), 'Principal'),
    status = 'Approved',
    role_id = v_sa;

  -- ---------- Primary Admin (do NOT demote / delete) ----------
  if v_admin_id is not null then
    update auth.users
    set
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data =
        coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'Admin'),
      updated_at = now()
    where id = v_admin_id;

    insert into public.profiles (id, email, full_name, status, role_id)
    values (v_admin_id, v_admin_email, 'Abdullah Wali', 'Approved', v_admin)
    on conflict (id) do update
    set
      email = v_admin_email,
      status = 'Approved',
      role_id = v_admin,
      full_name = coalesce(
        nullif(btrim(public.profiles.full_name), ''),
        'Abdullah Wali'
      );
  else
    raise notice 'WARNING: primary Admin % not in auth.users — create that login if needed.', v_admin_email;
  end if;

  -- Only principal may keep Super Admin; everyone else with SA → Admin
  -- (this does NOT remove Admin accounts — only fixes wrong Super Admin role)
  update public.profiles p
  set role_id = v_admin
  from public.roles r
  where p.role_id = r.id
    and r.name = 'Super Admin'
    and lower(coalesce(p.email, '')) <> lower(v_principal);

  -- Delete legacy Super Admin login only
  delete from public.profiles
  where id in (select id from auth.users where lower(email) = 'superadmin@gmail.com');
  delete from auth.identities
  where user_id in (select id from auth.users where lower(email) = 'superadmin@gmail.com');
  delete from auth.users where lower(email) = 'superadmin@gmail.com';
end $$;

-- Expected:
-- chief_thevehari@live.com  → Super Admin
-- abdullahwali79@gmail.com  → Admin
-- superadmin@gmail.com      → (no rows)
select
  coalesce(p.email, u.email) as email,
  p.full_name,
  p.status,
  r.name as role_name
from auth.users u
left join public.profiles p on p.id = u.id
left join public.roles r on r.id = p.role_id
where lower(coalesce(p.email, u.email)) in (
  'chief_thevehari@live.com',
  'abdullahwali79@gmail.com',
  'superadmin@gmail.com'
)
order by role_name, email;
