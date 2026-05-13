-- Block 27: Bot — Logging.
-- log_channel_id existiert bereits seit 035. Hier ergänzen wir die
-- per-Event-Toggles, damit Server entscheiden können was geloggt wird.

alter table public.bot_guilds
  add column if not exists log_joins boolean not null default false,
  add column if not exists log_leaves boolean not null default false,
  add column if not exists log_message_edits boolean not null default false,
  add column if not exists log_message_deletes boolean not null default false,
  add column if not exists log_role_changes boolean not null default false;
