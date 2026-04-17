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
