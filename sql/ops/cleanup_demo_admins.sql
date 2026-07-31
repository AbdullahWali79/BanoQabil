-- ============================================================
-- Cleanup demo admins + lock real accounts
-- KEEP:
--   Super Admin → chief_thevehari@live.com / password123  (only one)
--   Admin       → abdullahwali79@gmail.com                 (only one)
-- REMOVE:
--   superadmin@gmail.com (legacy)
--   admin123@gmail.com and any other demo / extra Admin or Super Admin accounts
-- ============================================================
-- Run in Supabase → SQL Editor
-- ============================================================

create extension if not exists pgcrypto;

-- 1) Roles
insert into public.roles (name)
select 'Super Admin'
where not exists (select 1 from public.roles where name = 'Super Admin');

insert into public.roles (name)
select 'Admin'
where not exists (select 1 from public.roles where name = 'Admin');

-- 2) Delete DEMO / extra admin auth users (NOT abdullahwali79, NOT principal)
do $$
declare
  r record;
  keep_emails text[] := array[
    'chief_thevehari@live.com',
    'abdullahwali79@gmail.com'
  ];
begin
  for r in
    select u.id, u.email
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.roles role on role.id = p.role_id
    where
      -- legacy / demo accounts
      lower(u.email) in ('admin123@gmail.com', 'superadmin@gmail.com')
      -- or any Admin / Super Admin that is NOT in keep list
      or (
        coalesce(role.name, '') in ('Admin', 'Super Admin')
        and lower(u.email) <> all (keep_emails)
      )
  loop
    delete from public.teachers where profile_id = r.id;
    delete from public.students where profile_id = r.id;
    delete from public.profiles where id = r.id;
    delete from auth.identities where user_id = r.id;
    delete from auth.users where id = r.id;
    raise notice 'Removed auth user: %', r.email;
  end loop;
end $$;

-- 3) Ensure Super Admin auth user: chief_thevehari@live.com / password123
do $$
declare
  v_email text := 'chief_thevehari@live.com';
  v_password text := 'password123';
  v_user_id uuid;
  v_role_id uuid;
  v_encrypted_pw text := crypt(v_password, gen_salt('bf'));
begin
  select id into v_role_id from public.roles where name = 'Super Admin' limit 1;

  select id into v_user_id from auth.users where lower(email) = v_email limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Principal","role":"Super Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  else
    update auth.users
    set
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data =
        coalesce(raw_user_meta_data, '{}'::jsonb)
        || '{"full_name":"Principal","role":"Super Admin"}'::jsonb,
      updated_at = now()
    where id = v_user_id;
  end if;

  if not exists (
    select 1 from auth.identities where user_id = v_user_id and provider = 'email'
  ) then
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_user_id,
      format('{"sub":"%s","email":"%s"}', v_user_id::text, v_email)::jsonb,
      'email',
      v_user_id::text,
      now(), now(), now()
    );
  end if;

  insert into public.profiles (id, email, full_name, status, role_id)
  values (v_user_id, v_email, 'Principal', 'Approved', v_role_id)
  on conflict (id) do update
  set
    email = v_email,
    full_name = 'Principal',
    status = 'Approved',
    role_id = v_role_id;
end $$;

-- 4) Ensure real Admin: abdullahwali79@gmail.com (must already exist in Auth)
do $$
declare
  v_email text := 'abdullahwali79@gmail.com';
  v_user_id uuid;
  v_role_id uuid;
begin
  select id into v_role_id from public.roles where name = 'Admin' limit 1;
  select id into v_user_id from auth.users where lower(email) = v_email limit 1;

  if v_user_id is null then
    raise notice 'WARNING: % not found in auth.users — create/login that account first, then re-run this script.', v_email;
    return;
  end if;

  update auth.users
  set
    raw_user_meta_data =
      coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'role', 'Admin',
        'full_name',
        regexp_replace(
          coalesce(raw_user_meta_data->>'full_name', 'Abdullah Wali'),
          '\s*\(super\s*admin\)\s*',
          '',
          'gi'
        )
      ),
    updated_at = now()
  where id = v_user_id;

  insert into public.profiles (id, email, full_name, status, role_id)
  values (
    v_user_id,
    v_email,
    coalesce(
      (
        select regexp_replace(
          coalesce(raw_user_meta_data->>'full_name', 'Abdullah Wali'),
          '\s*\(super\s*admin\)\s*',
          '',
          'gi'
        )
        from auth.users where id = v_user_id
      ),
      'Abdullah Wali'
    ),
    'Approved',
    v_role_id
  )
  on conflict (id) do update
  set
    email = v_email,
    full_name = regexp_replace(
      coalesce(nullif(btrim(public.profiles.full_name), ''), 'Abdullah Wali'),
      '\s*\(super\s*admin\)\s*',
      '',
      'gi'
    ),
    status = 'Approved',
    role_id = v_role_id;
end $$;

-- 5) Safety: any remaining Super Admin role except principal → Admin
update public.profiles p
set role_id = (select id from public.roles where name = 'Admin' limit 1)
from public.roles r
where r.id = p.role_id
  and r.name = 'Super Admin'
  and lower(coalesce(p.email, '')) <> 'chief_thevehari@live.com';

-- 6) Verify
select
  coalesce(p.email, u.email) as email,
  p.full_name,
  p.status,
  r.name as role_name
from auth.users u
left join public.profiles p on p.id = u.id
left join public.roles r on r.id = p.role_id
where coalesce(r.name, '') in ('Admin', 'Super Admin')
   or lower(u.email) in (
     'chief_thevehari@live.com',
     'superadmin@gmail.com',
     'abdullahwali79@gmail.com',
     'admin123@gmail.com'
   )
order by r.name nulls last, email;
