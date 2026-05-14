-- Helpdesk-Panels + Temp-Voice-Channels

-- ============== Helpdesk ==============
create table if not exists public.bot_helpdesk_panels (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  message_id text,
  title text not null default 'Helpdesk',
  description text,
  color integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bot_helpdesk_panels_guild_idx
  on public.bot_helpdesk_panels (guild_id, created_at desc);

create table if not exists public.bot_helpdesk_items (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references public.bot_helpdesk_panels(id) on delete cascade,
  label text not null,
  emoji text,
  style text not null default 'secondary'
    check (style in ('primary', 'secondary', 'success', 'danger')),
  answer text not null,
  answer_color integer,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bot_helpdesk_items_panel_idx
  on public.bot_helpdesk_items (panel_id, position);

-- ============== Temp-Voice ==============
alter table public.bot_guilds
  add column if not exists tempvoice_enabled boolean not null default false,
  add column if not exists tempvoice_creator_channel_id text,
  add column if not exists tempvoice_category_id text,
  add column if not exists tempvoice_name_template text,
  add column if not exists tempvoice_default_limit int default 0
    check (tempvoice_default_limit between 0 and 99);

create table if not exists public.bot_temp_voice (
  channel_id text primary key,
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  owner_user_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists bot_temp_voice_guild_idx
  on public.bot_temp_voice (guild_id);
