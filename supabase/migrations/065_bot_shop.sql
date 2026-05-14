-- Bestellsystem: Stripe-Connect-Integration pro Guild + Produkte + Orders.
--
-- Modell: Plattform-Stripe-Account (kanbanly) verbindet Server-Owner ihre
-- eigenen Stripe-Konten via Connect Standard OAuth. Geld geht direkt an den
-- Server-Owner. Plattform-Fee optional (application_fee_amount).

-- ───── Stripe-Connect-Felder auf bot_guilds ─────
alter table public.bot_guilds
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_onboarded_at timestamptz,
  add column if not exists shop_order_category_id text,
  add column if not exists shop_staff_role_id text,
  add column if not exists shop_currency text not null default 'eur',
  add column if not exists shop_platform_fee_bps integer not null default 0
    check (shop_platform_fee_bps >= 0 and shop_platform_fee_bps <= 2000);

-- ───── Produkte ─────
create table if not exists public.bot_products (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  name text not null,
  description text not null default '',
  -- Preis in Cent.
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'eur',
  image_url text,
  active boolean not null default true,
  stock integer,                              -- null = unbegrenzt
  position integer not null default 0,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_products_guild_idx
  on public.bot_products (guild_id, active);

-- ───── Shop-Panel (Embed mit Produkt-Buttons) ─────
create table if not exists public.bot_shop_panels (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text not null,
  message_id text,
  title text not null default '🛒 Shop',
  description text not null default '',
  color integer,
  product_ids uuid[] not null default '{}',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_shop_panels_guild_idx
  on public.bot_shop_panels (guild_id);

-- ───── Orders ─────
create table if not exists public.bot_orders (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,                      -- Discord user id
  product_id uuid references public.bot_products(id) on delete set null,
  product_name text not null,                 -- Snapshot
  amount_cents integer not null,
  currency text not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'refunded', 'fulfilled', 'failed')),
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  ticket_channel_id text,                     -- Channel der nach Zahlung aufgemacht wird
  customer_email text,
  customer_name text,
  notes text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  fulfilled_by text
);

create index if not exists bot_orders_guild_idx
  on public.bot_orders (guild_id, created_at desc);
create index if not exists bot_orders_user_idx
  on public.bot_orders (user_id, status);
create index if not exists bot_orders_intent_idx
  on public.bot_orders (stripe_payment_intent_id);

-- ───── RLS ─────
alter table public.bot_products enable row level security;
alter table public.bot_shop_panels enable row level security;
alter table public.bot_orders enable row level security;

drop policy if exists bot_products_select_linked on public.bot_products;
create policy bot_products_select_linked on public.bot_products for select
  using (
    exists (
      select 1 from public.bot_guilds g
      where g.guild_id = bot_products.guild_id
        and g.linked_user_id = auth.uid()
    )
  );

drop policy if exists bot_shop_panels_select_linked on public.bot_shop_panels;
create policy bot_shop_panels_select_linked on public.bot_shop_panels for select
  using (
    exists (
      select 1 from public.bot_guilds g
      where g.guild_id = bot_shop_panels.guild_id
        and g.linked_user_id = auth.uid()
    )
  );

drop policy if exists bot_orders_select_linked on public.bot_orders;
create policy bot_orders_select_linked on public.bot_orders for select
  using (
    exists (
      select 1 from public.bot_guilds g
      where g.guild_id = bot_orders.guild_id
        and g.linked_user_id = auth.uid()
    )
  );
