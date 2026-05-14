-- Premium-Subscriptions pro Guild.
--
-- Modell: Stripe-Subscriptions auf dem Plattform-Account (kanbanly), drei
-- Preis-Pläne (monthly/quarterly/biannual). 14-Tage-Trial 1x pro Guild,
-- ohne Card-Required (trial_started_at + status='trial').

create table if not exists public.bot_subscriptions (
  guild_id text primary key,
  status text not null default 'none'
    check (status in ('none', 'trial', 'active', 'past_due', 'cancelled', 'expired')),
  plan text
    check (plan is null or plan in ('monthly', 'quarterly', 'biannual')),
  trial_started_at timestamptz,
  trial_used_at timestamptz,     -- gesetzt sobald Trial je gestartet wurde, auch nach Ablauf
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_subscriptions_status_idx
  on public.bot_subscriptions (status, current_period_end);
create index if not exists bot_subscriptions_stripe_sub_idx
  on public.bot_subscriptions (stripe_subscription_id);
create index if not exists bot_subscriptions_stripe_cust_idx
  on public.bot_subscriptions (stripe_customer_id);

alter table public.bot_subscriptions enable row level security;

drop policy if exists bot_subscriptions_select_linked on public.bot_subscriptions;
create policy bot_subscriptions_select_linked on public.bot_subscriptions for select
  using (
    exists (
      select 1 from public.bot_guilds g
      where g.guild_id = bot_subscriptions.guild_id
        and g.linked_user_id = auth.uid()
    )
  );
