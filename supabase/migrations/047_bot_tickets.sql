-- Block 34: Bot — Tickets.
-- Ticket-Panel ist eine Nachricht mit "Ticket öffnen"-Button. Klick
-- erstellt einen privaten Channel sichtbar nur für den User und die
-- konfigurierte Staff-Rolle. Schließen archiviert / löscht den Channel.

create table if not exists public.bot_ticket_panels (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text not null,
  message_id text not null unique,
  staff_role_id text not null,
  category_id text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists bot_ticket_panels_guild_idx
  on public.bot_ticket_panels (guild_id);

create table if not exists public.bot_tickets (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text not null unique,
  owner_user_id text not null,
  panel_id uuid references public.bot_ticket_panels(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by text
);

create index if not exists bot_tickets_guild_idx
  on public.bot_tickets (guild_id, closed_at);
create index if not exists bot_tickets_owner_idx
  on public.bot_tickets (owner_user_id, closed_at);

alter table public.bot_ticket_panels enable row level security;
alter table public.bot_tickets enable row level security;

drop policy if exists bot_ticket_panels_select_linked on public.bot_ticket_panels;
create policy bot_ticket_panels_select_linked
  on public.bot_ticket_panels for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_ticket_panels.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );

drop policy if exists bot_tickets_select_linked on public.bot_tickets;
create policy bot_tickets_select_linked
  on public.bot_tickets for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_tickets.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );
