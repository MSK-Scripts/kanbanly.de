-- Mode-Auswahl für Reaction-Roles + Embed-Toggles für alle Bot-gesendeten Messages

-- 1) RR-Mode: Reactions (klassisch) | Buttons (max 25) | Select-Menu (max 25 Optionen)
alter table public.bot_reaction_role_messages
  add column if not exists mode text not null default 'reactions'
    check (mode in ('reactions', 'buttons', 'select_menu'));

-- 2) Embed-Toggles auf bot_guilds
alter table public.bot_guilds
  add column if not exists welcome_use_embed boolean not null default false,
  add column if not exists welcome_embed_color integer,
  add column if not exists welcome_dm_use_embed boolean not null default false,
  add column if not exists booster_use_embed boolean not null default false,
  add column if not exists booster_embed_color integer;

-- 3) Embed-Toggle für Sticky-Messages
alter table public.bot_sticky_messages
  add column if not exists use_embed boolean not null default false,
  add column if not exists embed_color integer;
