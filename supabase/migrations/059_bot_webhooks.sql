-- Pro Channel ein vom Bot verwalteter Webhook (Token = secret, nur Service-Role-Zugriff)
create table if not exists public.bot_webhooks (
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  channel_id text not null,
  webhook_id text not null,
  webhook_token text not null,
  name text not null default 'Kanbanly',
  created_at timestamptz not null default now(),
  primary key (guild_id, channel_id)
);

-- RLS aktiv aber ohne Policies = niemand kann lesen außer Service-Role
alter table public.bot_webhooks enable row level security;
