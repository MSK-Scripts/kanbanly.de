-- Block 26: Bot — Moderation.
-- Warn-Historie pro Guild. Kicks/Bans/Timeouts brauchen keine
-- eigene Tabelle — Discord's Audit-Log hält das fest.

create table if not exists public.bot_warnings (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  moderator_id text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists bot_warnings_guild_user_idx
  on public.bot_warnings (guild_id, user_id, created_at desc);

create index if not exists bot_warnings_guild_idx
  on public.bot_warnings (guild_id, created_at desc);

alter table public.bot_warnings enable row level security;

-- Web-Dashboard: User sieht Warnings nur für seine verknüpften Guilds.
drop policy if exists bot_warnings_select_linked on public.bot_warnings;
create policy bot_warnings_select_linked
  on public.bot_warnings for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_warnings.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );
