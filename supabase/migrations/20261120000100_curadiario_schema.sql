-- curadiário: schema, tables and RPCs.
--
-- Lives in the SideKick Supabase project, in its own schema. The schema is not exposed through
-- the Data API: every read and write goes through the public.cd_* functions below, and only
-- signed-in people (Supabase Auth, magic link) can call them.
--
-- End-to-end encryption (docs/security.md): the server never sees a diary key in the clear.
--   * device      — a browser where someone uses the app. Holds an ECDH key pair; the private key
--                   never leaves the browser. The server keeps the public key only.
--   * recovery    — a special device per diary, owned by the owner. Its private key is stored here
--                   encrypted with the recovery code, which only the owner has.
--   * key version — each diary has an AES key per version. Removing someone (or revoking a device)
--                   asks the owner's app to create the next version.
--   * key share   — a diary key version encrypted for one device's public key.
--   * entry, topic, diary meta — encrypted by the browser; stored as {iv, ct} blobs.
-- What the server can see: e-mail addresses, who belongs to which diary and with which role,
-- device labels, and when things were saved.

create schema if not exists curadiario;
revoke all on schema curadiario from public, anon, authenticated;

------------------------------------------------------------------------
-- 1. Tables
------------------------------------------------------------------------
create table curadiario.diaries (
  id               uuid primary key,
  owner_id         uuid not null references auth.users(id) on delete cascade,
  key_version      int  not null default 1 check (key_version >= 1),
  meta             jsonb not null,
  meta_key_version int  not null default 1,
  needs_rotation   boolean not null default false,
  terms_version    text not null check (length(terms_version) between 1 and 20),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index diaries_owner_id_idx on curadiario.diaries (owner_id);

create table curadiario.members (
  diary_id     uuid not null references curadiario.diaries(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('owner', 'writer', 'reader')),
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  joined_at    timestamptz not null default now(),
  primary key (diary_id, user_id)
);
create index members_user_id_idx on curadiario.members (user_id);

create table curadiario.invites (
  id          uuid primary key default gen_random_uuid(),
  diary_id    uuid not null references curadiario.diaries(id) on delete cascade,
  email       text not null check (email = lower(trim(email)) and email like '%_@_%' and length(email) <= 254),
  role        text not null check (role in ('writer', 'reader')),
  invited_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create unique index invites_diary_id_email_idx on curadiario.invites (diary_id, email);
create index invites_email_idx on curadiario.invites (email);

create table curadiario.devices (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  kind                  text not null default 'browser' check (kind in ('browser', 'recovery')),
  diary_id              uuid references curadiario.diaries(id) on delete cascade,
  public_key            jsonb not null,
  encrypted_private_key jsonb,
  label                 text not null default '' check (length(label) <= 80),
  created_at            timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  revoked_at            timestamptz,
  check ((kind = 'recovery') = (diary_id is not null and encrypted_private_key is not null))
);
create index devices_user_id_idx on curadiario.devices (user_id);
create unique index devices_recovery_diary_idx on curadiario.devices (diary_id) where kind = 'recovery';

create table curadiario.key_shares (
  diary_id    uuid not null references curadiario.diaries(id) on delete cascade,
  key_version int  not null,
  device_id   uuid not null references curadiario.devices(id) on delete cascade,
  wrapped     jsonb not null check (octet_length(wrapped::text) <= 2000),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (diary_id, key_version, device_id)
);
create index key_shares_device_id_idx on curadiario.key_shares (device_id);

create table curadiario.entries (
  id          uuid primary key,
  diary_id    uuid not null references curadiario.diaries(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  key_version int  not null,
  payload     jsonb not null check (octet_length(payload::text) <= 100000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index entries_diary_id_idx on curadiario.entries (diary_id, created_at desc);

create table curadiario.topics (
  id          uuid primary key,
  diary_id    uuid not null references curadiario.diaries(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  key_version int  not null,
  payload     jsonb not null check (octet_length(payload::text) <= 20000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index topics_diary_id_idx on curadiario.topics (diary_id, created_at desc);

-- RLS on and no policies: no direct access for anon/authenticated.
alter table curadiario.diaries    enable row level security;
alter table curadiario.members    enable row level security;
alter table curadiario.invites    enable row level security;
alter table curadiario.devices    enable row level security;
alter table curadiario.key_shares enable row level security;
alter table curadiario.entries    enable row level security;
alter table curadiario.topics     enable row level security;
revoke all on all tables in schema curadiario from public, anon, authenticated;

------------------------------------------------------------------------
-- 2. Internal helpers (schema curadiario, not callable by clients)
------------------------------------------------------------------------

-- The signed-in user, or 'not_authenticated'.
create function curadiario.require_user()
returns uuid language plpgsql stable set search_path = '' as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'not_authenticated'; end if;
  return v;
end $$;

create function curadiario.current_email()
returns text language sql stable set search_path = '' as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')))
$$;

create function curadiario.role_of(p_diary_id uuid, p_user_id uuid)
returns text language sql stable set search_path = '' as $$
  select role from curadiario.members where diary_id = p_diary_id and user_id = p_user_id
$$;

-- Raises 'not_authorized' unless the user has one of the roles.
create function curadiario.require_role(p_diary_id uuid, p_user_id uuid, p_roles text[])
returns text language plpgsql stable set search_path = '' as $$
declare v_role text := curadiario.role_of(p_diary_id, p_user_id);
begin
  if v_role is null or not (v_role = any (p_roles)) then raise exception 'not_authorized'; end if;
  return v_role;
end $$;

-- An encrypted blob: {"iv": base64, "ct": base64}.
create function curadiario.is_blob(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
     and jsonb_typeof(p -> 'iv') = 'string'
     and jsonb_typeof(p -> 'ct') = 'string'
$$;

-- An ECDH P-256 public key as JWK.
create function curadiario.is_public_jwk(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
     and p ->> 'kty' = 'EC' and p ->> 'crv' = 'P-256'
     and jsonb_typeof(p -> 'x') = 'string' and jsonb_typeof(p -> 'y') = 'string'
     and not (p ? 'd')
     and octet_length(p::text) <= 500
$$;

-- The caller's active browser device, or 'device_not_found'.
create function curadiario.require_device(p_device_id uuid, p_user_id uuid)
returns curadiario.devices language plpgsql stable set search_path = '' as $$
declare v curadiario.devices;
begin
  select * into v from curadiario.devices
  where id = p_device_id and user_id = p_user_id and kind = 'browser' and revoked_at is null;
  if not found then raise exception 'device_not_found'; end if;
  return v;
end $$;

-- Inserts key shares [{device_id, key_version, wrapped}]. Each target must be an active device of a
-- current member (or this diary's recovery device), and the version must exist. Owners and writers
-- may share with anyone in the diary; anyone may share with their own devices.
create function curadiario.insert_key_shares(p_diary_id uuid, p_user_id uuid, p_shares jsonb)
returns int language plpgsql volatile set search_path = '' as $$
declare
  v_share jsonb;
  v_device curadiario.devices;
  v_version int;
  v_current int;
  v_role text := curadiario.role_of(p_diary_id, p_user_id);
  v_count int := 0;
begin
  if v_role is null then raise exception 'not_authorized'; end if;
  if jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) > 200 then raise exception 'invalid_input'; end if;
  select key_version into v_current from curadiario.diaries where id = p_diary_id;

  for v_share in select * from jsonb_array_elements(p_shares) loop
    v_version := (v_share ->> 'key_version')::int;
    if v_version is null or v_version < 1 or v_version > v_current then raise exception 'invalid_input'; end if;
    if jsonb_typeof(v_share -> 'wrapped') <> 'object' then raise exception 'invalid_input'; end if;

    select * into v_device from curadiario.devices where id = (v_share ->> 'device_id')::uuid and revoked_at is null;
    if not found then raise exception 'device_not_found'; end if;

    if v_device.kind = 'recovery' then
      if v_device.diary_id <> p_diary_id or v_role <> 'owner' then raise exception 'not_authorized'; end if;
    else
      if curadiario.role_of(p_diary_id, v_device.user_id) is null then raise exception 'not_authorized'; end if;
      if v_device.user_id <> p_user_id and v_role not in ('owner', 'writer') then raise exception 'not_authorized'; end if;
    end if;

    insert into curadiario.key_shares (diary_id, key_version, device_id, wrapped, created_by)
    values (p_diary_id, v_version, v_device.id, v_share -> 'wrapped', p_user_id)
    on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Devices that can't read the current key version yet: active browsers of current members
-- without a share for it. p_only_user limits the list to one person's devices.
create function curadiario.pending_devices(p_diary_id uuid, p_only_user uuid default null)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'device_id', d.id, 'user_id', d.user_id, 'display_name', m.display_name,
    'label', d.label, 'public_key', d.public_key, 'created_at', d.created_at
  ) order by d.created_at), '[]'::jsonb)
  from curadiario.devices d
  join curadiario.members m on m.user_id = d.user_id and m.diary_id = p_diary_id
  join curadiario.diaries y on y.id = p_diary_id
  where d.kind = 'browser' and d.revoked_at is null
    and (p_only_user is null or d.user_id = p_only_user)
    and not exists (
      select 1 from curadiario.key_shares s
      where s.diary_id = p_diary_id and s.device_id = d.id and s.key_version = y.key_version
    )
$$;

revoke execute on all functions in schema curadiario from public, anon, authenticated;

------------------------------------------------------------------------
-- 3. RPCs (public.cd_*). Errors are fixed codes (src/i18n/errors.ts).
------------------------------------------------------------------------

-- Devices ----------------------------------------------------------------

create function public.cd_register_device(p_public_key jsonb, p_label text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := curadiario.require_user();
  v_id uuid;
begin
  if not curadiario.is_public_jwk(p_public_key) then raise exception 'invalid_input'; end if;
  if (select count(*) from curadiario.devices where user_id = v_user and kind = 'browser' and revoked_at is null) >= 10 then
    raise exception 'too_many_devices';
  end if;
  insert into curadiario.devices (user_id, public_key, label)
  values (v_user, p_public_key, left(coalesce(trim(p_label), ''), 80))
  returning id into v_id;
  return v_id;
end $$;

-- My active devices. Also marks this one as seen.
create function public.cd_list_devices(p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  perform curadiario.require_device(p_device_id, v_user);
  update curadiario.devices set last_seen_at = now() where id = p_device_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'created_at', created_at, 'last_seen_at', last_seen_at) order by created_at)
    from curadiario.devices where user_id = v_user and kind = 'browser' and revoked_at is null
  ), '[]'::jsonb);
end $$;

-- Revokes one of my devices (a lost phone). Its key shares go away, and every diary I'm in
-- asks its owner for a new key version.
create function public.cd_revoke_device(p_device_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  update curadiario.devices set revoked_at = now()
  where id = p_device_id and user_id = v_user and kind = 'browser' and revoked_at is null;
  if not found then raise exception 'device_not_found'; end if;
  delete from curadiario.key_shares where device_id = p_device_id;
  update curadiario.diaries set needs_rotation = true
  where id in (select diary_id from curadiario.members where user_id = v_user);
end $$;

-- Diaries ----------------------------------------------------------------

-- Diaries I belong to, as seen from this device.
create function public.cd_list_diaries(p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  perform curadiario.require_device(p_device_id, v_user);
  update curadiario.devices set last_seen_at = now() where id = p_device_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', y.id,
      'role', m.role,
      'key_version', y.key_version,
      'meta', y.meta,
      'meta_key_version', y.meta_key_version,
      'share', (select s.wrapped from curadiario.key_shares s
                where s.diary_id = y.id and s.device_id = p_device_id and s.key_version = y.meta_key_version),
      'member_count', (select count(*) from curadiario.members x where x.diary_id = y.id),
      'pending_device_count', case when m.role in ('owner', 'writer')
        then jsonb_array_length(curadiario.pending_devices(y.id)) else 0 end,
      'updated_at', greatest(y.updated_at, (select max(e.updated_at) from curadiario.entries e where e.diary_id = y.id))
    ) order by m.joined_at)
    from curadiario.members m join curadiario.diaries y on y.id = m.diary_id
    where m.user_id = v_user
  ), '[]'::jsonb);
end $$;

-- Creates a diary with its first key version, shared with this device and with the recovery device.
create function public.cd_create_diary(
  p_diary_id            uuid,
  p_meta                jsonb,
  p_display_name        text,
  p_terms_version       text,
  p_device_id           uuid,
  p_device_share        jsonb,
  p_recovery_public_key jsonb,
  p_recovery_private    jsonb,
  p_recovery_share      jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := curadiario.require_user();
  v_recovery uuid;
begin
  perform curadiario.require_device(p_device_id, v_user);
  if not curadiario.is_blob(p_meta) or not curadiario.is_blob(p_recovery_private)
     or not curadiario.is_public_jwk(p_recovery_public_key)
     or jsonb_typeof(p_device_share) <> 'object' or jsonb_typeof(p_recovery_share) <> 'object'
     or length(trim(coalesce(p_display_name, ''))) not between 1 and 60
     or length(coalesce(p_terms_version, '')) not between 1 and 20 then
    raise exception 'invalid_input';
  end if;
  if (select count(*) from curadiario.diaries where owner_id = v_user) >= 20 then raise exception 'too_many_diaries'; end if;

  insert into curadiario.diaries (id, owner_id, meta, terms_version) values (p_diary_id, v_user, p_meta, p_terms_version);
  insert into curadiario.members (diary_id, user_id, role, display_name) values (p_diary_id, v_user, 'owner', trim(p_display_name));
  insert into curadiario.devices (user_id, kind, diary_id, public_key, encrypted_private_key, label)
  values (v_user, 'recovery', p_diary_id, p_recovery_public_key, p_recovery_private, 'recovery')
  returning id into v_recovery;
  insert into curadiario.key_shares (diary_id, key_version, device_id, wrapped, created_by) values
    (p_diary_id, 1, p_device_id, p_device_share, v_user),
    (p_diary_id, 1, v_recovery, p_recovery_share, v_user);
end $$;

-- Everything the diary screen needs except entries and topics.
create function public.cd_get_diary(p_diary_id uuid, p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := curadiario.require_user();
  v_role text := curadiario.require_role(p_diary_id, v_user, array['owner', 'writer', 'reader']);
  v_diary curadiario.diaries;
begin
  perform curadiario.require_device(p_device_id, v_user);
  select * into v_diary from curadiario.diaries where id = p_diary_id;
  return jsonb_build_object(
    'id', v_diary.id,
    'role', v_role,
    'my_user_id', v_user,
    'key_version', v_diary.key_version,
    'meta', v_diary.meta,
    'meta_key_version', v_diary.meta_key_version,
    'needs_rotation', v_diary.needs_rotation,
    'shares', coalesce((select jsonb_agg(jsonb_build_object('key_version', s.key_version, 'wrapped', s.wrapped) order by s.key_version)
                        from curadiario.key_shares s where s.diary_id = p_diary_id and s.device_id = p_device_id), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object(
                          'user_id', m.user_id, 'display_name', m.display_name, 'role', m.role, 'joined_at', m.joined_at,
                          'email', case when v_role = 'owner' or m.user_id = v_user then u.email end
                        ) order by m.joined_at)
                        from curadiario.members m join auth.users u on u.id = m.user_id where m.diary_id = p_diary_id), '[]'::jsonb),
    'invites', case when v_role = 'owner' then coalesce((
                  select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'role', i.role, 'created_at', i.created_at) order by i.created_at)
                  from curadiario.invites i where i.diary_id = p_diary_id), '[]'::jsonb) else '[]'::jsonb end,
    'pending_devices', case when v_role in ('owner', 'writer') then curadiario.pending_devices(p_diary_id)
                            else curadiario.pending_devices(p_diary_id, v_user) end,
    -- Public keys the owner needs to share a new key version with everyone who stays.
    'share_targets', case when v_role = 'owner' then coalesce((
                  select jsonb_agg(jsonb_build_object('device_id', d.id, 'public_key', d.public_key))
                  from curadiario.devices d
                  where d.revoked_at is null and (
                    (d.kind = 'recovery' and d.diary_id = p_diary_id)
                    or (d.kind = 'browser' and d.user_id in (select user_id from curadiario.members where diary_id = p_diary_id)))
                  ), '[]'::jsonb) else '[]'::jsonb end
  );
end $$;

-- Changes the diary's name or settings (blocks, medicines). Owner only.
create function public.cd_update_meta(p_diary_id uuid, p_meta jsonb, p_key_version int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  perform curadiario.require_role(p_diary_id, v_user, array['owner']);
  if not curadiario.is_blob(p_meta) then raise exception 'invalid_input'; end if;
  update curadiario.diaries set meta = p_meta, meta_key_version = p_key_version, updated_at = now()
  where id = p_diary_id and p_key_version = key_version;
  if not found then raise exception 'stale_key_version'; end if;
end $$;

create function public.cd_delete_diary(p_diary_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  perform curadiario.require_role(p_diary_id, v_user, array['owner']);
  delete from curadiario.diaries where id = p_diary_id;
end $$;

-- Key versions -----------------------------------------------------------

-- Shares existing key versions with devices (approving a new device, or recovery).
create function public.cd_share_keys(p_diary_id uuid, p_shares jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  return curadiario.insert_key_shares(p_diary_id, v_user, p_shares);
end $$;

-- The next key version, after someone left or a device was revoked. Owner only. The meta is
-- re-encrypted with the new version, and the shares must cover the devices that stay.
create function public.cd_rotate_key(p_diary_id uuid, p_new_version int, p_meta jsonb, p_shares jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  perform curadiario.require_role(p_diary_id, v_user, array['owner']);
  if not curadiario.is_blob(p_meta) then raise exception 'invalid_input'; end if;
  update curadiario.diaries
  set key_version = p_new_version, meta = p_meta, meta_key_version = p_new_version, needs_rotation = false, updated_at = now()
  where id = p_diary_id and key_version = p_new_version - 1;
  if not found then raise exception 'stale_key_version'; end if;
  perform curadiario.insert_key_shares(p_diary_id, v_user, p_shares);
end $$;

-- The recovery device's encrypted private key and its shares. Owner only.
create function public.cd_get_recovery(p_diary_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  perform curadiario.require_role(p_diary_id, v_user, array['owner']);
  return (
    select jsonb_build_object(
      'device_id', d.id,
      'encrypted_private_key', d.encrypted_private_key,
      'shares', coalesce((select jsonb_agg(jsonb_build_object('key_version', s.key_version, 'wrapped', s.wrapped) order by s.key_version)
                          from curadiario.key_shares s where s.device_id = d.id), '[]'::jsonb))
    from curadiario.devices d where d.diary_id = p_diary_id and d.kind = 'recovery'
  );
end $$;

-- People -----------------------------------------------------------------

create function public.cd_invite(p_diary_id uuid, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := curadiario.require_user();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
begin
  perform curadiario.require_role(p_diary_id, v_user, array['owner']);
  if p_role not in ('writer', 'reader') or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'invalid_input';
  end if;
  if exists (select 1 from curadiario.members m join auth.users u on u.id = m.user_id
             where m.diary_id = p_diary_id and lower(u.email) = v_email) then
    raise exception 'already_member';
  end if;
  if (select count(*) from curadiario.members where diary_id = p_diary_id)
     + (select count(*) from curadiario.invites where diary_id = p_diary_id) >= 30 then
    raise exception 'diary_full';
  end if;
  insert into curadiario.invites (diary_id, email, role, invited_by) values (p_diary_id, v_email, p_role, v_user)
  on conflict (diary_id, email) do update set role = excluded.role
  returning id into v_id;
  return v_id;
end $$;

create function public.cd_cancel_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := curadiario.require_user();
  v_diary uuid;
begin
  select diary_id into v_diary from curadiario.invites where id = p_invite_id;
  if v_diary is null then raise exception 'invite_not_found'; end if;
  perform curadiario.require_role(v_diary, v_user, array['owner']);
  delete from curadiario.invites where id = p_invite_id;
end $$;

-- Invites waiting for my e-mail address. The diary name is encrypted, so the invite shows who sent it.
create function public.cd_list_my_invites()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id, 'diary_id', i.diary_id, 'role', i.role, 'created_at', i.created_at,
      'invited_by_name', (select m.display_name from curadiario.members m where m.diary_id = i.diary_id and m.user_id = i.invited_by),
      'invited_by_email', (select u.email from auth.users u where u.id = i.invited_by)
    ) order by i.created_at)
    from curadiario.invites i
    where i.email = curadiario.current_email()
      and not exists (select 1 from curadiario.members m where m.diary_id = i.diary_id and m.user_id = v_user)
  ), '[]'::jsonb);
end $$;

create function public.cd_accept_invite(p_invite_id uuid, p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := curadiario.require_user();
  v_invite curadiario.invites;
begin
  select * into v_invite from curadiario.invites where id = p_invite_id and email = curadiario.current_email();
  if not found then raise exception 'invite_not_found'; end if;
  if length(trim(coalesce(p_display_name, ''))) not between 1 and 60 then raise exception 'invalid_input'; end if;
  insert into curadiario.members (diary_id, user_id, role, display_name)
  values (v_invite.diary_id, v_user, v_invite.role, trim(p_display_name))
  on conflict do nothing;
  delete from curadiario.invites where id = p_invite_id;
  return v_invite.diary_id;
end $$;

create function public.cd_decline_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform curadiario.require_user();
  delete from curadiario.invites where id = p_invite_id and email = curadiario.current_email();
  if not found then raise exception 'invite_not_found'; end if;
end $$;

create function public.cd_set_role(p_diary_id uuid, p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  perform curadiario.require_role(p_diary_id, v_user, array['owner']);
  if p_role not in ('writer', 'reader') then raise exception 'invalid_input'; end if;
  update curadiario.members set role = p_role where diary_id = p_diary_id and user_id = p_user_id and role <> 'owner';
  if not found then raise exception 'member_not_found'; end if;
end $$;

-- Removes someone (owner) or leaves (anyone but the owner). Their devices lose this diary's keys,
-- and the owner's app is asked to create the next key version.
create function public.cd_remove_member(p_diary_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  if p_user_id = v_user then
    perform curadiario.require_role(p_diary_id, v_user, array['writer', 'reader']);
  else
    perform curadiario.require_role(p_diary_id, v_user, array['owner']);
  end if;
  delete from curadiario.members where diary_id = p_diary_id and user_id = p_user_id and role <> 'owner';
  if not found then raise exception 'member_not_found'; end if;
  delete from curadiario.key_shares s using curadiario.devices d
  where s.device_id = d.id and s.diary_id = p_diary_id and d.user_id = p_user_id and d.kind = 'browser';
  update curadiario.diaries set needs_rotation = true, updated_at = now() where id = p_diary_id;
end $$;

create function public.cd_set_display_name(p_diary_id uuid, p_display_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  perform curadiario.require_role(p_diary_id, v_user, array['owner', 'writer', 'reader']);
  if length(trim(coalesce(p_display_name, ''))) not between 1 and 60 then raise exception 'invalid_input'; end if;
  update curadiario.members set display_name = trim(p_display_name) where diary_id = p_diary_id and user_id = v_user;
end $$;

-- Entries and topics -----------------------------------------------------

create function public.cd_list_entries(p_diary_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  perform curadiario.require_role(p_diary_id, v_user, array['owner', 'writer', 'reader']);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'author_id', e.author_id, 'key_version', e.key_version, 'payload', e.payload,
      'created_at', e.created_at, 'updated_at', e.updated_at) order by e.created_at desc)
    from (select * from curadiario.entries where diary_id = p_diary_id order by created_at desc limit 2000) e
  ), '[]'::jsonb);
end $$;

-- Creates an entry, or updates one of my own.
create function public.cd_save_entry(p_diary_id uuid, p_entry_id uuid, p_key_version int, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := curadiario.require_user();
  v_current int;
begin
  perform curadiario.require_role(p_diary_id, v_user, array['owner', 'writer']);
  if not curadiario.is_blob(p_payload) then raise exception 'invalid_input'; end if;
  select key_version into v_current from curadiario.diaries where id = p_diary_id;
  if p_key_version <> v_current then raise exception 'stale_key_version'; end if;
  if (select count(*) from curadiario.entries where diary_id = p_diary_id) >= 20000 then raise exception 'diary_full'; end if;

  insert into curadiario.entries (id, diary_id, author_id, key_version, payload)
  values (p_entry_id, p_diary_id, v_user, p_key_version, p_payload)
  on conflict (id) do update set payload = excluded.payload, key_version = excluded.key_version, updated_at = now()
  where curadiario.entries.diary_id = p_diary_id and curadiario.entries.author_id = v_user;
  if not found then raise exception 'not_authorized'; end if;
end $$;

-- The author, or the owner, may delete an entry.
create function public.cd_delete_entry(p_diary_id uuid, p_entry_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := curadiario.require_user();
  v_role text := curadiario.require_role(p_diary_id, v_user, array['owner', 'writer']);
begin
  delete from curadiario.entries
  where id = p_entry_id and diary_id = p_diary_id and (author_id = v_user or v_role = 'owner');
  if not found then raise exception 'not_authorized'; end if;
end $$;

create function public.cd_list_topics(p_diary_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  perform curadiario.require_role(p_diary_id, v_user, array['owner', 'writer', 'reader']);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'author_id', t.author_id, 'key_version', t.key_version, 'payload', t.payload,
      'created_at', t.created_at, 'updated_at', t.updated_at) order by t.created_at desc)
    from (select * from curadiario.topics where diary_id = p_diary_id order by created_at desc limit 500) t
  ), '[]'::jsonb);
end $$;

-- Owners and writers add questions; anyone in the diary can update one (mark it talked about).
create function public.cd_save_topic(p_diary_id uuid, p_topic_id uuid, p_key_version int, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := curadiario.require_user();
  v_role text := curadiario.require_role(p_diary_id, v_user, array['owner', 'writer', 'reader']);
  v_current int;
begin
  if not curadiario.is_blob(p_payload) then raise exception 'invalid_input'; end if;
  select key_version into v_current from curadiario.diaries where id = p_diary_id;
  if p_key_version <> v_current then raise exception 'stale_key_version'; end if;

  if exists (select 1 from curadiario.topics where id = p_topic_id) then
    update curadiario.topics set payload = p_payload, key_version = p_key_version, updated_at = now()
    where id = p_topic_id and diary_id = p_diary_id;
    if not found then raise exception 'not_authorized'; end if;
  else
    if v_role = 'reader' then raise exception 'not_authorized'; end if;
    if (select count(*) from curadiario.topics where diary_id = p_diary_id) >= 2000 then raise exception 'diary_full'; end if;
    insert into curadiario.topics (id, diary_id, author_id, key_version, payload)
    values (p_topic_id, p_diary_id, v_user, p_key_version, p_payload);
  end if;
end $$;

create function public.cd_delete_topic(p_diary_id uuid, p_topic_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := curadiario.require_user();
  v_role text := curadiario.require_role(p_diary_id, v_user, array['owner', 'writer']);
begin
  delete from curadiario.topics
  where id = p_topic_id and diary_id = p_diary_id and (author_id = v_user or v_role = 'owner');
  if not found then raise exception 'not_authorized'; end if;
end $$;

-- Account ----------------------------------------------------------------

-- Deletes my account: diaries I own (with everything in them), my memberships, devices and login.
create function public.cd_delete_account()
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := curadiario.require_user();
begin
  delete from curadiario.diaries where owner_id = v_user;
  update curadiario.diaries set needs_rotation = true
  where id in (select diary_id from curadiario.members where user_id = v_user);
  delete from auth.users where id = v_user;
end $$;

-- Only signed-in people call the RPCs.
revoke execute on function
  public.cd_register_device(jsonb, text), public.cd_list_devices(uuid), public.cd_revoke_device(uuid),
  public.cd_list_diaries(uuid), public.cd_create_diary(uuid, jsonb, text, text, uuid, jsonb, jsonb, jsonb, jsonb),
  public.cd_get_diary(uuid, uuid), public.cd_update_meta(uuid, jsonb, int), public.cd_delete_diary(uuid),
  public.cd_share_keys(uuid, jsonb), public.cd_rotate_key(uuid, int, jsonb, jsonb), public.cd_get_recovery(uuid),
  public.cd_invite(uuid, text, text), public.cd_cancel_invite(uuid), public.cd_list_my_invites(),
  public.cd_accept_invite(uuid, text), public.cd_decline_invite(uuid), public.cd_set_role(uuid, uuid, text),
  public.cd_remove_member(uuid, uuid), public.cd_set_display_name(uuid, text),
  public.cd_list_entries(uuid), public.cd_save_entry(uuid, uuid, int, jsonb), public.cd_delete_entry(uuid, uuid),
  public.cd_list_topics(uuid), public.cd_save_topic(uuid, uuid, int, jsonb), public.cd_delete_topic(uuid, uuid),
  public.cd_delete_account()
from public, anon;

grant execute on function
  public.cd_register_device(jsonb, text), public.cd_list_devices(uuid), public.cd_revoke_device(uuid),
  public.cd_list_diaries(uuid), public.cd_create_diary(uuid, jsonb, text, text, uuid, jsonb, jsonb, jsonb, jsonb),
  public.cd_get_diary(uuid, uuid), public.cd_update_meta(uuid, jsonb, int), public.cd_delete_diary(uuid),
  public.cd_share_keys(uuid, jsonb), public.cd_rotate_key(uuid, int, jsonb, jsonb), public.cd_get_recovery(uuid),
  public.cd_invite(uuid, text, text), public.cd_cancel_invite(uuid), public.cd_list_my_invites(),
  public.cd_accept_invite(uuid, text), public.cd_decline_invite(uuid), public.cd_set_role(uuid, uuid, text),
  public.cd_remove_member(uuid, uuid), public.cd_set_display_name(uuid, text),
  public.cd_list_entries(uuid), public.cd_save_entry(uuid, uuid, int, jsonb), public.cd_delete_entry(uuid, uuid),
  public.cd_list_topics(uuid), public.cd_save_topic(uuid, uuid, int, jsonb), public.cd_delete_topic(uuid, uuid),
  public.cd_delete_account()
to authenticated;
