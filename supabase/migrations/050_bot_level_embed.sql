-- Level-Up-Announce: Plain-Text vs. Embed
alter table public.bot_guilds
  add column if not exists level_use_embed boolean not null default false,
  add column if not exists level_embed_color integer;
