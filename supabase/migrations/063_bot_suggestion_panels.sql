-- Suggestion-Panels: Embed mit „Vorschlag einreichen"-Button in einem Channel,
-- der dasselbe Modal öffnet wie /suggest. Der eingereichte Vorschlag landet
-- immer im konfigurierten Suggestions-Channel (bot_guilds.suggestions_channel_id) —
-- das Panel ist nur der UX-Aufhänger.

create table if not exists public.bot_suggestion_panels (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text not null,
  message_id text,
  title text not null default 'Vorschlag einreichen',
  description text not null default 'Klick den Button unten, um einen Vorschlag zu posten. Du bekommst ein Modal — Antwort dann anonym oder mit Username (je nach Server-Einstellung).',
  button_label text not null default 'Vorschlag einreichen',
  button_emoji text,
  button_style text not null default 'primary'
    check (button_style in ('primary', 'secondary', 'success', 'danger')),
  color integer,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_suggestion_panels_guild_idx
  on public.bot_suggestion_panels (guild_id);

alter table public.bot_suggestion_panels enable row level security;

drop policy if exists bot_suggestion_panels_select_linked on public.bot_suggestion_panels;
create policy bot_suggestion_panels_select_linked
  on public.bot_suggestion_panels for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_suggestion_panels.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );
