-- Block 30: Bot — Custom Commands.
-- User-definierte Prefix-Trigger im Chat (z. B. !rules → Antwort).
-- Im Gegensatz zu Tags wird hier kein Slash-Command genutzt, sondern
-- direkt auf MessageCreate gehört.

create table if not exists public.bot_custom_commands (
  guild_id text not null,
  trigger text not null,
  response text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uses integer not null default 0,
  primary key (guild_id, trigger),
  check (length(trigger) between 1 and 32),
  check (trigger ~ '^[a-z0-9_-]+$'),
  check (length(response) between 1 and 2000)
);

create index if not exists bot_custom_commands_guild_idx
  on public.bot_custom_commands (guild_id);

alter table public.bot_custom_commands enable row level security;

drop policy if exists bot_custom_commands_select_linked on public.bot_custom_commands;
create policy bot_custom_commands_select_linked
  on public.bot_custom_commands for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_custom_commands.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );

-- Prefix pro Guild (default !).
alter table public.bot_guilds
  add column if not exists command_prefix text not null default '!'
  check (length(command_prefix) between 1 and 3);
