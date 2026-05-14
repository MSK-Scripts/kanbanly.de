-- Tickets v2: Panel-Customization, Transcripts, Welcome-Message

alter table public.bot_ticket_panels
  add column if not exists title text not null default '🎫 Support öffnen',
  add column if not exists description text not null default 'Klick den Button unten, um ein privates Ticket zu eröffnen.',
  add column if not exists button_label text not null default 'Ticket öffnen',
  add column if not exists button_emoji text,
  add column if not exists button_style text not null default 'primary'
    check (button_style in ('primary', 'secondary', 'success', 'danger')),
  add column if not exists color integer,
  add column if not exists welcome_message text;

alter table public.bot_tickets
  add column if not exists transcript jsonb,
  add column if not exists transcript_saved_at timestamptz;
