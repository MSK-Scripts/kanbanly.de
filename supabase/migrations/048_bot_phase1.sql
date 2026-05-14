-- Phase 1: Booster-Message, DM-bei-Join, Sticky-Messages, Channel-Modes (Bilder/Text-Only)
-- Slowmode, Roleall, Embed-Creator brauchen keine DB.

-- 1) Booster-Message + DM-bei-Join: Spalten auf bot_guilds
alter table public.bot_guilds
  add column if not exists booster_enabled boolean not null default false,
  add column if not exists booster_channel_id text,
  add column if not exists booster_message text,
  add column if not exists welcome_dm_enabled boolean not null default false,
  add column if not exists welcome_dm_message text;

-- 2) Sticky-Messages: pro Channel max 1, vom Bot re-posted nach n Nachrichten
create table if not exists public.bot_sticky_messages (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  content text not null,
  last_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, channel_id)
);

alter table public.bot_sticky_messages enable row level security;

-- RLS: Linked-User darf seine eigene Server-Config sehen/ändern
drop policy if exists sticky_select on public.bot_sticky_messages;
create policy sticky_select on public.bot_sticky_messages
  for select using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_sticky_messages.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists sticky_insert on public.bot_sticky_messages;
create policy sticky_insert on public.bot_sticky_messages
  for insert with check (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_sticky_messages.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists sticky_update on public.bot_sticky_messages;
create policy sticky_update on public.bot_sticky_messages
  for update using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_sticky_messages.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists sticky_delete on public.bot_sticky_messages;
create policy sticky_delete on public.bot_sticky_messages
  for delete using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_sticky_messages.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

-- 3) Channel-Modes: Bilder-Only / Text-Only pro Channel
-- mode = 'images_only' (löscht Text-only) | 'text_only' (löscht Anhänge/Links)
create table if not exists public.bot_channel_modes (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  mode text not null check (mode in ('images_only', 'text_only')),
  allow_videos boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (guild_id, channel_id)
);

alter table public.bot_channel_modes enable row level security;

drop policy if exists chanmode_select on public.bot_channel_modes;
create policy chanmode_select on public.bot_channel_modes
  for select using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_channel_modes.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists chanmode_insert on public.bot_channel_modes;
create policy chanmode_insert on public.bot_channel_modes
  for insert with check (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_channel_modes.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists chanmode_delete on public.bot_channel_modes;
create policy chanmode_delete on public.bot_channel_modes
  for delete using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_channel_modes.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

-- Realtime aktivieren (für etwaige Live-Updates im Dashboard)
alter publication supabase_realtime add table public.bot_sticky_messages;
alter publication supabase_realtime add table public.bot_channel_modes;
