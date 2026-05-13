-- Block 32: Bot — Reminders.
-- User setzen via /remind eine Erinnerung. Der Bot pollt regelmäßig
-- und postet im Original-Channel (falls noch vorhanden) oder per DM.

create table if not exists public.bot_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  guild_id text,            -- null = DM/global
  channel_id text,          -- null = nur DM
  due_at timestamptz not null,
  content text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  check (length(content) between 1 and 500)
);

create index if not exists bot_reminders_due_idx
  on public.bot_reminders (due_at)
  where delivered_at is null;

create index if not exists bot_reminders_user_idx
  on public.bot_reminders (user_id, delivered_at);

alter table public.bot_reminders enable row level security;

-- Web-Dashboard: User sieht nur die eigenen.
drop policy if exists bot_reminders_select_own on public.bot_reminders;
create policy bot_reminders_select_own
  on public.bot_reminders for select
  using (false); -- Bot nutzt Service-Role; Web-UI für Reminders kommt später.
