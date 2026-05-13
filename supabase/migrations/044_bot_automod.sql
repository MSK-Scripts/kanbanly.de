-- Block 31: Bot — AutoMod.
-- Per-Guild Spam-/Link-/Caps-/Mention-Filter mit automatischer
-- Message-Löschung + DM-Warnung an den User.
-- Banned-Words als jsonb-Array, Link-Whitelist als jsonb-Array.

alter table public.bot_guilds
  add column if not exists automod_enabled boolean not null default false,
  -- Link-Filter
  add column if not exists automod_block_links boolean not null default false,
  add column if not exists automod_link_allowlist jsonb not null default '[]'::jsonb,
  -- Caps-Filter (z.B. 70 = 70% Großbuchstaben in min 10-Zeichen-Messages)
  add column if not exists automod_max_caps_pct integer
    check (automod_max_caps_pct is null or (automod_max_caps_pct between 50 and 100)),
  -- Mention-Spam (z.B. 5 = max 5 user-mentions in einer Message)
  add column if not exists automod_max_mentions integer
    check (automod_max_mentions is null or (automod_max_mentions between 1 and 50)),
  -- Banned-Words als jsonb-Array (case-insensitive Match)
  add column if not exists automod_banned_words jsonb not null default '[]'::jsonb,
  -- Ignorierte Rollen/Channels für AutoMod
  add column if not exists automod_ignored_role_ids jsonb not null default '[]'::jsonb,
  add column if not exists automod_ignored_channel_ids jsonb not null default '[]'::jsonb;
