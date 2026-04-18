-- Block 11: Board-Templates
-- - User kann Boards als Templates speichern (privat oder public)
-- - Neue Boards können aus Template erstellt werden
-- - Built-Ins sind kuratiert, nicht editierbar

create table if not exists public.board_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  cover_emoji text default '📋',
  author_id uuid references auth.users(id) on delete set null,
  is_built_in boolean not null default false,
  is_public boolean not null default false,
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_board_templates_public
  on public.board_templates(is_public, created_at desc)
  where is_public = true;

create index if not exists idx_board_templates_author
  on public.board_templates(author_id);

create table if not exists public.template_labels (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.board_templates(id) on delete cascade,
  name text not null,
  color text not null check (color in (
    'rose', 'orange', 'amber', 'emerald', 'teal', 'sky', 'violet', 'pink'
  ))
);
create index if not exists idx_template_labels_template on public.template_labels(template_id);

create table if not exists public.template_lists (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.board_templates(id) on delete cascade,
  title text not null,
  position integer not null
);
create index if not exists idx_template_lists_template on public.template_lists(template_id, position);

create table if not exists public.template_cards (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.board_templates(id) on delete cascade,
  list_id uuid not null references public.template_lists(id) on delete cascade,
  title text not null,
  description text,
  position integer not null,
  label_ids uuid[] not null default '{}'
);
create index if not exists idx_template_cards_list on public.template_cards(list_id, position);

create table if not exists public.template_tasks (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.template_cards(id) on delete cascade,
  title text not null,
  position integer not null
);
create index if not exists idx_template_tasks_card on public.template_tasks(card_id, position);

-- ============ HELPERS ============

create or replace function public.can_view_template(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.board_templates bt
    where bt.id = t
      and (bt.is_public or bt.is_built_in or bt.author_id = auth.uid())
  );
$$;

create or replace function public.can_edit_template(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.board_templates bt
    where bt.id = t and bt.author_id = auth.uid() and not bt.is_built_in
  );
$$;

