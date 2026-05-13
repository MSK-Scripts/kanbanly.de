-- Block 28: Bot — Leveling / XP-System.
-- Pro Guild + User wird XP gesammelt. Server-Admins können Rollen
-- für bestimmte Levels vergeben (Level-Rewards) und ankündigen lassen.

-- XP pro Guild × User.
create table if not exists public.bot_xp (
  guild_id text not null,
  user_id text not null,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 0 check (level >= 0),
  last_message_at timestamptz,
  primary key (guild_id, user_id)
);

create index if not exists bot_xp_guild_rank_idx
  on public.bot_xp (guild_id, xp desc);

alter table public.bot_xp enable row level security;

drop policy if exists bot_xp_select_linked on public.bot_xp;
create policy bot_xp_select_linked
  on public.bot_xp for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_xp.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );

-- Level → Rolle Mapping pro Guild.
create table if not exists public.bot_level_rewards (
  guild_id text not null,
  level integer not null check (level > 0),
  role_id text not null,
  primary key (guild_id, level)
);

create index if not exists bot_level_rewards_guild_idx
  on public.bot_level_rewards (guild_id, level);

alter table public.bot_level_rewards enable row level security;

drop policy if exists bot_level_rewards_select_linked on public.bot_level_rewards;
create policy bot_level_rewards_select_linked
  on public.bot_level_rewards for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_level_rewards.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );

-- Toggles pro Guild.
alter table public.bot_guilds
  add column if not exists level_enabled boolean not null default false,
  add column if not exists level_up_channel_id text,
  add column if not exists level_announce boolean not null default true;
