-- ============================================================================
-- kanbanly.de — Consolidated Init Migration
-- Generated: 2026-05-14
-- Quelle: 001_*.sql … 062_*.sql (zusammengefuehrt in Original-Reihenfolge)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 001_profiles.sql
-- ----------------------------------------------------------------------------

-- Profiles table mirrors auth.users for custom fields.
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  avatar_url text,
  locale text default 'de',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 002_workspaces_boards.sql
-- ----------------------------------------------------------------------------

-- Phase 2a: Workspaces, workspace_members, boards, board_members.
-- Helper functions (SECURITY DEFINER) keep RLS non-recursive.

-- ============ TABLES ============

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user on public.workspace_members(user_id);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_boards_workspace on public.boards(workspace_id);

create table if not exists public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer', 'editor', 'admin')),
  added_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index if not exists idx_board_members_user on public.board_members(user_id);

-- ============ HELPER FUNCTIONS ============
-- SECURITY DEFINER => bypass RLS => safe from infinite recursion in policies.

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.workspace_role(ws uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from workspace_members
  where workspace_id = ws and user_id = auth.uid()
  limit 1;
$$;

create or replace function public.can_access_board(b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from boards
    where id = b and (
      is_workspace_member(workspace_id)
      or exists (
        select 1 from board_members
        where board_id = b and user_id = auth.uid()
      )
    )
  );
$$;

-- ============ AUTO-OWNER TRIGGER ============

create or replace function public.add_workspace_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function add_workspace_owner_member();

-- ============ RLS ============

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;

-- workspaces
drop policy if exists "ws_select" on public.workspaces;
create policy "ws_select" on public.workspaces
  for select using (is_workspace_member(id));

drop policy if exists "ws_insert" on public.workspaces;
create policy "ws_insert" on public.workspaces
  for insert with check (auth.uid() = owner_id);

drop policy if exists "ws_update" on public.workspaces;
create policy "ws_update" on public.workspaces
  for update using (workspace_role(id) in ('owner', 'admin'));

drop policy if exists "ws_delete" on public.workspaces;
create policy "ws_delete" on public.workspaces
  for delete using (workspace_role(id) = 'owner');

-- workspace_members
drop policy if exists "wm_select" on public.workspace_members;
create policy "wm_select" on public.workspace_members
  for select using (is_workspace_member(workspace_id));

drop policy if exists "wm_insert" on public.workspace_members;
create policy "wm_insert" on public.workspace_members
  for insert with check (
    workspace_role(workspace_id) in ('owner', 'admin')
    or user_id = auth.uid()
  );

drop policy if exists "wm_update" on public.workspace_members;
create policy "wm_update" on public.workspace_members
  for update using (workspace_role(workspace_id) in ('owner', 'admin'));

drop policy if exists "wm_delete" on public.workspace_members;
create policy "wm_delete" on public.workspace_members
  for delete using (
    workspace_role(workspace_id) in ('owner', 'admin')
    or user_id = auth.uid()
  );

-- boards
drop policy if exists "b_select" on public.boards;
create policy "b_select" on public.boards
  for select using (can_access_board(id));

drop policy if exists "b_insert" on public.boards;
create policy "b_insert" on public.boards
  for insert with check (is_workspace_member(workspace_id));

drop policy if exists "b_update" on public.boards;
create policy "b_update" on public.boards
  for update using (
    workspace_role(workspace_id) in ('owner', 'admin')
    or exists (
      select 1 from board_members
      where board_id = boards.id and user_id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "b_delete" on public.boards;
create policy "b_delete" on public.boards
  for delete using (workspace_role(workspace_id) in ('owner', 'admin'));

-- board_members
drop policy if exists "bm_select" on public.board_members;
create policy "bm_select" on public.board_members
  for select using (can_access_board(board_id));

drop policy if exists "bm_insert" on public.board_members;
create policy "bm_insert" on public.board_members
  for insert with check (
    exists (
      select 1 from boards
      where id = board_id and (
        workspace_role(workspace_id) in ('owner', 'admin')
        or exists (
          select 1 from board_members bm
          where bm.board_id = boards.id and bm.user_id = auth.uid() and bm.role = 'admin'
        )
      )
    )
  );

drop policy if exists "bm_update" on public.board_members;
create policy "bm_update" on public.board_members
  for update using (
    exists (
      select 1 from boards
      where id = board_id and workspace_role(workspace_id) in ('owner', 'admin')
    )
  );

drop policy if exists "bm_delete" on public.board_members;
create policy "bm_delete" on public.board_members
  for delete using (
    exists (
      select 1 from boards
      where id = board_id and workspace_role(workspace_id) in ('owner', 'admin')
    )
    or user_id = auth.uid()
  );


-- ----------------------------------------------------------------------------
-- 003_default_workspace.sql
-- ----------------------------------------------------------------------------

-- Auto-create a default workspace for every new signup.
-- Safe to re-run: replaces the existing handle_new_user function.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_ws_id uuid;
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.workspaces (name, owner_id)
  values ('My Workspace', new.id)
  returning id into new_ws_id;
  -- on_workspace_created trigger adds the owner as a workspace_member.

  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 004_fix_owner_members.sql
-- ----------------------------------------------------------------------------

-- Fix: ensure every workspace owner is present in workspace_members,
-- and recreate the auto-owner trigger idempotently.

-- 1. Backfill missing owner members
insert into public.workspace_members (workspace_id, user_id, role)
select id, owner_id, 'owner'
from public.workspaces
where owner_id is not null
on conflict (workspace_id, user_id) do nothing;

-- 2. Replace trigger function with an idempotent version
create or replace function public.add_workspace_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

-- 3. Ensure trigger is attached
drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.add_workspace_owner_member();


-- ----------------------------------------------------------------------------
-- 005_fix_board_rls.sql
-- ----------------------------------------------------------------------------

-- Bulletproof fix: use direct SQL in RLS, no helper function indirection.
-- Also re-runs the owner backfill to be safe.

-- 1. Backfill owner memberships again (idempotent)
insert into public.workspace_members (workspace_id, user_id, role)
select id, owner_id, 'owner'
from public.workspaces
where owner_id is not null
on conflict (workspace_id, user_id) do nothing;

-- 2. Rewrite board RLS without helper functions
drop policy if exists "b_select" on public.boards;
create policy "b_select" on public.boards
  for select to authenticated
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = boards.workspace_id
        and wm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.board_members bm
      where bm.board_id = boards.id
        and bm.user_id = auth.uid()
    )
  );

drop policy if exists "b_insert" on public.boards;
create policy "b_insert" on public.boards
  for insert to authenticated
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = boards.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "b_update" on public.boards;
create policy "b_update" on public.boards
  for update to authenticated
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = boards.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
    or exists (
      select 1 from public.board_members bm
      where bm.board_id = boards.id
        and bm.user_id = auth.uid()
        and bm.role = 'admin'
    )
  );

drop policy if exists "b_delete" on public.boards;
create policy "b_delete" on public.boards
  for delete to authenticated
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = boards.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );


-- ----------------------------------------------------------------------------
-- 006_invitations.sql
-- ----------------------------------------------------------------------------

-- Phase 2c: Board invitations.
-- Invitee opens /invite/<token>, accepts after (or during) auth, becomes board_member.

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  email text not null,
  board_id uuid references public.boards(id) on delete cascade,
  role text not null check (role in ('viewer', 'editor', 'admin')),
  invited_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz
);

create index if not exists idx_invitations_token on public.invitations(token);
create index if not exists idx_invitations_email on public.invitations(lower(email));

alter table public.invitations enable row level security;

-- Inviter and the target user (by email) can read
drop policy if exists "inv_select" on public.invitations;
create policy "inv_select" on public.invitations
  for select to authenticated
  using (
    invited_by = auth.uid()
    or lower(email) = lower(coalesce((select email from auth.users where id = auth.uid()), ''))
  );

