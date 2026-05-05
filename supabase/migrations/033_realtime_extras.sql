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
