-- ============================================================
-- Super Admin → chief_thevehari@live.com
-- OLD account superadmin@gmail.com is DELETED (security)
--
-- Run in: Supabase → SQL Editor → Run
-- App lock: src/lib/roles.ts → SUPER_ADMIN_EMAIL = 'chief_thevehari@live.com'
-- ============================================================

create extension if not exists pgcrypto;

insert into public.roles (name)
select 'Super Admin'
where not exists (select 1 from public.roles where name = 'Super Admin');

insert into public.roles (name)
select 'Admin'
where not exists (select 1 from public.roles where name = 'Admin');

do $$
declare
  v_old_email text := 'superadmin@gmail.com';
  v_new_email text := 'chief_thevehari@live.com';
  v_password text := 'password123';  -- change after first login
  v_old_id uuid;
  v_new_id uuid;
  v_sa_role uuid;
  v_admin_role uuid;
  v_encrypted_pw text := crypt(v_password, gen_salt('bf'));
begin
  select id into v_sa_role from public.roles where name = 'Super Admin' limit 1;
  select id into v_admin_role from public.roles where name = 'Admin' limit 1;

  select id into v_old_id from auth.users where lower(email) = lower(v_old_email) limit 1;
  select id into v_new_id from auth.users where lower(email) = lower(v_new_email) limit 1;

  -- Case A: principal email missing → rename old Super Admin to principal
  if v_new_id is null and v_old_id is not null then
    update auth.users
    set
      email = v_new_email,
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data =
        coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('full_name', 'Principal', 'role', 'Super Admin'),
      updated_at = now()
    where id = v_old_id;

    update auth.identities
    set
      identity_data =
        coalesce(identity_data, '{}'::jsonb)
        || jsonb_build_object('email', v_new_email, 'sub', v_old_id::text),
      provider_id = v_old_id::text,
      updated_at = now()
    where user_id = v_old_id and provider = 'email';

    update public.profiles
    set
      email = v_new_email,
      full_name = coalesce(nullif(full_name, ''), 'Principal'),
      status = 'Approved',
      role_id = v_sa_role
    where id = v_old_id;

    v_new_id := v_old_id;
    v_old_id := null; -- renamed; nothing left to delete

  -- Case B: principal already exists → promote principal
  elsif v_new_id is not null then
    update auth.users
    set
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data =
        coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'Super Admin'),
      updated_at = now()
    where id = v_new_id;

    insert into public.profiles (id, email, full_name, status, role_id)
    values (v_new_id, v_new_email, 'Principal', 'Approved', v_sa_role)
    on conflict (id) do update
    set
      email = v_new_email,
      status = 'Approved',
      role_id = v_sa_role;

  -- Case C: neither exists → create principal
  else
    v_new_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_new_id, 'authenticated', 'authenticated', v_new_email, v_encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Principal","role":"Super Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_new_id,
      format('{"sub":"%s","email":"%s"}', v_new_id::text, v_new_email)::jsonb,
      'email', v_new_id::text, now(), now(), now()
    );

    insert into public.profiles (id, email, full_name, status, role_id)
    values (v_new_id, v_new_email, 'Principal', 'Approved', v_sa_role)
    on conflict (id) do update
    set email = v_new_email, status = 'Approved', role_id = v_sa_role;
  end if;

  -- Only principal keeps Super Admin role
  update public.profiles p
  set role_id = v_admin_role
  from public.roles r
  where p.role_id = r.id
    and r.name = 'Super Admin'
    and lower(coalesce(p.email, '')) <> lower(v_new_email);

  -- DELETE old superadmin@gmail.com completely (auth + profile)
  select id into v_old_id from auth.users where lower(email) = lower(v_old_email) limit 1;
  if v_old_id is not null and (v_new_id is null or v_old_id <> v_new_id) then
    delete from public.profiles where id = v_old_id;
    delete from auth.identities where user_id = v_old_id;
    delete from auth.users where id = v_old_id;
  end if;
end $$;

-- Verify: old email must be gone
select u.email, p.full_name, p.status, r.name as role_name
from auth.users u
left join public.profiles p on p.id = u.id
left join public.roles r on r.id = p.role_id
where lower(u.email) in ('chief_thevehari@live.com', 'superadmin@gmail.com')
order by u.email;

-- Extra check (should return 0 rows)
select id, email from auth.users where lower(email) = 'superadmin@gmail.com';
