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
