-- Block 15 · Phase 2: Welcome-Messages + Reaction Roles.
-- bot_guilds.welcome_* existiert bereits in 035 — hier nur Reaction-Role-Schema.

create table if not exists public.bot_reaction_role_messages (
  message_id text primary key,
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  title text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists bot_rr_messages_guild_idx
  on public.bot_reaction_role_messages (guild_id);

-- emoji_key: für Unicode der Char selbst, für Custom-Emojis die Snowflake-ID.
-- emoji_display: das, was wir wieder rausrendern (Unicode-Char oder <:name:id>).
create table if not exists public.bot_reaction_roles (
  message_id text not null references public.bot_reaction_role_messages(message_id) on delete cascade,
  emoji_key text not null,
  emoji_display text not null,
  role_id text not null,
  label text,
  primary key (message_id, emoji_key)
);

create index if not exists bot_rr_message_idx
  on public.bot_reaction_roles (message_id);

alter table public.bot_reaction_role_messages enable row level security;
alter table public.bot_reaction_roles enable row level security;

-- Web-Dashboard: User sieht RR-Messages seiner verknüpften Guilds.
drop policy if exists bot_rr_messages_select_linked on public.bot_reaction_role_messages;
create policy bot_rr_messages_select_linked
  on public.bot_reaction_role_messages for select
  using (
    exists (
      select 1 from public.bot_guilds g
      where g.guild_id = bot_reaction_role_messages.guild_id
        and g.linked_user_id = auth.uid()
    )
  );

drop policy if exists bot_rr_select_linked on public.bot_reaction_roles;
create policy bot_rr_select_linked
  on public.bot_reaction_roles for select
  using (
    exists (
      select 1
      from public.bot_reaction_role_messages m
      join public.bot_guilds g on g.guild_id = m.guild_id
      where m.message_id = bot_reaction_roles.message_id
        and g.linked_user_id = auth.uid()
    )
  );
