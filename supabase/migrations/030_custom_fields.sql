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
