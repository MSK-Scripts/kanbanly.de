-- Quick-Wins: Bild-des-Tages, Guess-Game, Teamliste

-- ============== Bild des Tages ==============
alter table public.bot_guilds
  add column if not exists daily_image_enabled boolean not null default false,
  add column if not exists daily_image_channel_id text,
  add column if not exists daily_image_hour int not null default 9 check (daily_image_hour between 0 and 23),
  add column if not exists daily_image_urls jsonb not null default '[]'::jsonb,
  add column if not exists daily_image_index int not null default 0;

-- ============== Guess-the-Number ==============
create table if not exists public.bot_guess_games (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  target int not null,
  min_value int not null default 1,
  max_value int not null default 1000,
  attempts int not null default 0,
  started_by_user_id text not null,
  created_at timestamptz not null default now(),
  primary key (guild_id, channel_id)
);

-- ============== Teamliste ==============
create table if not exists public.bot_teamlists (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  message_id text,
  title text not null default 'Team',
  role_ids jsonb not null default '[]'::jsonb,
  color integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bot_teamlists_guild_idx
  on public.bot_teamlists (guild_id);