-- Only workspace owner/admin (of the board's workspace) can invite
drop policy if exists "inv_insert" on public.invitations;
create policy "inv_insert" on public.invitations
  for insert to authenticated
  with check (
    board_id is not null
    and exists (
      select 1
      from public.boards b
      join public.workspace_members wm on wm.workspace_id = b.workspace_id
      where b.id = invitations.board_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- Inviter can revoke
drop policy if exists "inv_delete" on public.invitations;
create policy "inv_delete" on public.invitations
  for delete to authenticated
  using (invited_by = auth.uid());

-- Public lookup by token (returns minimal data, usable pre-auth).
create or replace function public.get_invitation_by_token(t text)
returns table (
  id uuid,
  email text,
  board_id uuid,
  role text,
  board_name text,
  workspace_name text,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id, i.email, i.board_id, i.role,
    b.name as board_name,
    w.name as workspace_name,
    i.expires_at, i.accepted_at
  from invitations i
  left join boards b on b.id = i.board_id
  left join workspaces w on w.id = b.workspace_id
  where i.token = t
  limit 1;
$$;

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;

-- Accept: validates email match, adds user as board_member, marks invitation used.
create or replace function public.accept_invitation(t text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitations%rowtype;
  u_email text;
  resulting_board uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select email into u_email from auth.users where id = auth.uid();

  select * into inv
  from invitations
  where token = t
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'invitation_invalid_or_expired';
  end if;

  if lower(inv.email) <> lower(u_email) then
    raise exception 'email_mismatch';
  end if;

  if inv.board_id is not null then
    insert into board_members (board_id, user_id, role)
    values (inv.board_id, auth.uid(), inv.role)
    on conflict (board_id, user_id) do update set role = excluded.role;
    resulting_board := inv.board_id;
  end if;

  update invitations set accepted_at = now() where id = inv.id;

  return resulting_board;
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;


-- ----------------------------------------------------------------------------
-- 007_fix_invite_user_lookup.sql
-- ----------------------------------------------------------------------------

-- Replace auth.users lookups with public.profiles to avoid permission issues.

create or replace function public.accept_invitation(t text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitations%rowtype;
  u_email text;
  resulting_board uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select email into u_email from public.profiles where id = auth.uid();
  if u_email is null then
    raise exception 'profile_missing';
  end if;

  select * into inv
  from invitations
  where token = t
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'invitation_invalid_or_expired';
  end if;

  if lower(inv.email) <> lower(u_email) then
    raise exception 'email_mismatch';
  end if;

  if inv.board_id is not null then
    insert into board_members (board_id, user_id, role)
    values (inv.board_id, auth.uid(), inv.role)
    on conflict (board_id, user_id) do update set role = excluded.role;
    resulting_board := inv.board_id;
  end if;

  update invitations set accepted_at = now() where id = inv.id;

  return resulting_board;
end;
$$;

drop policy if exists "inv_select" on public.invitations;
create policy "inv_select" on public.invitations
  for select to authenticated
  using (
    invited_by = auth.uid()
    or lower(email) = lower(
      coalesce((select email from public.profiles where id = auth.uid()), '')
    )
  );


-- ----------------------------------------------------------------------------
-- 008_board_content.sql
-- ----------------------------------------------------------------------------

-- Phase 2d: lists, cards, tasks + RLS + default lists trigger.

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  title text not null,
  position integer not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_lists_board on public.lists(board_id, position);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  title text not null,
  description text,
  position integer not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_cards_list on public.cards(list_id, position);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position integer not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_tasks_card on public.tasks(card_id, position);

-- ============ HELPERS ============

create or replace function public.can_view_board(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.boards bd
    join public.workspace_members wm on wm.workspace_id = bd.workspace_id
    where bd.id = b and wm.user_id = auth.uid()
  )
  or exists (
    select 1 from public.board_members bm
    where bm.board_id = b and bm.user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_board(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.boards bd
    join public.workspace_members wm on wm.workspace_id = bd.workspace_id
    where bd.id = b and wm.user_id = auth.uid()
  )
  or exists (
    select 1 from public.board_members bm
    where bm.board_id = b
      and bm.user_id = auth.uid()
      and bm.role in ('editor', 'admin')
  );
$$;

create or replace function public.list_board_id(lid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select board_id from public.lists where id = lid;
$$;

create or replace function public.card_board_id(cid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select l.board_id from public.cards c
  join public.lists l on l.id = c.list_id
  where c.id = cid;
$$;

-- ============ DEFAULT LISTS TRIGGER ============

create or replace function public.add_default_lists()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into lists (board_id, title, position) values
    (new.id, 'To Do', 0),
    (new.id, 'In Progress', 1),
    (new.id, 'Done', 2);
  return new;
end;
$$;

drop trigger if exists on_board_created on public.boards;
create trigger on_board_created
  after insert on public.boards
  for each row execute function public.add_default_lists();

-- ============ RLS ============

alter table public.lists enable row level security;
alter table public.cards enable row level security;
alter table public.tasks enable row level security;

-- lists
drop policy if exists "l_select" on public.lists;
create policy "l_select" on public.lists
  for select to authenticated using (public.can_view_board(board_id));

drop policy if exists "l_insert" on public.lists;
create policy "l_insert" on public.lists
  for insert to authenticated with check (public.can_edit_board(board_id));

drop policy if exists "l_update" on public.lists;
create policy "l_update" on public.lists
  for update to authenticated using (public.can_edit_board(board_id));

drop policy if exists "l_delete" on public.lists;
create policy "l_delete" on public.lists
  for delete to authenticated using (public.can_edit_board(board_id));

-- cards
drop policy if exists "c_select" on public.cards;
create policy "c_select" on public.cards
  for select to authenticated using (public.can_view_board(public.list_board_id(list_id)));

drop policy if exists "c_insert" on public.cards;
create policy "c_insert" on public.cards
  for insert to authenticated with check (public.can_edit_board(public.list_board_id(list_id)));

drop policy if exists "c_update" on public.cards;
create policy "c_update" on public.cards
  for update to authenticated using (public.can_edit_board(public.list_board_id(list_id)));

drop policy if exists "c_delete" on public.cards;
create policy "c_delete" on public.cards
  for delete to authenticated using (public.can_edit_board(public.list_board_id(list_id)));

-- tasks
drop policy if exists "t_select" on public.tasks;
create policy "t_select" on public.tasks
  for select to authenticated using (public.can_view_board(public.card_board_id(card_id)));

drop policy if exists "t_insert" on public.tasks;
create policy "t_insert" on public.tasks
  for insert to authenticated with check (public.can_edit_board(public.card_board_id(card_id)));

drop policy if exists "t_update" on public.tasks;
create policy "t_update" on public.tasks
  for update to authenticated using (public.can_edit_board(public.card_board_id(card_id)));

drop policy if exists "t_delete" on public.tasks;
create policy "t_delete" on public.tasks
  for delete to authenticated using (public.can_edit_board(public.card_board_id(card_id)));


-- ----------------------------------------------------------------------------
-- 009_username.sql
-- ----------------------------------------------------------------------------

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


-- ----------------------------------------------------------------------------
-- 010_assignees.sql
-- ----------------------------------------------------------------------------

-- Block 2c: card_assignees + RPC to list a board's members with profile info.

create table if not exists public.card_assignees (
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

create index if not exists idx_card_assignees_user on public.card_assignees(user_id);

alter table public.card_assignees enable row level security;

drop policy if exists "ca_select" on public.card_assignees;
create policy "ca_select" on public.card_assignees
  for select to authenticated
  using (public.can_view_board(public.card_board_id(card_id)));

drop policy if exists "ca_insert" on public.card_assignees;
create policy "ca_insert" on public.card_assignees
  for insert to authenticated
  with check (public.can_edit_board(public.card_board_id(card_id)));

drop policy if exists "ca_delete" on public.card_assignees;
create policy "ca_delete" on public.card_assignees
  for delete to authenticated
  using (public.can_edit_board(public.card_board_id(card_id)));

-- Returns everyone who can view the board: workspace members + board-level guests.
-- Workspace membership wins over board-level membership when both exist.
create or replace function public.board_members_list(b uuid)
returns table (user_id uuid, username text, avatar_url text, role text)
language sql
stable
security definer
set search_path = public
as $$
  with candidates as (
    select p.id as user_id, p.username, p.avatar_url, wm.role, 1 as priority
    from boards bd
    join workspace_members wm on wm.workspace_id = bd.workspace_id
    join profiles p on p.id = wm.user_id
    where bd.id = b and public.can_view_board(b)
    union all
    select p.id, p.username, p.avatar_url, bm.role, 2 as priority
    from board_members bm
    join profiles p on p.id = bm.user_id
    where bm.board_id = b and public.can_view_board(b)
  )
  select distinct on (user_id) user_id, username, avatar_url, role
  from candidates
  order by user_id, priority;
$$;

grant execute on function public.board_members_list(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 011_due_dates.sql
-- ----------------------------------------------------------------------------

-- Block 3b: due dates on cards.
alter table public.cards add column if not exists due_date date;
create index if not exists idx_cards_due_date on public.cards(due_date);


-- ----------------------------------------------------------------------------
-- 012_labels.sql
-- ----------------------------------------------------------------------------

-- Block 3c: labels per board + card_labels junction.

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  color text not null check (color in (
    'rose', 'orange', 'amber', 'emerald', 'teal', 'sky', 'violet', 'pink'
  )),
  created_at timestamptz not null default now()
);

create index if not exists idx_labels_board on public.labels(board_id);

create table if not exists public.card_labels (
  card_id uuid not null references public.cards(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (card_id, label_id)
);

create index if not exists idx_card_labels_label on public.card_labels(label_id);

alter table public.labels enable row level security;
alter table public.card_labels enable row level security;

-- labels
drop policy if exists "lbl_select" on public.labels;
create policy "lbl_select" on public.labels
  for select to authenticated using (public.can_view_board(board_id));

drop policy if exists "lbl_insert" on public.labels;
create policy "lbl_insert" on public.labels
  for insert to authenticated with check (public.can_edit_board(board_id));

drop policy if exists "lbl_update" on public.labels;
create policy "lbl_update" on public.labels
  for update to authenticated using (public.can_edit_board(board_id));

drop policy if exists "lbl_delete" on public.labels;
create policy "lbl_delete" on public.labels
  for delete to authenticated using (public.can_edit_board(board_id));

-- card_labels
drop policy if exists "cl_select" on public.card_labels;
create policy "cl_select" on public.card_labels
  for select to authenticated
  using (public.can_view_board(public.card_board_id(card_id)));

drop policy if exists "cl_insert" on public.card_labels;
create policy "cl_insert" on public.card_labels
  for insert to authenticated
  with check (public.can_edit_board(public.card_board_id(card_id)));

drop policy if exists "cl_delete" on public.card_labels;
create policy "cl_delete" on public.card_labels
  for delete to authenticated
  using (public.can_edit_board(public.card_board_id(card_id)));


-- ----------------------------------------------------------------------------
-- 013_realtime.sql
-- ----------------------------------------------------------------------------

-- Block 6: enable Supabase Realtime on board tables so clients can subscribe
-- to postgres_changes and reconcile state live.

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'lists',
      'cards',
      'tasks',
      'labels',
      'card_assignees',
      'card_labels'
    ])
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        t
      );
    end if;
  end loop;
end
$$;


-- ----------------------------------------------------------------------------
-- 014_slugs.sql
-- ----------------------------------------------------------------------------

-- Block 7: human-readable URL slugs for workspaces + boards.
-- Slugs are stable once assigned (renaming the workspace/board does not
-- change the slug, so existing shared links keep working).

create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'),
      '(^-+|-+$)', '', 'g'
    ),
    ''
  );
$$;

alter table public.workspaces add column if not exists slug text;
alter table public.boards add column if not exists slug text;

-- Backfill: derive slug from name, suffix with row_number on collisions.
with numbered as (
  select
    id,
    coalesce(public.slugify(name), 'workspace') as base,
    row_number() over (
      partition by coalesce(public.slugify(name), 'workspace')
      order by created_at, id
    ) as rn
  from public.workspaces
  where slug is null
)
update public.workspaces w
set slug = case when n.rn = 1 then n.base else n.base || '-' || n.rn end
from numbered n
where w.id = n.id;

with numbered as (
  select
    id,
    coalesce(public.slugify(name), 'board') as base,
    row_number() over (
      partition by coalesce(public.slugify(name), 'board')
      order by created_at, id
    ) as rn
  from public.boards
  where slug is null
)
update public.boards b
set slug = case when n.rn = 1 then n.base else n.base || '-' || n.rn end
from numbered n
where b.id = n.id;

alter table public.workspaces alter column slug set not null;
alter table public.boards alter column slug set not null;

create unique index if not exists idx_workspaces_slug on public.workspaces(slug);
create unique index if not exists idx_boards_slug on public.boards(slug);


-- ----------------------------------------------------------------------------
-- 015_card_activity.sql
-- ----------------------------------------------------------------------------

-- Block 8: per-card activity log. Each mutation on a card writes one row
-- describing what changed, who did it, and when. Consumed by the card modal
-- activity section.

create table if not exists public.card_activity (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'created',
    'renamed',
    'described',
    'due_set',
    'due_cleared',
    'moved',
    'assignee_added',
    'assignee_removed',
    'label_added',
    'label_removed',
    'task_added',
    'task_done',
    'task_undone',
    'task_deleted'
  )),
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_card_activity_card_created
  on public.card_activity(card_id, created_at desc);

alter table public.card_activity enable row level security;

drop policy if exists "ca_select" on public.card_activity;
create policy "ca_select" on public.card_activity
  for select to authenticated
  using (public.can_view_board(public.card_board_id(card_id)));

drop policy if exists "ca_insert" on public.card_activity;
create policy "ca_insert" on public.card_activity
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_edit_board(public.card_board_id(card_id))
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'card_activity'
  ) then
    alter publication supabase_realtime add table public.card_activity;
  end if;
end
$$;


-- ----------------------------------------------------------------------------
-- 016_card_comments.sql
-- ----------------------------------------------------------------------------

-- Block 9: comments per card. Short-form discussion anchored to a card,
-- consumed in the card modal with realtime updates.

create table if not exists public.card_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_card_comments_card_created
  on public.card_comments(card_id, created_at desc);

alter table public.card_comments enable row level security;

drop policy if exists "cc_select" on public.card_comments;
create policy "cc_select" on public.card_comments
  for select to authenticated
  using (public.can_view_board(public.card_board_id(card_id)));

drop policy if exists "cc_insert" on public.card_comments;
create policy "cc_insert" on public.card_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_edit_board(public.card_board_id(card_id))
  );

drop policy if exists "cc_update" on public.card_comments;
create policy "cc_update" on public.card_comments
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "cc_delete" on public.card_comments;
create policy "cc_delete" on public.card_comments
  for delete to authenticated
  using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'card_comments'
  ) then
    alter publication supabase_realtime add table public.card_comments;
  end if;
end
$$;


-- ----------------------------------------------------------------------------
-- 017_username_case.sql
-- ----------------------------------------------------------------------------

-- Allow uppercase letters in usernames.
-- Uniqueness stays case-insensitive (Felix and felix collide) via the
-- existing functional index on lower(username). We just stop normalising
-- the stored casing, so users can present themselves as "Felix".

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-zA-Z0-9_-]{3,20}$');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := nullif(trim(new.raw_user_meta_data->>'username'), '');

  insert into public.profiles (id, email, username)
  values (new.id, new.email, v_username)
  on conflict (id) do nothing;

  insert into public.workspaces (name, owner_id)
  values ('My Workspace', new.id);

  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 018_fix_signup_default_workspace_slug.sql
-- ----------------------------------------------------------------------------

-- Regression fix: the auto-created "My Workspace" on signup didn't set a
-- slug, which has been NOT NULL since migration 014. Every new signup has
-- been failing with "Database error saving new user".

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_ws_name text := 'My Workspace';
  v_base text;
  v_slug text;
begin
  v_username := nullif(trim(new.raw_user_meta_data->>'username'), '');

  insert into public.profiles (id, email, username)
  values (new.id, new.email, v_username)
  on conflict (id) do nothing;

  v_base := coalesce(public.slugify(v_ws_name), 'workspace');
  v_slug := v_base || '-' || substr(replace(new.id::text, '-', ''), 1, 8);

  insert into public.workspaces (name, slug, owner_id)
  values (v_ws_name, v_slug, new.id);

  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 019_drop_default_lists_trigger.sql
-- ----------------------------------------------------------------------------

-- Default-Listen werden jetzt serverseitig in app/(app)/actions.ts
-- auf Deutsch ("To do", "In Arbeit", "Erledigt") eingefügt.
-- Der alte Trigger erzeugte zusätzlich englische Duplikate.

drop trigger if exists on_board_created on public.boards;
drop function if exists public.add_default_lists();


-- ----------------------------------------------------------------------------
-- 020_board_templates.sql
-- ----------------------------------------------------------------------------

-- Block 11: Board-Templates
-- - User kann Boards als Templates speichern (privat oder public)
-- - Neue Boards können aus Template erstellt werden
-- - Built-Ins sind kuratiert, nicht editierbar

create table if not exists public.board_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  cover_emoji text default '📋',
  author_id uuid references auth.users(id) on delete set null,
  is_built_in boolean not null default false,
  is_public boolean not null default false,
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_board_templates_public
  on public.board_templates(is_public, created_at desc)
  where is_public = true;

create index if not exists idx_board_templates_author
  on public.board_templates(author_id);

create table if not exists public.template_labels (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.board_templates(id) on delete cascade,
  name text not null,
  color text not null check (color in (
    'rose', 'orange', 'amber', 'emerald', 'teal', 'sky', 'violet', 'pink'
  ))
);
create index if not exists idx_template_labels_template on public.template_labels(template_id);

create table if not exists public.template_lists (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.board_templates(id) on delete cascade,
  title text not null,
  position integer not null
);
create index if not exists idx_template_lists_template on public.template_lists(template_id, position);

create table if not exists public.template_cards (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.board_templates(id) on delete cascade,
  list_id uuid not null references public.template_lists(id) on delete cascade,
  title text not null,
  description text,
  position integer not null,
  label_ids uuid[] not null default '{}'
);
create index if not exists idx_template_cards_list on public.template_cards(list_id, position);

create table if not exists public.template_tasks (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.template_cards(id) on delete cascade,
  title text not null,
  position integer not null
);
create index if not exists idx_template_tasks_card on public.template_tasks(card_id, position);

-- ============ HELPERS ============

create or replace function public.can_view_template(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.board_templates bt
    where bt.id = t
      and (bt.is_public or bt.is_built_in or bt.author_id = auth.uid())
  );
$$;

create or replace function public.can_edit_template(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.board_templates bt
    where bt.id = t and bt.author_id = auth.uid() and not bt.is_built_in
  );
$$;

create or replace function public.template_card_template_id(cid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select template_id from public.template_cards where id = cid;
$$;

-- ============ RLS ============

alter table public.board_templates enable row level security;
alter table public.template_labels enable row level security;
alter table public.template_lists enable row level security;
alter table public.template_cards enable row level security;
alter table public.template_tasks enable row level security;

-- board_templates
drop policy if exists "bt_select" on public.board_templates;
create policy "bt_select" on public.board_templates
  for select to authenticated
  using (is_public or is_built_in or author_id = auth.uid());

drop policy if exists "bt_insert" on public.board_templates;
create policy "bt_insert" on public.board_templates
  for insert to authenticated
  with check (author_id = auth.uid() and not is_built_in);

drop policy if exists "bt_update" on public.board_templates;
create policy "bt_update" on public.board_templates
  for update to authenticated
  using (author_id = auth.uid() and not is_built_in);

drop policy if exists "bt_delete" on public.board_templates;
create policy "bt_delete" on public.board_templates
  for delete to authenticated
  using (author_id = auth.uid() and not is_built_in);

-- template_labels
drop policy if exists "tl_select" on public.template_labels;
create policy "tl_select" on public.template_labels
  for select to authenticated using (public.can_view_template(template_id));
drop policy if exists "tl_insert" on public.template_labels;
create policy "tl_insert" on public.template_labels
  for insert to authenticated with check (public.can_edit_template(template_id));
drop policy if exists "tl_update" on public.template_labels;
create policy "tl_update" on public.template_labels
  for update to authenticated using (public.can_edit_template(template_id));
drop policy if exists "tl_delete" on public.template_labels;
create policy "tl_delete" on public.template_labels
  for delete to authenticated using (public.can_edit_template(template_id));

-- template_lists
drop policy if exists "tli_select" on public.template_lists;
create policy "tli_select" on public.template_lists
  for select to authenticated using (public.can_view_template(template_id));
drop policy if exists "tli_insert" on public.template_lists;
create policy "tli_insert" on public.template_lists
  for insert to authenticated with check (public.can_edit_template(template_id));
drop policy if exists "tli_update" on public.template_lists;
create policy "tli_update" on public.template_lists
  for update to authenticated using (public.can_edit_template(template_id));
drop policy if exists "tli_delete" on public.template_lists;
create policy "tli_delete" on public.template_lists
  for delete to authenticated using (public.can_edit_template(template_id));

-- template_cards
drop policy if exists "tc_select" on public.template_cards;
create policy "tc_select" on public.template_cards
  for select to authenticated using (public.can_view_template(template_id));
drop policy if exists "tc_insert" on public.template_cards;
create policy "tc_insert" on public.template_cards
  for insert to authenticated with check (public.can_edit_template(template_id));
drop policy if exists "tc_update" on public.template_cards;
create policy "tc_update" on public.template_cards
  for update to authenticated using (public.can_edit_template(template_id));
drop policy if exists "tc_delete" on public.template_cards;
create policy "tc_delete" on public.template_cards
  for delete to authenticated using (public.can_edit_template(template_id));

-- template_tasks (indirect via template_cards)
drop policy if exists "tt_select" on public.template_tasks;
create policy "tt_select" on public.template_tasks
  for select to authenticated
  using (public.can_view_template(public.template_card_template_id(card_id)));
drop policy if exists "tt_insert" on public.template_tasks;
create policy "tt_insert" on public.template_tasks
  for insert to authenticated
  with check (public.can_edit_template(public.template_card_template_id(card_id)));
drop policy if exists "tt_update" on public.template_tasks;
create policy "tt_update" on public.template_tasks
  for update to authenticated
  using (public.can_edit_template(public.template_card_template_id(card_id)));
drop policy if exists "tt_delete" on public.template_tasks;
create policy "tt_delete" on public.template_tasks
  for delete to authenticated
  using (public.can_edit_template(public.template_card_template_id(card_id)));

-- ============ BUILT-IN TEMPLATES ============
-- Ein Setup-Block mit einem Minimal-Sprint-Template, damit User direkt
-- was zum Ausprobieren haben.

do $$
declare
  t_id uuid;
  l_todo uuid;
  l_doing uuid;
  l_review uuid;
  l_done uuid;
  lbl_feature uuid;
  lbl_bug uuid;
  lbl_docs uuid;
begin
  if not exists (select 1 from public.board_templates where slug = 'sprint-scrum') then
    insert into public.board_templates (slug, title, description, cover_emoji, is_built_in, is_public)
    values (
      'sprint-scrum',
      'Sprint / Scrum',
      'Klassisches Scrum-Board mit Backlog, In Arbeit, Review, Erledigt. Drei Standard-Labels für Feature, Bug, Docs.',
      '🏃',
      true, true
    ) returning id into t_id;

    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Feature', 'violet') returning id into lbl_feature;
    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Bug', 'rose') returning id into lbl_bug;
    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Docs', 'sky') returning id into lbl_docs;

    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Backlog', 0) returning id into l_todo;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'In Arbeit', 1) returning id into l_doing;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Review', 2) returning id into l_review;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Erledigt', 3) returning id into l_done;

    insert into public.template_cards (template_id, list_id, title, description, position, label_ids) values
      (t_id, l_todo, 'Sprint-Ziel definieren', 'Ein Satz pro Sprint, der das Ziel beschreibt.', 0, array[lbl_docs]),
      (t_id, l_todo, 'User-Story 1', null, 1, array[lbl_feature]),
      (t_id, l_doing, 'Sprint-Setup', 'Board konfigurieren und Ziel festlegen.', 0, array[lbl_docs]);
  end if;

  if not exists (select 1 from public.board_templates where slug = 'content-kalender') then
    insert into public.board_templates (slug, title, description, cover_emoji, is_built_in, is_public)
    values (
      'content-kalender',
      'Content-Kalender',
      'Redaktionsplanung für Blog, Newsletter oder Social. Von Idee bis Veröffentlichung.',
      '✍️',
      true, true
    ) returning id into t_id;

    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Blog', 'emerald') returning id into lbl_feature;
    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Social', 'sky') returning id into lbl_bug;
    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Newsletter', 'amber') returning id into lbl_docs;

    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Ideen', 0) returning id into l_todo;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'In Arbeit', 1) returning id into l_doing;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Review', 2) returning id into l_review;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Veröffentlicht', 3) returning id into l_done;

    insert into public.template_cards (template_id, list_id, title, description, position, label_ids) values
      (t_id, l_todo, 'Themen-Brainstorm', 'Sammle erstmal alle Ideen — filtern kommt später.', 0, array[]::uuid[]),
      (t_id, l_todo, 'Launch-Ankündigung', null, 1, array[lbl_feature, lbl_bug]);
  end if;

  if not exists (select 1 from public.board_templates where slug = 'personal-gtd') then
    insert into public.board_templates (slug, title, description, cover_emoji, is_built_in, is_public)
    values (
      'personal-gtd',
      'Personal GTD',
      'Getting Things Done für dich allein: Inbox, Heute, Diese Woche, Warten-auf, Erledigt.',
      '🎯',
      true, true
    ) returning id into t_id;

    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Wichtig', 'rose') returning id into lbl_feature;
    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Routine', 'teal') returning id into lbl_bug;

    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Inbox', 0) returning id into l_todo;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Heute', 1) returning id into l_doing;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Diese Woche', 2) returning id into l_review;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Erledigt', 3) returning id into l_done;
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 021_invitations_visible_to_admins.sql
-- ----------------------------------------------------------------------------

