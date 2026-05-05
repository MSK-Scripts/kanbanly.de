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
