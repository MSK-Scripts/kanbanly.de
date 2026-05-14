-- Pro Giveaway konfigurierbares Embed-Design
alter table public.bot_giveaways
  add column if not exists embed_color integer,
  add column if not exists embed_title text,
  add column if not exists embed_description text,
  add column if not exists button_label text,
  add column if not exists button_emoji text,
  add column if not exists button_style text
    check (button_style in ('primary', 'secondary', 'success', 'danger'));