-- Block 12: workspace-owner/admin eines Boards soll alle Einladungen für
-- dieses Board sehen können (nicht nur die selbst versendeten), damit die
-- "Ausstehende"-Liste im MembersDialog vollständig ist.

drop policy if exists "inv_select" on public.invitations;
create policy "inv_select" on public.invitations
  for select to authenticated
  using (
    invited_by = auth.uid()
    or lower(email) = lower(coalesce((select email from auth.users where id = auth.uid()), ''))
    or (
      board_id is not null
      and exists (
        select 1
        from public.boards b
        join public.workspace_members wm on wm.workspace_id = b.workspace_id
        where b.id = invitations.board_id
          and wm.user_id = auth.uid()
          and wm.role in ('owner', 'admin')
      )
    )
  );

-- Workspace owner/admin können auch widerrufen (nicht nur der Absender).
drop policy if exists "inv_delete" on public.invitations;
create policy "inv_delete" on public.invitations
  for delete to authenticated
  using (
    invited_by = auth.uid()
    or (
      board_id is not null
      and exists (
        select 1
        from public.boards b
        join public.workspace_members wm on wm.workspace_id = b.workspace_id
        where b.id = invitations.board_id
          and wm.user_id = auth.uid()
          and wm.role in ('owner', 'admin')
      )
    )
  );


