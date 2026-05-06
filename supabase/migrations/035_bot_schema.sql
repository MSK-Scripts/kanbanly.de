-- Block 15: Discord-Bot — initiales Schema.
-- Pro-Guild-Konfiguration und Verknüpfung zu Kanbanly-Usern.
-- Erweiterungen (Levels, Mod-Logs, Reaction Roles, Warnings) folgen
-- in späteren Migrations (036+).

create table if not exists public.bot_guilds (
  guild_id text primary key,
  owner_id text not null,
  name text,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Feature-Toggles (Phase 2+)
  welcome_enabled boolean not null default false,
  welcome_channel_id text,
  welcome_message text,
  log_channel_id text,

  -- Verknüpfung zu Kanbanly-User (für Web-Dashboard).
  -- Ein User kann mehrere Guilds verwalten, eine Guild hat eine Owner-Verknüpfung.
  linked_user_id uuid references auth.users(id) on delete set null
);

create index if not exists bot_guilds_linked_user_id_idx
  on public.bot_guilds (linked_user_id)
  where linked_user_id is not null;

-- Service-Role umgeht RLS, aber Defense-in-Depth: RLS aktivieren.
alter table public.bot_guilds enable row level security;

-- Web-Dashboard: User darf seine verknüpften Guilds lesen.
drop policy if exists bot_guilds_select_linked on public.bot_guilds;
create policy bot_guilds_select_linked
  on public.bot_guilds for select
  using (linked_user_id = auth.uid());
