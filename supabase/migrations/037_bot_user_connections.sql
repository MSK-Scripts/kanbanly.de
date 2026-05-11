-- Block 15 · Discord-Connect für das Web-Dashboard.
-- Pro Kanbanly-User eine Discord-OAuth-Verknüpfung.

create table if not exists public.bot_user_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_user_id text not null unique,
  discord_username text,
  -- Tokens sind sensibel — Zugriff ausschließlich über Service-Role (Server-Side).
  -- RLS verbietet jedem normalen User das Auslesen.
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bot_user_connections enable row level security;

-- Standard-User können NICHT auf Tokens zugreifen — Service-Role-Bypass nur im Server-Action-Layer.
-- Eine read-only Policy für die eigenen Metadaten (ohne Tokens) wäre über eine View möglich;
-- für MVP greifen wir aus Server-Components mit dem Admin-Client zu und exponieren nur, was gebraucht wird.

-- Bot-Guild → User-Verknüpfung: Hilfsspalte ist schon in bot_guilds.linked_user_id (Migration 035).
-- Hier nur ein Index für Lookups via discord_user_id.
create index if not exists bot_user_connections_discord_user_id_idx
  on public.bot_user_connections (discord_user_id);
