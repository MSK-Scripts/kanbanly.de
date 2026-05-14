-- Preisliste: Embed-Panel mit Buttons. Klick auf Button → ephemeral Details
-- (Beschreibung + optional Preis + Bild) für das jeweilige Item.

create table if not exists public.bot_pricelist_panels (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text not null,
  message_id text,
  title text not null default 'Preisliste',
  description text not null default '',
  color integer,
  image_url text,
  thumbnail_url text,
  footer text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_pricelist_panels_guild_idx
  on public.bot_pricelist_panels (guild_id);

create table if not exists public.bot_pricelist_items (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references public.bot_pricelist_panels(id) on delete cascade,
  label text not null,
  emoji text,
  style text not null default 'secondary'
    check (style in ('primary', 'secondary', 'success', 'danger')),
  -- Details, die beim Klick als ephemeral message gezeigt werden.
  detail_title text not null,
  detail_description text not null default '',
  detail_price text,
  detail_color integer,
  detail_image_url text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists bot_pricelist_items_panel_idx
  on public.bot_pricelist_items (panel_id, position);

alter table public.bot_pricelist_panels enable row level security;
alter table public.bot_pricelist_items enable row level security;

drop policy if exists bot_pricelist_panels_select_linked on public.bot_pricelist_panels;
create policy bot_pricelist_panels_select_linked
  on public.bot_pricelist_panels for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_pricelist_panels.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );

drop policy if exists bot_pricelist_items_select_linked on public.bot_pricelist_items;
create policy bot_pricelist_items_select_linked
  on public.bot_pricelist_items for select
  using (
    exists (
      select 1 from public.bot_pricelist_panels p
      join public.bot_guilds g on g.guild_id = p.guild_id
      where p.id = bot_pricelist_items.panel_id
        and g.linked_user_id = auth.uid()
    )
  );
