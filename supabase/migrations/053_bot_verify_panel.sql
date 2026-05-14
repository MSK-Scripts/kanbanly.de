-- Verify-Panel anpassbar: Titel, Farbe, Button-Label, Button-Emoji, Button-Style
alter table public.bot_guilds
  add column if not exists verify_panel_title text,
  add column if not exists verify_panel_color integer,
  add column if not exists verify_button_label text,
  add column if not exists verify_button_emoji text,
  add column if not exists verify_button_style text
    check (verify_button_style in ('primary', 'secondary', 'success', 'danger'));