-- ----------------------------------------------------------------------------
-- 022_accept_invitation_trim.sql
-- ----------------------------------------------------------------------------

-- Block 12b: email_mismatch beim Annehmen von Einladungen trotz gleicher
-- E-Mail. Grund: auth.users.email wird nicht garantiert lowercased oder
-- kann trailing whitespace haben. Wir trimmen + lowern jetzt beide Seiten.

create or replace function public.accept_invitation(t text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitations%rowtype;
  u_email text;
  resulting_board uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select email into u_email from auth.users where id = auth.uid();

  select * into inv
  from invitations
  where token = t
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'invitation_invalid_or_expired';
  end if;

  if lower(btrim(coalesce(inv.email, ''))) <> lower(btrim(coalesce(u_email, ''))) then
    raise exception 'email_mismatch';
  end if;

  if inv.board_id is not null then
    insert into board_members (board_id, user_id, role)
    values (inv.board_id, auth.uid(), inv.role)
    on conflict (board_id, user_id) do update set role = excluded.role;
    resulting_board := inv.board_id;
  end if;

  update invitations set accepted_at = now() where id = inv.id;

  return resulting_board;
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;


-- ----------------------------------------------------------------------------
-- 023_recovery_codes.sql
-- ----------------------------------------------------------------------------

-- Block 13: Recovery-Codes statt E-Mail-basiertem Passwort-Reset.
-- Bei Signup werden 8 Codes erzeugt und nur deren SHA-256-Hash gespeichert.
-- Zum Reset tauscht der User (email, code, neues Passwort).

create table if not exists public.recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_recovery_codes_user
  on public.recovery_codes(user_id, used_at);

create index if not exists idx_recovery_codes_hash
  on public.recovery_codes(code_hash);

alter table public.recovery_codes enable row level security;

-- Eigene Codes sehen (nur id + used_at — nie den Hash)
drop policy if exists "rc_select" on public.recovery_codes;
create policy "rc_select" on public.recovery_codes
  for select to authenticated
  using (user_id = auth.uid());

-- Inserts + updates laufen ausschließlich über die Service-Role (Server).
-- Kein RLS-Insert/Update für authenticated.

-- Redeem-RPC: Pre-auth callable. Vergleicht (email, code_hash) gegen einen
-- unbenutzten Eintrag, markiert ihn bei Treffer als verbraucht und gibt die
-- user_id zurück. Sonst null.
create or replace function public.redeem_recovery_code(
  p_email text,
  p_code_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  u_id uuid;
  rc_id uuid;
begin
  select id into u_id
  from auth.users
  where lower(btrim(email)) = lower(btrim(p_email))
  limit 1;

  if u_id is null then
    return null;
  end if;

  select id into rc_id
  from public.recovery_codes
  where user_id = u_id
    and code_hash = p_code_hash
    and used_at is null
  limit 1;

  if rc_id is null then
    return null;
  end if;

  update public.recovery_codes
  set used_at = now()
  where id = rc_id;

  return u_id;
end;
$$;

grant execute on function public.redeem_recovery_code(text, text)
  to anon, authenticated;

-- Helper für Status-Anzeige später: Anzahl unbenutzter Codes für den User.
create or replace function public.count_unused_recovery_codes()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.recovery_codes
  where user_id = auth.uid() and used_at is null;
$$;

grant execute on function public.count_unused_recovery_codes()
  to authenticated;


-- ----------------------------------------------------------------------------
-- 024_board_webhooks.sql
-- ----------------------------------------------------------------------------

-- Block 14: Discord-Webhooks pro Board.
-- Events (card_created, card_moved) werden serverseitig an die URL
-- gepostet. URL ist sensitiv und nur für Editor/Admin des Boards sichtbar.

create table if not exists public.board_webhooks (
  board_id uuid primary key references public.boards(id) on delete cascade,
  discord_url text not null,
  enabled boolean not null default true,
  events text[] not null default array[
    'card_created',
    'card_moved'
  ]::text[],
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.board_webhooks enable row level security;

drop policy if exists "bwh_select" on public.board_webhooks;
create policy "bwh_select" on public.board_webhooks
  for select to authenticated
  using (public.can_edit_board(board_id));

drop policy if exists "bwh_insert" on public.board_webhooks;
create policy "bwh_insert" on public.board_webhooks
  for insert to authenticated
  with check (public.can_edit_board(board_id));

drop policy if exists "bwh_update" on public.board_webhooks;
create policy "bwh_update" on public.board_webhooks
  for update to authenticated
  using (public.can_edit_board(board_id));

drop policy if exists "bwh_delete" on public.board_webhooks;
create policy "bwh_delete" on public.board_webhooks
  for delete to authenticated
  using (public.can_edit_board(board_id));


-- ----------------------------------------------------------------------------
-- 025_admin.sql
-- ----------------------------------------------------------------------------

-- Block 15: Admin-Panel. Flag auf profiles, damit /admin nur für
-- berechtigte User lädt. Abfragen selbst laufen serverseitig mit
-- Service-Role, daher kein zusätzliches RLS nötig.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Felix ist Admin.
update public.profiles
set is_admin = true
where id in (
  select id from auth.users
  where lower(email) = lower('felixfranzen5@gmail.com')
);


-- ----------------------------------------------------------------------------
-- 026_board_backgrounds.sql
-- ----------------------------------------------------------------------------

-- Block 16: Hintergrundbild pro Board. URL-basiert (Unsplash, eigener
-- Server, etc.). Wird für alle Board-Mitglieder identisch gerendert.

alter table public.boards
  add column if not exists background_url text;


-- ----------------------------------------------------------------------------
-- 027_card_archive.sql
-- ----------------------------------------------------------------------------

-- Block 17: Karten archivieren statt löschen. Archivierte Karten
-- bleiben in der DB erhalten und können wiederhergestellt werden.
-- Hard-Delete bleibt möglich (z.B. für Bulk-Delete oder Datenschutz).

alter table public.cards
  add column if not exists archived_at timestamptz;

create index if not exists cards_archived_at_idx
  on public.cards (archived_at)
  where archived_at is not null;

create index if not exists cards_active_idx
  on public.cards (list_id, position)
  where archived_at is null;


-- ----------------------------------------------------------------------------
-- 028_list_wip_limit.sql
-- ----------------------------------------------------------------------------

-- Block 18: Optionales WIP-Limit pro Liste (klassisches Kanban). Wenn
-- gesetzt, zeigt die UI die aktive Kartenanzahl gegen das Limit (z. B.
-- 5/3) und warnt visuell wenn überschritten. Soft-Constraint — Karten
-- können trotzdem hinzugefügt werden, aber das Team sieht den Druck.

alter table public.lists
  add column if not exists wip_limit int;

alter table public.lists
  add constraint lists_wip_limit_positive
  check (wip_limit is null or wip_limit > 0);


-- ----------------------------------------------------------------------------
-- 029_automations.sql
-- ----------------------------------------------------------------------------

-- Block 19: Automations (Butler-Light). Pro Board lassen sich Regeln
-- definieren: "Wenn Karte in Liste X landet, dann Action Y". Aktuell
-- nur ein Trigger-Typ (card-moved-to-list) und ein paar Actions, aber
-- das Schema ist offen für Erweiterungen über die jsonb-Configs.

create table if not exists public.board_automations (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  trigger_kind text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  action_kind text not null,
  action_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists board_automations_board_idx
  on public.board_automations (board_id);

alter table public.board_automations enable row level security;

drop policy if exists "ba_select" on public.board_automations;
create policy "ba_select" on public.board_automations
  for select to authenticated
  using (public.can_view_board(board_id));

drop policy if exists "ba_insert" on public.board_automations;
create policy "ba_insert" on public.board_automations
  for insert to authenticated
  with check (public.can_edit_board(board_id));

drop policy if exists "ba_update" on public.board_automations;
create policy "ba_update" on public.board_automations
  for update to authenticated
  using (public.can_edit_board(board_id));

drop policy if exists "ba_delete" on public.board_automations;
create policy "ba_delete" on public.board_automations
  for delete to authenticated
  using (public.can_edit_board(board_id));


-- ----------------------------------------------------------------------------
-- 030_custom_fields.sql
-- ----------------------------------------------------------------------------

-- Block 20: Custom Fields. Pro Board lassen sich eigene Felder
-- definieren (Text, Zahl, Datum, Dropdown). Die Werte werden pro Karte
-- gespeichert. Werte sind als jsonb abgelegt — flexibel ohne weitere
-- Migrations beim Hinzufügen neuer Field-Kinds.

create table if not exists public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('text', 'number', 'date', 'dropdown')),
  options jsonb not null default '[]'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists custom_fields_board_idx
  on public.custom_fields (board_id, position);

alter table public.custom_fields enable row level security;

drop policy if exists "cf_select" on public.custom_fields;
create policy "cf_select" on public.custom_fields
  for select to authenticated
  using (public.can_view_board(board_id));

drop policy if exists "cf_insert" on public.custom_fields;
create policy "cf_insert" on public.custom_fields
  for insert to authenticated
  with check (public.can_edit_board(board_id));

drop policy if exists "cf_update" on public.custom_fields;
create policy "cf_update" on public.custom_fields
  for update to authenticated
  using (public.can_edit_board(board_id));

drop policy if exists "cf_delete" on public.custom_fields;
create policy "cf_delete" on public.custom_fields
  for delete to authenticated
  using (public.can_edit_board(board_id));

create table if not exists public.card_field_values (
  card_id uuid not null references public.cards(id) on delete cascade,
  field_id uuid not null references public.custom_fields(id) on delete cascade,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (card_id, field_id)
);

create index if not exists card_field_values_card_idx
  on public.card_field_values (card_id);

alter table public.card_field_values enable row level security;

-- Helper: read the board id for a card via its list, then check perms
drop policy if exists "cfv_select" on public.card_field_values;
create policy "cfv_select" on public.card_field_values
  for select to authenticated
  using (
    public.can_view_board(
      public.list_board_id(
        (select list_id from public.cards where id = card_field_values.card_id)
      )
    )
  );

drop policy if exists "cfv_write" on public.card_field_values;
create policy "cfv_write" on public.card_field_values
  for all to authenticated
  using (
    public.can_edit_board(
      public.list_board_id(
        (select list_id from public.cards where id = card_field_values.card_id)
      )
    )
  )
  with check (
    public.can_edit_board(
      public.list_board_id(
        (select list_id from public.cards where id = card_field_values.card_id)
      )
    )
  );


-- ----------------------------------------------------------------------------
-- 031_card_links.sql
-- ----------------------------------------------------------------------------

-- Block 21: Linked Cards. Ungerichtete Verknüpfungen zwischen Karten
-- ("hängt zusammen mit", "blockiert", etc.). Aktuell nur 'related',
-- das Schema ist offen für weitere kinds.

create table if not exists public.card_links (
  from_card_id uuid not null references public.cards(id) on delete cascade,
  to_card_id uuid not null references public.cards(id) on delete cascade,
  kind text not null default 'related',
  created_at timestamptz not null default now(),
  primary key (from_card_id, to_card_id, kind),
  check (from_card_id <> to_card_id)
);

create index if not exists card_links_to_idx on public.card_links (to_card_id, kind);
create index if not exists card_links_from_idx on public.card_links (from_card_id, kind);

alter table public.card_links enable row level security;

-- Eine Verknüpfung ist sichtbar, wenn man eine der beiden Karten sehen darf.
drop policy if exists "cl_select" on public.card_links;
create policy "cl_select" on public.card_links
  for select to authenticated
  using (
    public.can_view_board(
      public.list_board_id(
        (select list_id from public.cards where id = card_links.from_card_id)
      )
    )
    or public.can_view_board(
      public.list_board_id(
        (select list_id from public.cards where id = card_links.to_card_id)
      )
    )
  );

-- Anlegen / löschen darf, wer beide Karten editieren kann.
drop policy if exists "cl_write" on public.card_links;
create policy "cl_write" on public.card_links
  for all to authenticated
  using (
    public.can_edit_board(
      public.list_board_id(
        (select list_id from public.cards where id = card_links.from_card_id)
      )
    )
    and public.can_edit_board(
      public.list_board_id(
        (select list_id from public.cards where id = card_links.to_card_id)
      )
    )
  )
  with check (
    public.can_edit_board(
      public.list_board_id(
        (select list_id from public.cards where id = card_links.from_card_id)
      )
    )
    and public.can_edit_board(
      public.list_board_id(
        (select list_id from public.cards where id = card_links.to_card_id)
      )
    )
  );


-- ----------------------------------------------------------------------------
-- 032_subscriptions_notifications.sql
-- ----------------------------------------------------------------------------

-- Block 22: Card Subscriptions + Notifications.
--
-- card_subscribers: User die über Änderungen einer Karte informiert
-- werden wollen (auch ohne Assignee zu sein). Bei Assignment + bei
-- eigenen Kommentaren wird automatisch subscribed.
--
-- notifications: Persistente, per-User Benachrichtigungen mit
-- jsonb-Payload, damit das Schema flexibel bleibt.

create table if not exists public.card_subscribers (
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

create index if not exists card_subscribers_user_idx
  on public.card_subscribers (user_id);

alter table public.card_subscribers enable row level security;

drop policy if exists "cs_select" on public.card_subscribers;
create policy "cs_select" on public.card_subscribers
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_view_board(
      public.list_board_id(
        (select list_id from public.cards where id = card_subscribers.card_id)
      )
    )
  );

-- User darf nur sich selbst (un)subscriben.
drop policy if exists "cs_write" on public.card_subscribers;
create policy "cs_write" on public.card_subscribers
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.can_view_board(
      public.list_board_id(
        (select list_id from public.cards where id = card_subscribers.card_id)
      )
    )
  );

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  card_id uuid references public.cards(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "n_select" on public.notifications;
create policy "n_select" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "n_update" on public.notifications;
create policy "n_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "n_delete" on public.notifications;
create policy "n_delete" on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- Insert: nur wenn der Empfänger ebenfalls Zugriff aufs Board hat und
-- der Actor (=auth.uid()) auch. Ohne den ersten Check könnte jeder
-- Workspace-Mitglied jedem anderen Mitglied beliebige Notifications
-- unterjubeln — Phishing-Vektor. Mit dem Check müssen sowohl Sender
-- als auch Empfänger zur Board-Membership gehören.
drop policy if exists "n_insert" on public.notifications;
create policy "n_insert" on public.notifications
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and (
      card_id is null
      or (
        public.can_view_board(
          public.list_board_id(
            (select list_id from public.cards where id = notifications.card_id)
          )
        )
        and exists (
          select 1
          from public.cards c
          where c.id = notifications.card_id
            and (
              -- Empfänger muss das Board ebenfalls sehen können.
              -- Wir prüfen das über workspace_members oder board_members.
              exists (
                select 1 from public.workspace_members wm
                join public.boards b on b.workspace_id = wm.workspace_id
                join public.lists l on l.board_id = b.id
                where l.id = c.list_id and wm.user_id = notifications.user_id
              )
              or exists (
                select 1 from public.board_members bm
                join public.lists l on l.board_id = bm.board_id
                where l.id = c.list_id and bm.user_id = notifications.user_id
              )
            )
        )
      )
    )
  );


-- ----------------------------------------------------------------------------
-- 033_realtime_extras.sql
-- ----------------------------------------------------------------------------

-- Block 23: Realtime auch für die neuen Tabellen aktivieren
-- (board_automations, custom_fields, card_field_values, card_links).
-- card_subscribers + notifications sind user-scoped — die Realtime-
-- Subscription dafür macht NotificationsBell selbst (per-user filter),
-- nicht der board-scope Channel.

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'board_automations',
      'custom_fields',
      'card_field_values',
      'card_links',
      'notifications'
    ])
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        t
      );
    end if;
  end loop;
