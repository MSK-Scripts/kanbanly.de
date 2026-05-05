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
