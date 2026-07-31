-- ============================================================
-- Super Admin ONLY: chief_thevehari@live.com
-- (old superadmin@gmail.com must NOT be recreated)
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
  v_email text := 'chief_thevehari@live.com';
  v_password text := 'password123';
  v_user_id uuid;
  v_role_id uuid;
  v_old_id uuid;
  v_encrypted_pw text := crypt(v_password, gen_salt('bf'));
begin
  select id into v_role_id from public.roles where name = 'Super Admin' limit 1;
  select id into v_user_id from auth.users where lower(email) = lower(v_email) limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated', v_email, v_encrypted_pw,
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
      gen_random_uuid(), v_user_id,
      format('{"sub":"%s","email":"%s"}', v_user_id::text, v_email)::jsonb,
      'email', v_user_id::text, now(), now(), now()
    );
  end if;

  insert into public.profiles (id, email, full_name, status, role_id)
  values (v_user_id, v_email, 'Principal', 'Approved', v_role_id)
  on conflict (id) do update
  set email = v_email, full_name = 'Principal', status = 'Approved', role_id = v_role_id;

  -- Remove legacy Super Admin login if it still exists
  select id into v_old_id from auth.users where lower(email) = 'superadmin@gmail.com' limit 1;
  if v_old_id is not null and v_old_id <> v_user_id then
    delete from public.profiles where id = v_old_id;
    delete from auth.identities where user_id = v_old_id;
    delete from auth.users where id = v_old_id;
  end if;
end $$;

select u.email, p.full_name, p.status, r.name as role_name
from auth.users u
left join public.profiles p on p.id = u.id
left join public.roles r on r.id = p.role_id
where lower(u.email) = 'chief_thevehari@live.com';
