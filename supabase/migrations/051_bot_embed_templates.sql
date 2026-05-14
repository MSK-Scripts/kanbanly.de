-- Embed-Templates: gespeicherte Embed-Vorlagen pro Server für den Embed-Creator

create table if not exists public.bot_embed_templates (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  name text not null,
  title text,
  description text,
  color integer,
  footer text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_embed_templates_guild_idx
  on public.bot_embed_templates (guild_id, updated_at desc);

alter table public.bot_embed_templates enable row level security;

drop policy if exists embed_tpl_select on public.bot_embed_templates;
create policy embed_tpl_select on public.bot_embed_templates
  for select using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_embed_templates.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists embed_tpl_insert on public.bot_embed_templates;
create policy embed_tpl_insert on public.bot_embed_templates
  for insert with check (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_embed_templates.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists embed_tpl_update on public.bot_embed_templates;
create policy embed_tpl_update on public.bot_embed_templates
  for update using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_embed_templates.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );

drop policy if exists embed_tpl_delete on public.bot_embed_templates;
create policy embed_tpl_delete on public.bot_embed_templates
  for delete using (
    exists (
      select 1 from public.bot_guilds bg
      where bg.guild_id = bot_embed_templates.guild_id
        and bg.linked_user_id = auth.uid()
    )
  );
