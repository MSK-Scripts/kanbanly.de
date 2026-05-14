-- Multi-Embed-Creator v2: JSON-Payload mit Content + N Embeds + Fields + alle Felder

alter table public.bot_embed_templates
  add column if not exists payload jsonb;

-- Bestehende Templates auf das neue JSON-Format migrieren (one-shot)
update public.bot_embed_templates
set payload = jsonb_build_object(
  'content', null,
  'embeds', jsonb_build_array(
    jsonb_build_object(
      'title', title,
      'description', description,
      'color', color,
      'footer', case when footer is not null then jsonb_build_object('text', footer) else null end,
      'image', image_url
    )
  )
)
where payload is null;
