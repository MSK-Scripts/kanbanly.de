import type { BoardFilters, CardT } from '@/store/boardStore';

type FilterInputs = {
  filters: BoardFilters;
  cards: Record<string, CardT>;
  assignees: Record<string, string[]>;
  cardLabels: Record<string, string[]>;
};

function dueBucketOf(dueIso: string | null): BoardFilters['due'] {
  if (!dueIso) return 'none';
  const due = new Date(dueIso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 7) return 'week';
  return 'later';
}

export function cardMatchesFilters(
  cardId: string,
  { filters, cards, assignees, cardLabels }: FilterInputs
): boolean {
  const card = cards[cardId];
  if (!card) return false;

  if (filters.labels.length > 0) {
    const ids = cardLabels[cardId] ?? [];
    if (!filters.labels.some((id) => ids.includes(id))) return false;
  }

  if (filters.assignees.length > 0) {
    const ids = assignees[cardId] ?? [];
    if (!filters.assignees.some((id) => ids.includes(id))) return false;
  }

  if (filters.due !== 'all') {
    if (dueBucketOf(card.due_date) !== filters.due) return false;
  }

  return true;
}

export function isFilterActive(filters: BoardFilters): boolean {
  return (
    filters.labels.length > 0 ||
    filters.assignees.length > 0 ||
    filters.due !== 'all'
  );
}

export function activeFilterCount(filters: BoardFilters): number {
  let n = 0;
  if (filters.labels.length > 0) n++;
  if (filters.assignees.length > 0) n++;
  if (filters.due !== 'all') n++;
  return n;
}
