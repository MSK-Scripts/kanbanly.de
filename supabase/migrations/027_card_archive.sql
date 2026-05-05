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
