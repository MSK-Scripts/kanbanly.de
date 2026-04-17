-- Block 2a: username on profiles.
-- Nullable for existing users; new signups must provide one.

alter table public.profiles
  add column if not exists username text;

-- Case-insensitive unique via functional index
create unique index if not exists idx_profiles_username_ci
  on public.profiles (lower(username));

-- Format check: 3-20 chars, lowercase letters, digits, underscore, dash.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_format'
  ) then
    alter table public.profiles
      add constraint profiles_username_format
      check (username is null or username ~ '^[a-z0-9_-]{3,20}$');
  end if;
end$$;

-- Pick up username from auth metadata on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := lower(nullif(trim(new.raw_user_meta_data->>'username'), ''));

  insert into public.profiles (id, email, username)
  values (new.id, new.email, v_username)
  on conflict (id) do nothing;

  insert into public.workspaces (name, owner_id)
  values ('My Workspace', new.id);

  return new;
end;
$$;

-- Public RPC: check if a username is taken (used by register form).
create or replace function public.username_exists(u text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where lower(username) = lower(u)
  );
$$;

grant execute on function public.username_exists(text) to anon, authenticated;

-- Update profiles read policy: the user can still read own profile.
-- Authenticated can also read just (id, username, avatar_url) of others via a view below.
create or replace view public.profiles_public as
  select id, username, avatar_url
  from public.profiles;

grant select on public.profiles_public to authenticated;
