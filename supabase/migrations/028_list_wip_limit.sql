-- Block 18: Optionales WIP-Limit pro Liste (klassisches Kanban). Wenn
-- gesetzt, zeigt die UI die aktive Kartenanzahl gegen das Limit (z. B.
-- 5/3) und warnt visuell wenn überschritten. Soft-Constraint — Karten
-- können trotzdem hinzugefügt werden, aber das Team sieht den Druck.

alter table public.lists
  add column if not exists wip_limit int;

alter table public.lists
  add constraint lists_wip_limit_positive
  check (wip_limit is null or wip_limit > 0);
