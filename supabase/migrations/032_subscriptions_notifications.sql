-- Block 22: Card Subscriptions + Notifications.
--
-- card_subscribers: User die über Änderungen einer Karte informiert
-- werden wollen (auch ohne Assignee zu sein). Bei Assignment + bei
-- eigenen Kommentaren wird automatisch subscribed.
--
-- notifications: Persistente, per-User Benachrichtigungen mit
-- jsonb-Payload, damit das Schema flexibel bleibt.

create table if not exists public.card_subscribers (
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

create index if not exists card_subscribers_user_idx
  on public.card_subscribers (user_id);

alter table public.card_subscribers enable row level security;

drop policy if exists "cs_select" on public.card_subscribers;
create policy "cs_select" on public.card_subscribers
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_view_board(
      public.list_board_id(
        (select list_id from public.cards where id = card_subscribers.card_id)
      )
    )
  );

-- User darf nur sich selbst (un)subscriben.
drop policy if exists "cs_write" on public.card_subscribers;
create policy "cs_write" on public.card_subscribers
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.can_view_board(
      public.list_board_id(
        (select list_id from public.cards where id = card_subscribers.card_id)
      )
    )
  );

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  card_id uuid references public.cards(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "n_select" on public.notifications;
create policy "n_select" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "n_update" on public.notifications;
create policy "n_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "n_delete" on public.notifications;
create policy "n_delete" on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- Insert: nur wenn der Empfänger ebenfalls Zugriff aufs Board hat und
-- der Actor (=auth.uid()) auch. Ohne den ersten Check könnte jeder
-- Workspace-Mitglied jedem anderen Mitglied beliebige Notifications
-- unterjubeln — Phishing-Vektor. Mit dem Check müssen sowohl Sender
-- als auch Empfänger zur Board-Membership gehören.
drop policy if exists "n_insert" on public.notifications;
create policy "n_insert" on public.notifications
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and (
      card_id is null
      or (
        public.can_view_board(
          public.list_board_id(
            (select list_id from public.cards where id = notifications.card_id)
          )
        )
        and exists (
          select 1
          from public.cards c
          where c.id = notifications.card_id
            and (
              -- Empfänger muss das Board ebenfalls sehen können.
              -- Wir prüfen das über workspace_members oder board_members.
              exists (
                select 1 from public.workspace_members wm
                join public.boards b on b.workspace_id = wm.workspace_id
                join public.lists l on l.board_id = b.id
                where l.id = c.list_id and wm.user_id = notifications.user_id
              )
              or exists (
                select 1 from public.board_members bm
                join public.lists l on l.board_id = bm.board_id
                where l.id = c.list_id and bm.user_id = notifications.user_id
              )
            )
        )
      )
    )
  );
