-- Vorschlags-System v2: konfigurierbares Embed, Custom-Emojis, Banner/Thumbnail,
-- Footer, Field-Reihenfolge, erlaubte Rollen für /suggest-end + End-Nachricht.
--
-- Datenmodell:
-- - bot_guilds: viele neue suggestions_* Spalten (Embed-Design + Verhalten)
-- - bot_suggestions: public_id (kurze, lesbare ID wie "R82N91") + ended_at

alter table public.bot_guilds
  add column if not exists suggestions_embed_title text not null default 'Neuer Vorschlag',
  add column if not exists suggestions_embed_message text not null default
    '{user} hat einen neuen Vorschlag gepostet' || E'\n\n' || '{suggestion}',
  add column if not exists suggestions_embed_color integer not null default 5793266, -- #5865F2
  add column if not exists suggestions_footer_text text,
  add column if not exists suggestions_banner_url text,
  add column if not exists suggestions_thumbnail_url text,
  add column if not exists suggestions_upvote_emoji text,
  add column if not exists suggestions_downvote_emoji text,
  add column if not exists suggestions_status_open_emoji text,
  add column if not exists suggestions_status_ended_emoji text,
  add column if not exists suggestions_allowed_role_ids text[] not null default '{}',
  add column if not exists suggestions_end_message text not null default 'Dieser Vorschlag wurde beendet.',
  -- Feldreihenfolge im Embed. Mögliche Keys: id, status, upvotes, downvotes, banner
  add column if not exists suggestions_field_order text[] not null default
    array['id', 'status', 'upvotes', 'downvotes', 'banner']::text[];

alter table public.bot_suggestions
  add column if not exists public_id text,
  add column if not exists ended_at timestamptz;

-- Eindeutige kurze IDs nachträglich für Bestandszeilen vergeben.
update public.bot_suggestions
   set public_id = upper(substr(replace(id::text, '-', ''), 1, 6))
 where public_id is null;

create unique index if not exists bot_suggestions_guild_public_id_uq
  on public.bot_suggestions (guild_id, public_id);
