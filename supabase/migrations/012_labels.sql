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
