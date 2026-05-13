-- Block 33: Bot — Server-Stats-Channels.
-- Voice-/Category-Channels, deren Name regelmäßig mit Live-Werten
-- aktualisiert wird (z. B. "👥 Members: 1.234"). Discord rate-limited
-- channel-rename auf 2 Änderungen / 10 Min pro Channel, daher
-- aktualisiert der Bot alle 10 Min.

create table if not exists public.bot_stat_channels (
  guild_id text not null,
  channel_id text not null,
  template text not null,
  last_value text,
  last_updated_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (guild_id, channel_id),
  check (length(template) between 1 and 100)
);

create index if not exists bot_stat_channels_guild_idx
  on public.bot_stat_channels (guild_id);

alter table public.bot_stat_channels enable row level security;

drop policy if exists bot_stat_channels_select_linked on public.bot_stat_channels;
create policy bot_stat_channels_select_linked
  on public.bot_stat_channels for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_stat_channels.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );
