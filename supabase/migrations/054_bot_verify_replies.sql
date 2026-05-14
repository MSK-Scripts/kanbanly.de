-- Anpassbare Verify-Antworten (ephemerale DMs nach Button-Klick)
alter table public.bot_guilds
  add column if not exists verify_reply_success text,
  add column if not exists verify_reply_already text;
