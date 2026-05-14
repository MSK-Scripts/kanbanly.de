-- Phase 2 Final: Geburtstage, Rollen-Badge, AFK-Room, Vorschlags-System, Invite-Tracker

-- ============== Geburtstage ==============
alter table public.bot_guilds
  add column if not exists birthday_enabled boolean not null default false,
  add column if not exists birthday_channel_id text,
  add column if not exists birthday_message text;

create table if not exists public.bot_birthdays (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  user_id text not null,
  month int not null check (month between 1 and 12),
  day int not null check (day between 1 and 31),
  year int,
  created_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);
create index if not exists bot_birthdays_md_idx on public.bot_birthdays (month, day);

-- ============== Rollen-Badge ==============
alter table public.bot_guilds
  add column if not exists role_badges_enabled boolean not null default false;

create table if not exists public.bot_role_badges (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  role_id text not null,
  days_required int not null check (days_required > 0),
  created_at timestamptz not null default now(),
  primary key (guild_id, role_id)
);

-- ============== AFK-Room ==============
alter table public.bot_guilds
  add column if not exists afk_enabled boolean not null default false,
  add column if not exists afk_channel_id text,
  add column if not exists afk_timeout_minutes int not null default 10
    check (afk_timeout_minutes between 1 and 240);

-- ============== Vorschlags-System ==============
alter table public.bot_guilds
  add column if not exists suggestions_enabled boolean not null default false,
  add column if not exists suggestions_channel_id text,
  add column if not exists suggestions_mod_role_id text;

create table if not exists public.bot_suggestions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  message_id text,
  user_id text not null,
  content text not null,
  status text not null default 'open'
    check (status in ('open', 'approved', 'rejected', 'implemented')),
  mod_note text,
  upvotes int not null default 0,
  downvotes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bot_suggestions_guild_idx
  on public.bot_suggestions (guild_id, created_at desc);

create table if not exists public.bot_suggestion_votes (
  suggestion_id uuid not null references public.bot_suggestions(id) on delete cascade,
  user_id text not null,
  vote text not null check (vote in ('up', 'down')),
  created_at timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);

-- ============== Invite-Tracker ==============
alter table public.bot_guilds
  add column if not exists invite_tracker_enabled boolean not null default false;

create table if not exists public.bot_invites (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  code text not null,
  inviter_user_id text,
  uses int not null default 0,
  created_at timestamptz not null default now(),
  primary key (guild_id, code)
);

create table if not exists public.bot_invite_attributions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  joined_user_id text not null,
  inviter_user_id text,
  invite_code text,
  joined_at timestamptz not null default now()
);
create index if not exists bot_invite_attr_guild_idx
  on public.bot_invite_attributions (guild_id, joined_at desc);
create index if not exists bot_invite_attr_inviter_idx
  on public.bot_invite_attributions (guild_id, inviter_user_id);
