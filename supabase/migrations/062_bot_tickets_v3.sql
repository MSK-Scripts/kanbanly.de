-- Tickets v3: Multi-Button, Multi-Staff, Feedback, Reminder/SLA, Custom-Embed-Payload
--
-- Datenmodell:
-- - bot_ticket_panels: zusätzlich staff_role_ids[], buttons jsonb, select_menu jsonb,
--   embed_payload jsonb (Full-Embed-Editor optional), feedback_*, *_minutes/hours
-- - bot_tickets: last_message_at, staff_first_response_at, reminded_inactive, reminded_sla
-- - bot_ticket_feedback: rating + comment pro Ticket

alter table public.bot_ticket_panels
  add column if not exists staff_role_ids text[] not null default '{}',
  add column if not exists buttons jsonb not null default '[]'::jsonb,
  add column if not exists select_menu jsonb,
  add column if not exists embed_payload jsonb,
  add column if not exists feedback_enabled boolean not null default false,
  add column if not exists feedback_mode text not null default 'dm'
    check (feedback_mode in ('dm', 'channel', 'both')),
  add column if not exists feedback_question text not null default
    'Wie zufrieden warst du mit dem Support?',
  add column if not exists inactivity_hours integer,
  add column if not exists auto_close_hours integer,
  add column if not exists staff_sla_minutes integer,
  add column if not exists name_pattern text not null default 'ticket-{user}';

-- Migrationspfad: vorhandene Single-Staff-Role in Array übernehmen.
update public.bot_ticket_panels
   set staff_role_ids = array[staff_role_id]
 where staff_role_id is not null
   and (staff_role_ids is null or array_length(staff_role_ids, 1) is null);

alter table public.bot_tickets
  add column if not exists last_message_at timestamptz,
  add column if not exists staff_first_response_at timestamptz,
  add column if not exists reminded_inactive boolean not null default false,
  add column if not exists reminded_sla boolean not null default false,
  add column if not exists selected_button_id text;

create index if not exists bot_tickets_inactivity_idx
  on public.bot_tickets (closed_at, last_message_at);

create table if not exists public.bot_ticket_feedback (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.bot_tickets(id) on delete cascade,
  guild_id text not null,
  user_id text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists bot_ticket_feedback_guild_idx
  on public.bot_ticket_feedback (guild_id, created_at desc);
create index if not exists bot_ticket_feedback_ticket_idx
  on public.bot_ticket_feedback (ticket_id);

alter table public.bot_ticket_feedback enable row level security;

drop policy if exists bot_ticket_feedback_select_linked on public.bot_ticket_feedback;
create policy bot_ticket_feedback_select_linked
  on public.bot_ticket_feedback for select
  using (
    exists (
      select 1 from public.bot_guilds
      where bot_guilds.guild_id = bot_ticket_feedback.guild_id
        and bot_guilds.linked_user_id = auth.uid()
    )
  );