end
$$;


-- ----------------------------------------------------------------------------
-- 034_username_spaces.sql
-- ----------------------------------------------------------------------------

-- Block 24: Erlaube Leerzeichen und deutsche Umlaute im Username
-- (z.B. "Felix Müller", "Björn", "Strauß"). Trim und Single-Space-
-- Compaction wird im App-Layer erzwungen — hier erweitern wir nur
-- den Format-Check.

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (
    username is null
    or (
      username ~ '^[a-zA-ZäöüÄÖÜß0-9_ -]{3,20}$'
      and username !~ '^ '
      and username !~ ' $'
      and username !~ '  '
    )
  );


-- ----------------------------------------------------------------------------
-- 035_bot_schema.sql
-- ----------------------------------------------------------------------------

-- Block 15: Discord-Bot — initiales Schema.
-- Pro-Guild-Konfiguration und Verknüpfung zu Kanbanly-Usern.
-- Erweiterungen (Levels, Mod-Logs, Reaction Roles, Warnings) folgen
-- in späteren Migrations (036+).

create table if not exists public.bot_guilds (
  guild_id text primary key,
  owner_id text not null,
  name text,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Feature-Toggles (Phase 2+)
  welcome_enabled boolean not null default false,
  welcome_channel_id text,
  welcome_message text,
  log_channel_id text,

  -- Verknüpfung zu Kanbanly-User (für Web-Dashboard).
  -- Ein User kann mehrere Guilds verwalten, eine Guild hat eine Owner-Verknüpfung.
  linked_user_id uuid references auth.users(id) on delete set null
);

create index if not exists bot_guilds_linked_user_id_idx
  on public.bot_guilds (linked_user_id)
  where linked_user_id is not null;

-- Service-Role umgeht RLS, aber Defense-in-Depth: RLS aktivieren.
alter table public.bot_guilds enable row level security;

-- Web-Dashboard: User darf seine verknüpften Guilds lesen.
drop policy if exists bot_guilds_select_linked on public.bot_guilds;
create policy bot_guilds_select_linked
  on public.bot_guilds for select
  using (linked_user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 036_bot_phase2.sql
-- ----------------------------------------------------------------------------

-- Block 15 · Phase 2: Welcome-Messages + Reaction Roles.
-- bot_guilds.welcome_* existiert bereits in 035 — hier nur Reaction-Role-Schema.

create table if not exists public.bot_reaction_role_messages (
  message_id text primary key,
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  title text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists bot_rr_messages_guild_idx
  on public.bot_reaction_role_messages (guild_id);

-- emoji_key: für Unicode der Char selbst, für Custom-Emojis die Snowflake-ID.
-- emoji_display: das, was wir wieder rausrendern (Unicode-Char oder <:name:id>).
create table if not exists public.bot_reaction_roles (
  message_id text not null references public.bot_reaction_role_messages(message_id) on delete cascade,
  emoji_key text not null,
  emoji_display text not null,
  role_id text not null,
  label text,
  primary key (message_id, emoji_key)
);

create index if not exists bot_rr_message_idx
  on public.bot_reaction_roles (message_id);

alter table public.bot_reaction_role_messages enable row level security;
alter table public.bot_reaction_roles enable row level security;

-- Web-Dashboard: User sieht RR-Messages seiner verknüpften Guilds.
drop policy if exists bot_rr_messages_select_linked on public.bot_reaction_role_messages;
create policy bot_rr_messages_select_linked
  on public.bot_reaction_role_messages for select
  using (
    exists (
      select 1 from public.bot_guilds g
      where g.guild_id = bot_reaction_role_messages.guild_id
        and g.linked_user_id = auth.uid()
    )
  );

drop policy if exists bot_rr_select_linked on public.bot_reaction_roles;
create policy bot_rr_select_linked
  on public.bot_reaction_roles for select
  using (
    exists (
      select 1
      from public.bot_reaction_role_messages m
      join public.bot_guilds g on g.guild_id = m.guild_id
      where m.message_id = bot_reaction_roles.message_id
        and g.linked_user_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 037_bot_user_connections.sql
-- ----------------------------------------------------------------------------

-- Block 15 · Discord-Connect für das Web-Dashboard.
-- Pro Kanbanly-User eine Discord-OAuth-Verknüpfung.

create table if not exists public.bot_user_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_user_id text not null unique,
  discord_username text,
  -- Tokens sind sensibel — Zugriff ausschließlich über Service-Role (Server-Side).
  -- RLS verbietet jedem normalen User das Auslesen.
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bot_user_connections enable row level security;

-- Standard-User können NICHT auf Tokens zugreifen — Service-Role-Bypass nur im Server-Action-Layer.
-- Eine read-only Policy für die eigenen Metadaten (ohne Tokens) wäre über eine View möglich;
-- für MVP greifen wir aus Server-Components mit dem Admin-Client zu und exponieren nur, was gebraucht wird.

-- Bot-Guild → User-Verknüpfung: Hilfsspalte ist schon in bot_guilds.linked_user_id (Migration 035).
-- Hier nur ein Index für Lookups via discord_user_id.
create index if not exists bot_user_connections_discord_user_id_idx
  on public.bot_user_connections (discord_user_id);


-- ----------------------------------------------------------------------------
-- 038_bot_autoroles.sql
-- ----------------------------------------------------------------------------

-- Block 25: Bot — Auto-Roles.
-- Eine (oder mehrere) Rollen, die jedem neu beigetretenen Member
-- automatisch zugewiesen werden. Als jsonb-Array für Mehrfach-
-- Auto-Roles, ohne weitere Tabelle.

alter table public.bot_guilds
  add column if not exists auto_role_ids jsonb not null default '[]'::jsonb,
  add column if not exists auto_roles_enabled boolean not null default false;


-- ----------------------------------------------------------------------------
-- 039_bot_moderation.sql
-- ----------------------------------------------------------------------------

-- Block 26: Bot — Moderation.
-- Warn-Historie pro Guild. Kicks/Bans/Timeouts brauchen keine
-- eigene Tabelle — Discord's Audit-Log hält das fest.

create table if not exists public.bot_warnings (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  moderator_id text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists bot_warnings_guild_user_idx
  on public.bot_warnings (guild_id, user_id, created_at desc);

create index if not exists bot_warnings_guild_idx
  on public.bot_warnings (guild_id, created_at desc);

alter table public.bot_warnings enable row level security;

-- Web-Dashboard: User sieht Warnings nur für seine verknüpften Guilds.
drop policy if exists bot_warnings_select_linked on public.bot_warnings;
create policy bot_warnings_select_linked
  on public.bot_warnings for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_warnings.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 040_bot_logging.sql
-- ----------------------------------------------------------------------------

-- Block 27: Bot — Logging.
-- log_channel_id existiert bereits seit 035. Hier ergänzen wir die
-- per-Event-Toggles, damit Server entscheiden können was geloggt wird.

alter table public.bot_guilds
  add column if not exists log_joins boolean not null default false,
  add column if not exists log_leaves boolean not null default false,
  add column if not exists log_message_edits boolean not null default false,
  add column if not exists log_message_deletes boolean not null default false,
  add column if not exists log_role_changes boolean not null default false;


-- ----------------------------------------------------------------------------
-- 041_bot_leveling.sql
-- ----------------------------------------------------------------------------

-- Block 28: Bot — Leveling / XP-System.
-- Pro Guild + User wird XP gesammelt. Server-Admins können Rollen
-- für bestimmte Levels vergeben (Level-Rewards) und ankündigen lassen.

-- XP pro Guild × User.
create table if not exists public.bot_xp (
  guild_id text not null,
  user_id text not null,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 0 check (level >= 0),
  last_message_at timestamptz,
  primary key (guild_id, user_id)
);

create index if not exists bot_xp_guild_rank_idx
  on public.bot_xp (guild_id, xp desc);

alter table public.bot_xp enable row level security;

drop policy if exists bot_xp_select_linked on public.bot_xp;
create policy bot_xp_select_linked
  on public.bot_xp for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_xp.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );

-- Level → Rolle Mapping pro Guild.
create table if not exists public.bot_level_rewards (
  guild_id text not null,
  level integer not null check (level > 0),
  role_id text not null,
  primary key (guild_id, level)
);

create index if not exists bot_level_rewards_guild_idx
  on public.bot_level_rewards (guild_id, level);

alter table public.bot_level_rewards enable row level security;

drop policy if exists bot_level_rewards_select_linked on public.bot_level_rewards;
create policy bot_level_rewards_select_linked
  on public.bot_level_rewards for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_level_rewards.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );

-- Toggles pro Guild.
alter table public.bot_guilds
  add column if not exists level_enabled boolean not null default false,
  add column if not exists level_up_channel_id text,
  add column if not exists level_announce boolean not null default true;


-- ----------------------------------------------------------------------------
-- 042_bot_tags.sql
-- ----------------------------------------------------------------------------

-- Block 29: Bot — Tags (FAQ-Quick-Antworten).
-- Pro Guild definiert; jeder mit ManageMessages kann anlegen/ändern,
-- aber jeder Server-Member kann sie abrufen.

create table if not exists public.bot_tags (
  guild_id text not null,
  name text not null,
  content text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uses integer not null default 0,
  primary key (guild_id, name),
  check (length(name) between 1 and 32),
  check (name ~ '^[a-z0-9_-]+$'),
  check (length(content) between 1 and 2000)
);

create index if not exists bot_tags_guild_idx
  on public.bot_tags (guild_id, name);

alter table public.bot_tags enable row level security;

drop policy if exists bot_tags_select_linked on public.bot_tags;
create policy bot_tags_select_linked
  on public.bot_tags for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_tags.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 043_bot_custom_commands.sql
-- ----------------------------------------------------------------------------

-- Block 30: Bot — Custom Commands.
-- User-definierte Prefix-Trigger im Chat (z. B. !rules → Antwort).
-- Im Gegensatz zu Tags wird hier kein Slash-Command genutzt, sondern
-- direkt auf MessageCreate gehört.

create table if not exists public.bot_custom_commands (
  guild_id text not null,
  trigger text not null,
  response text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uses integer not null default 0,
  primary key (guild_id, trigger),
  check (length(trigger) between 1 and 32),
  check (trigger ~ '^[a-z0-9_-]+$'),
  check (length(response) between 1 and 2000)
);

create index if not exists bot_custom_commands_guild_idx
  on public.bot_custom_commands (guild_id);

alter table public.bot_custom_commands enable row level security;

drop policy if exists bot_custom_commands_select_linked on public.bot_custom_commands;
create policy bot_custom_commands_select_linked
  on public.bot_custom_commands for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_custom_commands.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );

-- Prefix pro Guild (default !).
alter table public.bot_guilds
  add column if not exists command_prefix text not null default '!'
  check (length(command_prefix) between 1 and 3);


-- ----------------------------------------------------------------------------
-- 044_bot_automod.sql
-- ----------------------------------------------------------------------------

-- Block 31: Bot — AutoMod.
-- Per-Guild Spam-/Link-/Caps-/Mention-Filter mit automatischer
-- Message-Löschung + DM-Warnung an den User.
-- Banned-Words als jsonb-Array, Link-Whitelist als jsonb-Array.

alter table public.bot_guilds
  add column if not exists automod_enabled boolean not null default false,
  -- Link-Filter
  add column if not exists automod_block_links boolean not null default false,
  add column if not exists automod_link_allowlist jsonb not null default '[]'::jsonb,
  -- Caps-Filter (z.B. 70 = 70% Großbuchstaben in min 10-Zeichen-Messages)
  add column if not exists automod_max_caps_pct integer
    check (automod_max_caps_pct is null or (automod_max_caps_pct between 50 and 100)),
  -- Mention-Spam (z.B. 5 = max 5 user-mentions in einer Message)
  add column if not exists automod_max_mentions integer
    check (automod_max_mentions is null or (automod_max_mentions between 1 and 50)),
  -- Banned-Words als jsonb-Array (case-insensitive Match)
  add column if not exists automod_banned_words jsonb not null default '[]'::jsonb,
  -- Ignorierte Rollen/Channels für AutoMod
  add column if not exists automod_ignored_role_ids jsonb not null default '[]'::jsonb,
  add column if not exists automod_ignored_channel_ids jsonb not null default '[]'::jsonb;


-- ----------------------------------------------------------------------------
-- 045_bot_reminders.sql
-- ----------------------------------------------------------------------------

-- Block 32: Bot — Reminders.
-- User setzen via /remind eine Erinnerung. Der Bot pollt regelmäßig
-- und postet im Original-Channel (falls noch vorhanden) oder per DM.

create table if not exists public.bot_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  guild_id text,            -- null = DM/global
  channel_id text,          -- null = nur DM
  due_at timestamptz not null,
  content text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  check (length(content) between 1 and 500)
);

create index if not exists bot_reminders_due_idx
  on public.bot_reminders (due_at)
  where delivered_at is null;

create index if not exists bot_reminders_user_idx
  on public.bot_reminders (user_id, delivered_at);

alter table public.bot_reminders enable row level security;

-- Web-Dashboard: User sieht nur die eigenen.
drop policy if exists bot_reminders_select_own on public.bot_reminders;
create policy bot_reminders_select_own
  on public.bot_reminders for select
  using (false); -- Bot nutzt Service-Role; Web-UI für Reminders kommt später.


-- ----------------------------------------------------------------------------
-- 046_bot_stats_channels.sql
-- ----------------------------------------------------------------------------

-- Block 33: Bot — Server-Stats-Channels.
-- Voice-/Category-Channels, deren Name regelmäßig mit Live-Werten
-- aktualisiert wird (z. B. "👥 Members: 1.234"). Discord rate-limited
-- channel-rename auf 2 Änderungen / 10 Min pro Channel, daher
-- aktualisiert der Bot alle 10 Min.

create table if not exists public.bot_stat_channels (
  guild_id text not null,
  channel_id text not null,
  template text not null,
  last_value text,
  last_updated_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (guild_id, channel_id),
  check (length(template) between 1 and 100)
);

create index if not exists bot_stat_channels_guild_idx
  on public.bot_stat_channels (guild_id);

alter table public.bot_stat_channels enable row level security;

drop policy if exists bot_stat_channels_select_linked on public.bot_stat_channels;
create policy bot_stat_channels_select_linked
  on public.bot_stat_channels for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_stat_channels.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 047_bot_tickets.sql
-- ----------------------------------------------------------------------------

-- Block 34: Bot — Tickets.
-- Ticket-Panel ist eine Nachricht mit "Ticket öffnen"-Button. Klick
-- erstellt einen privaten Channel sichtbar nur für den User und die
-- konfigurierte Staff-Rolle. Schließen archiviert / löscht den Channel.

create table if not exists public.bot_ticket_panels (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text not null,
  message_id text not null unique,
  staff_role_id text not null,
  category_id text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists bot_ticket_panels_guild_idx
  on public.bot_ticket_panels (guild_id);

create table if not exists public.bot_tickets (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text not null unique,
  owner_user_id text not null,
  panel_id uuid references public.bot_ticket_panels(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by text
);

create index if not exists bot_tickets_guild_idx
  on public.bot_tickets (guild_id, closed_at);
create index if not exists bot_tickets_owner_idx
  on public.bot_tickets (owner_user_id, closed_at);

alter table public.bot_ticket_panels enable row level security;
alter table public.bot_tickets enable row level security;

drop policy if exists bot_ticket_panels_select_linked on public.bot_ticket_panels;
create policy bot_ticket_panels_select_linked
  on public.bot_ticket_panels for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_ticket_panels.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );

drop policy if exists bot_tickets_select_linked on public.bot_tickets;
create policy bot_tickets_select_linked
  on public.bot_tickets for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_tickets.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 048_bot_phase1.sql
-- ----------------------------------------------------------------------------

-- Phase 1: Booster-Message, DM-bei-Join, Sticky-Messages, Channel-Modes (Bilder/Text-Only)
-- Slowmode, Roleall, Embed-Creator brauchen keine DB.

-- 1) Booster-Message + DM-bei-Join: Spalten auf bot_guilds
alter table public.bot_guilds
  add column if not exists booster_enabled boolean not null default false,
  add column if not exists booster_channel_id text,
  add column if not exists booster_message text,
  add column if not exists welcome_dm_enabled boolean not null default false,
  add column if not exists welcome_dm_message text;

-- 2) Sticky-Messages: pro Channel max 1, vom Bot re-posted nach n Nachrichten
create table if not exists public.bot_sticky_messages (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  content text not null,
  last_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, channel_id)
);