create or replace function public.template_card_template_id(cid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select template_id from public.template_cards where id = cid;
$$;

-- ============ RLS ============

alter table public.board_templates enable row level security;
alter table public.template_labels enable row level security;
alter table public.template_lists enable row level security;
alter table public.template_cards enable row level security;
alter table public.template_tasks enable row level security;

-- board_templates
drop policy if exists "bt_select" on public.board_templates;
create policy "bt_select" on public.board_templates
  for select to authenticated
  using (is_public or is_built_in or author_id = auth.uid());

drop policy if exists "bt_insert" on public.board_templates;
create policy "bt_insert" on public.board_templates
  for insert to authenticated
  with check (author_id = auth.uid() and not is_built_in);

drop policy if exists "bt_update" on public.board_templates;
create policy "bt_update" on public.board_templates
  for update to authenticated
  using (author_id = auth.uid() and not is_built_in);

drop policy if exists "bt_delete" on public.board_templates;
create policy "bt_delete" on public.board_templates
  for delete to authenticated
  using (author_id = auth.uid() and not is_built_in);

-- template_labels
drop policy if exists "tl_select" on public.template_labels;
create policy "tl_select" on public.template_labels
  for select to authenticated using (public.can_view_template(template_id));
drop policy if exists "tl_insert" on public.template_labels;
create policy "tl_insert" on public.template_labels
  for insert to authenticated with check (public.can_edit_template(template_id));
drop policy if exists "tl_update" on public.template_labels;
create policy "tl_update" on public.template_labels
  for update to authenticated using (public.can_edit_template(template_id));
drop policy if exists "tl_delete" on public.template_labels;
create policy "tl_delete" on public.template_labels
  for delete to authenticated using (public.can_edit_template(template_id));

-- template_lists
drop policy if exists "tli_select" on public.template_lists;
create policy "tli_select" on public.template_lists
  for select to authenticated using (public.can_view_template(template_id));
drop policy if exists "tli_insert" on public.template_lists;
create policy "tli_insert" on public.template_lists
  for insert to authenticated with check (public.can_edit_template(template_id));
drop policy if exists "tli_update" on public.template_lists;
create policy "tli_update" on public.template_lists
  for update to authenticated using (public.can_edit_template(template_id));
drop policy if exists "tli_delete" on public.template_lists;
create policy "tli_delete" on public.template_lists
  for delete to authenticated using (public.can_edit_template(template_id));

-- template_cards
drop policy if exists "tc_select" on public.template_cards;
create policy "tc_select" on public.template_cards
  for select to authenticated using (public.can_view_template(template_id));
drop policy if exists "tc_insert" on public.template_cards;
create policy "tc_insert" on public.template_cards
  for insert to authenticated with check (public.can_edit_template(template_id));
drop policy if exists "tc_update" on public.template_cards;
create policy "tc_update" on public.template_cards
  for update to authenticated using (public.can_edit_template(template_id));
drop policy if exists "tc_delete" on public.template_cards;
create policy "tc_delete" on public.template_cards
  for delete to authenticated using (public.can_edit_template(template_id));

-- template_tasks (indirect via template_cards)
drop policy if exists "tt_select" on public.template_tasks;
create policy "tt_select" on public.template_tasks
  for select to authenticated
  using (public.can_view_template(public.template_card_template_id(card_id)));
drop policy if exists "tt_insert" on public.template_tasks;
create policy "tt_insert" on public.template_tasks
  for insert to authenticated
  with check (public.can_edit_template(public.template_card_template_id(card_id)));
drop policy if exists "tt_update" on public.template_tasks;
create policy "tt_update" on public.template_tasks
  for update to authenticated
  using (public.can_edit_template(public.template_card_template_id(card_id)));
drop policy if exists "tt_delete" on public.template_tasks;
create policy "tt_delete" on public.template_tasks
  for delete to authenticated
  using (public.can_edit_template(public.template_card_template_id(card_id)));

-- ============ BUILT-IN TEMPLATES ============
-- Ein Setup-Block mit einem Minimal-Sprint-Template, damit User direkt
-- was zum Ausprobieren haben.

do $$
declare
  t_id uuid;
  l_todo uuid;
  l_doing uuid;
  l_review uuid;
  l_done uuid;
  lbl_feature uuid;
  lbl_bug uuid;
  lbl_docs uuid;
begin
  if not exists (select 1 from public.board_templates where slug = 'sprint-scrum') then
    insert into public.board_templates (slug, title, description, cover_emoji, is_built_in, is_public)
    values (
      'sprint-scrum',
      'Sprint / Scrum',
      'Klassisches Scrum-Board mit Backlog, In Arbeit, Review, Erledigt. Drei Standard-Labels für Feature, Bug, Docs.',
      '🏃',
      true, true
    ) returning id into t_id;

    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Feature', 'violet') returning id into lbl_feature;
    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Bug', 'rose') returning id into lbl_bug;
    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Docs', 'sky') returning id into lbl_docs;

    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Backlog', 0) returning id into l_todo;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'In Arbeit', 1) returning id into l_doing;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Review', 2) returning id into l_review;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Erledigt', 3) returning id into l_done;

    insert into public.template_cards (template_id, list_id, title, description, position, label_ids) values
      (t_id, l_todo, 'Sprint-Ziel definieren', 'Ein Satz pro Sprint, der das Ziel beschreibt.', 0, array[lbl_docs]),
      (t_id, l_todo, 'User-Story 1', null, 1, array[lbl_feature]),
      (t_id, l_doing, 'Sprint-Setup', 'Board konfigurieren und Ziel festlegen.', 0, array[lbl_docs]);
  end if;

  if not exists (select 1 from public.board_templates where slug = 'content-kalender') then
    insert into public.board_templates (slug, title, description, cover_emoji, is_built_in, is_public)
    values (
      'content-kalender',
      'Content-Kalender',
      'Redaktionsplanung für Blog, Newsletter oder Social. Von Idee bis Veröffentlichung.',
      '✍️',
      true, true
    ) returning id into t_id;

    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Blog', 'emerald') returning id into lbl_feature;
    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Social', 'sky') returning id into lbl_bug;
    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Newsletter', 'amber') returning id into lbl_docs;

    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Ideen', 0) returning id into l_todo;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'In Arbeit', 1) returning id into l_doing;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Review', 2) returning id into l_review;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Veröffentlicht', 3) returning id into l_done;

    insert into public.template_cards (template_id, list_id, title, description, position, label_ids) values
      (t_id, l_todo, 'Themen-Brainstorm', 'Sammle erstmal alle Ideen — filtern kommt später.', 0, null),
      (t_id, l_todo, 'Launch-Ankündigung', null, 1, array[lbl_feature, lbl_bug]);
  end if;

  if not exists (select 1 from public.board_templates where slug = 'personal-gtd') then
    insert into public.board_templates (slug, title, description, cover_emoji, is_built_in, is_public)
    values (
      'personal-gtd',
      'Personal GTD',
      'Getting Things Done für dich allein: Inbox, Heute, Diese Woche, Warten-auf, Erledigt.',
      '🎯',
      true, true
    ) returning id into t_id;

    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Wichtig', 'rose') returning id into lbl_feature;
    insert into public.template_labels (template_id, name, color) values
      (t_id, 'Routine', 'teal') returning id into lbl_bug;

    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Inbox', 0) returning id into l_todo;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Heute', 1) returning id into l_doing;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Diese Woche', 2) returning id into l_review;
    insert into public.template_lists (template_id, title, position) values
      (t_id, 'Erledigt', 3) returning id into l_done;
  end if;
end $$;
