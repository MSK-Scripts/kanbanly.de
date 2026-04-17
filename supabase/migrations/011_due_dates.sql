-- Block 3b: due dates on cards.
alter table public.cards add column if not exists due_date date;
create index if not exists idx_cards_due_date on public.cards(due_date);