alter table public.bot_sticky_messages enable row level security;

-- RLS: Linked-User darf seine eigene Server-Config sehen/ändern
drop policy if exists sticky_select on public.bot_sticky_messages;
create policy sticky_select on public.bot_sticky_messages
  for select using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_sticky_messages.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists sticky_insert on public.bot_sticky_messages;
create policy sticky_insert on public.bot_sticky_messages
  for insert with check (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_sticky_messages.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists sticky_update on public.bot_sticky_messages;
create policy sticky_update on public.bot_sticky_messages
  for update using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_sticky_messages.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists sticky_delete on public.bot_sticky_messages;
create policy sticky_delete on public.bot_sticky_messages
  for delete using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_sticky_messages.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

-- 3) Channel-Modes: Bilder-Only / Text-Only pro Channel
-- mode = 'images_only' (löscht Text-only) | 'text_only' (löscht Anhänge/Links)
create table if not exists public.bot_channel_modes (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  mode text not null check (mode in ('images_only', 'text_only')),
  allow_videos boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (guild_id, channel_id)
);

alter table public.bot_channel_modes enable row level security;

drop policy if exists chanmode_select on public.bot_channel_modes;
create policy chanmode_select on public.bot_channel_modes
  for select using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_channel_modes.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists chanmode_insert on public.bot_channel_modes;
create policy chanmode_insert on public.bot_channel_modes
  for insert with check (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_channel_modes.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists chanmode_delete on public.bot_channel_modes;
create policy chanmode_delete on public.bot_channel_modes
  for delete using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_channel_modes.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

-- Realtime aktivieren (für etwaige Live-Updates im Dashboard)
alter publication supabase_realtime add table public.bot_sticky_messages;
alter publication supabase_realtime add table public.bot_channel_modes;


-- ----------------------------------------------------------------------------
-- 049_bot_messaging_modes.sql
-- ----------------------------------------------------------------------------

-- Mode-Auswahl für Reaction-Roles + Embed-Toggles für alle Bot-gesendeten Messages

-- 1) RR-Mode: Reactions (klassisch) | Buttons (max 25) | Select-Menu (max 25 Optionen)
alter table public.bot_reaction_role_messages
  add column if not exists mode text not null default 'reactions'
    check (mode in ('reactions', 'buttons', 'select_menu'));

-- 2) Embed-Toggles auf bot_guilds
alter table public.bot_guilds
  add column if not exists welcome_use_embed boolean not null default false,
  add column if not exists welcome_embed_color integer,
  add column if not exists welcome_dm_use_embed boolean not null default false,
  add column if not exists booster_use_embed boolean not null default false,
  add column if not exists booster_embed_color integer;

-- 3) Embed-Toggle für Sticky-Messages
alter table public.bot_sticky_messages
  add column if not exists use_embed boolean not null default false,
  add column if not exists embed_color integer;


-- ----------------------------------------------------------------------------
-- 050_bot_level_embed.sql
-- ----------------------------------------------------------------------------

-- Level-Up-Announce: Plain-Text vs. Embed
alter table public.bot_guilds
  add column if not exists level_use_embed boolean not null default false,
  add column if not exists level_embed_color integer;


-- ----------------------------------------------------------------------------
-- 051_bot_embed_templates.sql
-- ----------------------------------------------------------------------------

-- Embed-Templates: gespeicherte Embed-Vorlagen pro Server für den Embed-Creator

