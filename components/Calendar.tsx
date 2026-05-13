'use client';
import { useMemo } from 'react';
import { useBoard } from '@/store/boardStore';
import { Avatar } from './Avatar';
import { labelPill } from '@/lib/labelColors';

type Bucket = 'overdue' | 'today' | 'week' | 'later';

const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: 'Überfällig',
  today: 'Heute',
  week: 'Diese Woche',
  later: 'Später',
};

const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'week', 'later'];

function bucketFor(dueIso: string): Bucket {
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

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

export function Calendar() {
  const cards = useBoard((s) => s.cards);
  const lists = useBoard((s) => s.lists);
  const listOrder = useBoard((s) => s.listOrder);
  const setOpenCardId = useBoard((s) => s.setOpenCardId);
  const assignees = useBoard((s) => s.assignees);
  const memberProfiles = useBoard((s) => s.memberProfiles);
  const labels = useBoard((s) => s.labels);
  const cardLabels = useBoard((s) => s.cardLabels);

  const listByCardId = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    for (const lid of listOrder) {
      const l = lists[lid];
      if (!l) continue;
      for (const cid of l.cardIds) {
        map.set(cid, { id: l.id, title: l.title });
      }
    }
    return map;
  }, [lists, listOrder]);

  const grouped = useMemo(() => {
    const result: Record<Bucket, Array<{ cardId: string; due: string }>> = {
      overdue: [],
      today: [],
      week: [],
      later: [],
    };
    for (const [cardId, card] of Object.entries(cards)) {
      if (!card.due_date) continue;
      const bucket = bucketFor(card.due_date);
      result[bucket].push({ cardId, due: card.due_date });
    }
    for (const b of BUCKET_ORDER) {
      result[b].sort((a, b2) => a.due.localeCompare(b2.due));
    }
    return result;
  }, [cards]);

  const totalWithDue = BUCKET_ORDER.reduce(
    (sum, b) => sum + grouped[b].length,
    0
  );

  if (totalWithDue === 0) {
    return (
      <div className="flex-1 overflow-y-auto board-scroll p-3 sm:p-6">
        <div className="max-w-3xl mx-auto mt-10 rounded-md bg-surface border border-line p-8 sm:p-10 text-center">
          <h3 className="text-base font-semibold text-fg mb-1">
            Noch keine Fälligkeiten
          </h3>
          <p className="text-sm text-muted">
            Setz bei Karten im Modal ein „Fällig am&quot;, dann tauchen sie hier
            chronologisch auf.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto board-scroll p-3 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {BUCKET_ORDER.map((bucket) => {
          const items = grouped[bucket];
          if (items.length === 0) return null;
          const accent =
            bucket === 'overdue'
              ? 'text-rose-700 dark:text-rose-300'
              : bucket === 'today'
              ? 'text-amber-700 dark:text-amber-300'
              : bucket === 'week'
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-fg-soft';
          return (
            <section key={bucket}>
              <div className="flex items-baseline justify-between mb-2">
                <h2
                  className={`text-xs font-semibold uppercase tracking-wide ${accent}`}
                >
                  {BUCKET_LABELS[bucket]}
                </h2>
                <span className="text-[11px] text-subtle tabular-nums font-mono">
                  {items.length}
                </span>
              </div>
              <ul className="space-y-1.5">
                {items.map(({ cardId, due }) => {
                  const card = cards[cardId];
                  if (!card) return null;
                  const list = listByCardId.get(cardId);
                  const labelIds = cardLabels[cardId] ?? [];
                  const assignedUserIds = assignees[cardId] ?? [];
                  return (
                    <li key={cardId}>
                      <button
                        type="button"
                        onClick={() => setOpenCardId(cardId)}
                        className="w-full text-left rounded-md bg-surface border border-line hover:border-accent-hover/50 hover:bg-surface transition-colors p-3 flex items-start gap-3"
                      >
                        <span className="text-[11px] text-muted tabular-nums font-mono pt-0.5 shrink-0 w-20">
                          {formatDate(due)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {labelIds.slice(0, 3).map((lid) => {
                              const lbl = labels[lid];
                              if (!lbl) return null;
                              return (
                                <span
                                  key={lid}
                                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium border ${labelPill(lbl.color)}`}
                                >
                                  {lbl.name}
                                </span>
                              );
                            })}
                          </div>
                          <div className="text-sm text-fg font-medium leading-snug break-words">
                            {card.title}
                          </div>
                          {list && (
                            <div className="text-[11px] text-subtle mt-0.5">
                              in {list.title}
                            </div>
                          )}
                        </div>
                        {assignedUserIds.length > 0 && (
                          <div className="flex -space-x-1.5 shrink-0">
                            {assignedUserIds.slice(0, 3).map((uid) => {
                              const m = memberProfiles[uid];
                              return (
                                <Avatar
                                  key={uid}
                                  username={m?.username ?? null}
                                  size="xs"
                                  className="ring-2 ring-surface"
                                />
                              );
                            })}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
