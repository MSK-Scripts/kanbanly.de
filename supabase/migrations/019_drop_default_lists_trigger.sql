-- Default-Listen werden jetzt serverseitig in app/(app)/actions.ts
-- auf Deutsch ("To do", "In Arbeit", "Erledigt") eingefügt.
-- Der alte Trigger erzeugte zusätzlich englische Duplikate.

drop trigger if exists on_board_created on public.boards;
drop function if exists public.add_default_lists();