create table if not exists public.bot_embed_templates (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  name text not null,
  title text,
  description text,
  color integer,
  footer text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_embed_templates_guild_idx
  on public.bot_embed_templates (guild_id, updated_at desc);

alter table public.bot_embed_templates enable row level security;

drop policy if exists embed_tpl_select on public.bot_embed_templates;
create policy embed_tpl_select on public.bot_embed_templates
  for select using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_embed_templates.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists embed_tpl_insert on public.bot_embed_templates;
create policy embed_tpl_insert on public.bot_embed_templates
  for insert with check (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_embed_templates.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists embed_tpl_update on public.bot_embed_templates;
create policy embed_tpl_update on public.bot_embed_templates
  for update using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_embed_templates.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists embed_tpl_delete on public.bot_embed_templates;
create policy embed_tpl_delete on public.bot_embed_templates
  for delete using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_embed_templates.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 052_bot_phase2_security_engagement.sql
-- ----------------------------------------------------------------------------

-- Phase 2: Verifizierung + Anti-Raid + Giveaways

-- ============== Verifizierung ==============
alter table public.bot_guilds
  add column if not exists verify_enabled boolean not null default false,
  add column if not exists verify_channel_id text,
  add column if not exists verify_role_id text,
  add column if not exists verify_message text,
  add column if not exists verify_panel_message_id text;

-- ============== Anti-Raid ==============
alter table public.bot_guilds
  add column if not exists antiraid_enabled boolean not null default false,
  add column if not exists antiraid_join_threshold integer not null default 5,
  add column if not exists antiraid_join_window_sec integer not null default 10,
  add column if not exists antiraid_action text not null default 'alert'
    check (antiraid_action in ('alert', 'kick', 'lockdown')),
  add column if not exists antiraid_alert_channel_id text;

-- ============== Giveaways ==============
create table if not exists public.bot_giveaways (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  message_id text,
  prize text not null,
  winners_count integer not null default 1 check (winners_count > 0),
  ends_at timestamptz not null,
  created_by_user_id text not null,
  ended boolean not null default false,
  winner_user_ids jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bot_giveaways_guild_idx
  on public.bot_giveaways (guild_id, ended, ends_at);
create index if not exists bot_giveaways_pending_idx
  on public.bot_giveaways (ends_at) where ended = false;

create table if not exists public.bot_giveaway_entries (
  giveaway_id uuid not null references public.bot_giveaways(id) on delete cascade,
  user_id text not null,
  joined_at timestamptz not null default now(),
  primary key (giveaway_id, user_id)
);

alter table public.bot_giveaways enable row level security;
alter table public.bot_giveaway_entries enable row level security;

drop policy if exists giveaways_select on public.bot_giveaways;
create policy giveaways_select on public.bot_giveaways
  for select using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_giveaways.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists giveaways_insert on public.bot_giveaways;
create policy giveaways_insert on public.bot_giveaways
  for insert with check (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_giveaways.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists giveaways_update on public.bot_giveaways;
create policy giveaways_update on public.bot_giveaways
  for update using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_giveaways.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists giveaways_delete on public.bot_giveaways;
create policy giveaways_delete on public.bot_giveaways
  for delete using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_giveaways.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists giveaway_entries_select on public.bot_giveaway_entries;
create policy giveaway_entries_select on public.bot_giveaway_entries
  for select using (
    exists (
      select 1 from public.bot_giveaways g
      join public.bot_guilds bg on bg.guild_id = g.guild_id
      where g.id = bot_giveaway_entries.giveaway_id
        and bg.linked_user_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 053_bot_verify_panel.sql
-- ----------------------------------------------------------------------------

-- Verify-Panel anpassbar: Titel, Farbe, Button-Label, Button-Emoji, Button-Style
alter table public.bot_guilds
  add column if not exists verify_panel_title text,
  add column if not exists verify_panel_color integer,
  add column if not exists verify_button_label text,
  add column if not exists verify_button_emoji text,
  add column if not exists verify_button_style text
    check (verify_button_style in ('primary', 'secondary', 'success', 'danger'));


-- ----------------------------------------------------------------------------
-- 054_bot_verify_replies.sql
-- ----------------------------------------------------------------------------

-- Anpassbare Verify-Antworten (ephemerale DMs nach Button-Klick)
alter table public.bot_guilds
  add column if not exists verify_reply_success text,
  add column if not exists verify_reply_already text;


-- ----------------------------------------------------------------------------
-- 055_bot_giveaway_design.sql
-- ----------------------------------------------------------------------------

-- Pro Giveaway konfigurierbares Embed-Design
alter table public.bot_giveaways
  add column if not exists embed_color integer,
  add column if not exists embed_title text,
  add column if not exists embed_description text,
  add column if not exists button_label text,
  add column if not exists button_emoji text,
  add column if not exists button_style text
    check (button_style in ('primary', 'secondary', 'success', 'danger'));


-- ----------------------------------------------------------------------------
-- 056_bot_phase2_finish.sql
-- ----------------------------------------------------------------------------

-- Phase 2 Final: Geburtstage, Rollen-Badge, AFK-Room, Vorschlags-System, Invite-Tracker

-- ============== Geburtstage ==============
alter table public.bot_guilds
  add column if not exists birthday_enabled boolean not null default false,
  add column if not exists birthday_channel_id text,
  add column if not exists birthday_message text;

create table if not exists public.bot_birthdays (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  user_id text not null,
  month int not null check (month between 1 and 12),
  day int not null check (day between 1 and 31),
  year int,
  created_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);
create index if not exists bot_birthdays_md_idx on public.bot_birthdays (month, day);

-- ============== Rollen-Badge ==============
alter table public.bot_guilds
  add column if not exists role_badges_enabled boolean not null default false;

create table if not exists public.bot_role_badges (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  role_id text not null,
  days_required int not null check (days_required > 0),
  created_at timestamptz not null default now(),
  primary key (guild_id, role_id)
);

-- ============== AFK-Room ==============
alter table public.bot_guilds
  add column if not exists afk_enabled boolean not null default false,
  add column if not exists afk_channel_id text,
  add column if not exists afk_timeout_minutes int not null default 10
    check (afk_timeout_minutes between 1 and 240);

-- ============== Vorschlags-System ==============
alter table public.bot_guilds
  add column if not exists suggestions_enabled boolean not null default false,
  add column if not exists suggestions_channel_id text,
  add column if not exists suggestions_mod_role_id text;

create table if not exists public.bot_suggestions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  message_id text,
  user_id text not null,
  content text not null,
  status text not null default 'open'
    check (status in ('open', 'approved', 'rejected', 'implemented')),
  mod_note text,
  upvotes int not null default 0,
  downvotes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bot_suggestions_guild_idx
  on public.bot_suggestions (guild_id, created_at desc);

create table if not exists public.bot_suggestion_votes (
  suggestion_id uuid not null references public.bot_suggestions(id) on delete cascade,
  user_id text not null,
  vote text not null check (vote in ('up', 'down')),
  created_at timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);

-- ============== Invite-Tracker ==============
alter table public.bot_guilds
  add column if not exists invite_tracker_enabled boolean not null default false;

create table if not exists public.bot_invites (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  code text not null,
  inviter_user_id text,
  uses int not null default 0,
  created_at timestamptz not null default now(),
  primary key (guild_id, code)
);

create table if not exists public.bot_invite_attributions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  joined_user_id text not null,
  inviter_user_id text,
  invite_code text,
  joined_at timestamptz not null default now()
);
create index if not exists bot_invite_attr_guild_idx
  on public.bot_invite_attributions (guild_id, joined_at desc);
create index if not exists bot_invite_attr_inviter_idx
  on public.bot_invite_attributions (guild_id, inviter_user_id);


-- ----------------------------------------------------------------------------
-- 057_bot_helpdesk_tempvoice.sql
-- ----------------------------------------------------------------------------

-- Helpdesk-Panels + Temp-Voice-Channels

-- ============== Helpdesk ==============
create table if not exists public.bot_helpdesk_panels (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  message_id text,
  title text not null default 'Helpdesk',
  description text,
  color integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bot_helpdesk_panels_guild_idx
  on public.bot_helpdesk_panels (guild_id, created_at desc);

create table if not exists public.bot_helpdesk_items (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references public.bot_helpdesk_panels(id) on delete cascade,
  label text not null,
  emoji text,
  style text not null default 'secondary'
    check (style in ('primary', 'secondary', 'success', 'danger')),
  answer text not null,
  answer_color integer,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bot_helpdesk_items_panel_idx
  on public.bot_helpdesk_items (panel_id, position);

-- ============== Temp-Voice ==============
alter table public.bot_guilds
  add column if not exists tempvoice_enabled boolean not null default false,
  add column if not exists tempvoice_creator_channel_id text,
  add column if not exists tempvoice_category_id text,
  add column if not exists tempvoice_name_template text,
  add column if not exists tempvoice_default_limit int default 0
    check (tempvoice_default_limit between 0 and 99);

create table if not exists public.bot_temp_voice (
  channel_id text primary key,
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  owner_user_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists bot_temp_voice_guild_idx
  on public.bot_temp_voice (guild_id);


-- ----------------------------------------------------------------------------
-- 058_bot_embed_creator_v2.sql
-- ----------------------------------------------------------------------------

-- Multi-Embed-Creator v2: JSON-Payload mit Content + N Embeds + Fields + alle Felder

alter table public.bot_embed_templates
  add column if not exists payload jsonb;

-- Bestehende Templates auf das neue JSON-Format migrieren (one-shot)
update public.bot_embed_templates
set payload = jsonb_build_object(
  'content', null,
  'embeds', jsonb_build_array(
    jsonb_build_object(
      'title', title,
      'description', description,
      'color', color,
      'footer', case when footer is not null then jsonb_build_object('text', footer) else null end,
      'image', image_url
    )
  )
)
where payload is null;


-- ----------------------------------------------------------------------------
-- 059_bot_webhooks.sql
-- ----------------------------------------------------------------------------

-- Pro Channel ein vom Bot verwalteter Webhook (Token = secret, nur Service-Role-Zugriff)
create table if not exists public.bot_webhooks (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  webhook_id text not null,
  webhook_token text not null,
  name text not null default 'Kanbanly',
  created_at timestamptz not null default now(),
  primary key (guild_id, channel_id)
);

-- RLS aktiv aber ohne Policies = niemand kann lesen außer Service-Role
alter table public.bot_webhooks enable row level security;


-- ----------------------------------------------------------------------------
-- 060_bot_quickwins.sql
-- ----------------------------------------------------------------------------

-- Quick-Wins: Bild-des-Tages, Guess-Game, Teamliste

-- ============== Bild des Tages ==============
alter table public.bot_guilds
  add column if not exists daily_image_enabled boolean not null default false,
  add column if not exists daily_image_channel_id text,
  add column if not exists daily_image_hour int not null default 9 check (daily_image_hour between 0 and 23),
  add column if not exists daily_image_urls jsonb not null default '[]'::jsonb,
  add column if not exists daily_image_index int not null default 0;

-- ============== Guess-the-Number ==============
create table if not exists public.bot_guess_games (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  target int not null,
  min_value int not null default 1,
  max_value int not null default 1000,
  attempts int not null default 0,
  started_by_user_id text not null,
  created_at timestamptz not null default now(),
  primary key (guild_id, channel_id)
);

-- ============== Teamliste ==============
create table if not exists public.bot_teamlists (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  message_id text,
  title text not null default 'Team',
  role_ids jsonb not null default '[]'::jsonb,
  color integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bot_teamlists_guild_idx
  on public.bot_teamlists (guild_id);


-- ----------------------------------------------------------------------------
-- 061_bot_tickets_v2.sql
-- ----------------------------------------------------------------------------

-- Tickets v2: Panel-Customization, Transcripts, Welcome-Message

alter table public.bot_ticket_panels
  add column if not exists title text not null default '🎫 Support öffnen',
  add column if not exists description text not null default 'Klick den Button unten, um ein privates Ticket zu eröffnen.',
  add column if not exists button_label text not null default 'Ticket öffnen',
  add column if not exists button_emoji text,
  add column if not exists button_style text not null default 'primary'
    check (button_style in ('primary', 'secondary', 'success', 'danger')),
  add column if not exists color integer,
  add column if not exists welcome_message text;

alter table public.bot_tickets
  add column if not exists transcript jsonb,
  add column if not exists transcript_saved_at timestamptz;


-- ----------------------------------------------------------------------------
-- 062_bot_tickets_v3.sql
-- ----------------------------------------------------------------------------

-- Tickets v3: Multi-Button, Multi-Staff, Feedback, Reminder/SLA, Custom-Embed-Payload
--
-- Datenmodell:
-- - bot_ticket_panels: zusätzlich staff_role_ids[], buttons jsonb, select_menu jsonb,
--   embed_payload jsonb (Full-Embed-Editor optional), feedback_*, *_minutes/hours
-- - bot_tickets: last_message_at, staff_first_response_at, reminded_inactive, reminded_sla
-- - bot_ticket_feedback: rating + comment pro Ticket

alter table public.bot_ticket_panels
  add column if not exists staff_role_ids text[] not null default '{}',
  add column if not exists buttons jsonb not null default '[]'::jsonb,
  add column if not exists select_menu jsonb,
  add column if not exists embed_payload jsonb,
  add column if not exists feedback_enabled boolean not null default false,
  add column if not exists feedback_mode text not null default 'dm'
    check (feedback_mode in ('dm', 'channel', 'both')),
  add column if not exists feedback_question text not null default
    'Wie zufrieden warst du mit dem Support?',
  add column if not exists inactivity_hours integer,
  add column if not exists auto_close_hours integer,
  add column if not exists staff_sla_minutes integer,
  add column if not exists name_pattern text not null default 'ticket-{user}';

-- Migrationspfad: vorhandene Single-Staff-Role in Array übernehmen.
update public.bot_ticket_panels
   set staff_role_ids = array[staff_role_id]
 where staff_role_id is not null
   and (staff_role_ids is null or array_length(staff_role_ids, 1) is null);

alter table public.bot_tickets
  add column if not exists last_message_at timestamptz,
  add column if not exists staff_first_response_at timestamptz,
  add column if not exists reminded_inactive boolean not null default false,
  add column if not exists reminded_sla boolean not null default false,
  add column if not exists selected_button_id text;

create index if not exists bot_tickets_inactivity_idx
  on public.bot_tickets (closed_at, last_message_at);

create table if not exists public.bot_ticket_feedback (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.bot_tickets(id) on delete cascade,
  guild_id text not null,
  user_id text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists bot_ticket_feedback_guild_idx
  on public.bot_ticket_feedback (guild_id, created_at desc);
create index if not exists bot_ticket_feedback_ticket_idx
  on public.bot_ticket_feedback (ticket_id);

alter table public.bot_ticket_feedback enable row level security;

drop policy if exists bot_ticket_feedback_select_linked on public.bot_ticket_feedback;
create policy bot_ticket_feedback_select_linked
  on public.bot_ticket_feedback for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_ticket_feedback.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );


