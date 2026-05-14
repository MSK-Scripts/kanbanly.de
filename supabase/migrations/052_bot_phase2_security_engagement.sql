-- Phase 2: Verifizierung + Anti-Raid + Giveaways

-- ============== Verifizierung ==============
alter table public.bot_guilds
  add column if not exists verify_enabled boolean not null default false,
  add column if not exists verify_channel_id text,
  add column if not exists verify_role_id text,
  add column if not exists verify_message text,
  add column if not exists verify_panel_message_id text;

-- ============== Anti-Raid ==============
alter table public.bot_guilds
  add column if not exists antiraid_enabled boolean not null default false,
  add column if not exists antiraid_join_threshold integer not null default 5,
  add column if not exists antiraid_join_window_sec integer not null default 10,
  add column if not exists antiraid_action text not null default 'alert'
    check (antiraid_action in ('alert', 'kick', 'lockdown')),
  add column if not exists antiraid_alert_channel_id text;

-- ============== Giveaways ==============
create table if not exists public.bot_giveaways (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  message_id text,
  prize text not null,
  winners_count integer not null default 1 check (winners_count > 0),
  ends_at timestamptz not null,
  created_by_user_id text not null,
  ended boolean not null default false,
  winner_user_ids jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bot_giveaways_guild_idx
  on public.bot_giveaways (guild_id, ended, ends_at);
create index if not exists bot_giveaways_pending_idx
  on public.bot_giveaways (ends_at) where ended = false;

create table if not exists public.bot_giveaway_entries (
  giveaway_id uuid not null references public.bot_giveaways(id) on delete cascade,
  user_id text not null,
  joined_at timestamptz not null default now(),
  primary key (giveaway_id, user_id)
);

alter table public.bot_giveaways enable row level security;
alter table public.bot_giveaway_entries enable row level security;

drop policy if exists giveaways_select on public.bot_giveaways;
create policy giveaways_select on public.bot_giveaways
  for select using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_giveaways.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists giveaways_insert on public.bot_giveaways;
create policy giveaways_insert on public.bot_giveaways
  for insert with check (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_giveaways.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists giveaways_update on public.bot_giveaways;
create policy giveaways_update on public.bot_giveaways
  for update using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_giveaways.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists giveaways_delete on public.bot_giveaways;
create policy giveaways_delete on public.bot_giveaways
  for delete using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_giveaways.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists giveaway_entries_select on public.bot_giveaway_entries;
create policy giveaway_entries_select on public.bot_giveaway_entries
  for select using (
    exists (
      select 1 from public.bot_giveaways g
      join public.bot_guilds bg on bg.guild_id = g.guild_id
      where g.id = bot_giveaway_entries.giveaway_id
        and bg.linked_user_id = auth.uid()
    )
  );
