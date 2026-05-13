-- Block 29: Bot — Tags (FAQ-Quick-Antworten).
-- Pro Guild definiert; jeder mit ManageMessages kann anlegen/ändern,
-- aber jeder Server-Member kann sie abrufen.

create table if not exists public.bot_tags (
  guild_id text not null,
  name text not null,
  content text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uses integer not null default 0,
  primary key (guild_id, name),
  check (length(name) between 1 and 32),
  check (name ~ '^[a-z0-9_-]+$'),
  check (length(content) between 1 and 2000)
);

create index if not exists bot_tags_guild_idx
  on public.bot_tags (guild_id, name);

alter table public.bot_tags enable row level security;

drop policy if exists bot_tags_select_linked on public.bot_tags;
create policy bot_tags_select_linked
  on public.bot_tags for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_tags.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );
