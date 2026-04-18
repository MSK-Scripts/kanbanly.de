'use client';
import { useMemo } from 'react';
import { useBoard } from '@/store/boardStore';
import { Avatar } from './Avatar';
import { labelPill } from '@/lib/labelColors';
import { Card } from './Card';
import { cardMatchesFilters, isFilterActive } from '@/lib/filterCards';

type Group = {
  key: string;
  label: React.ReactNode;
  matches: (cardId: string) => boolean;
};

export function SwimlaneBoard() {
  const listOrder = useBoard((s) => s.listOrder);
  const lists = useBoard((s) => s.lists);
  const cards = useBoard((s) => s.cards);
  const assignees = useBoard((s) => s.assignees);
  const cardLabels = useBoard((s) => s.cardLabels);
  const memberProfiles = useBoard((s) => s.memberProfiles);
  const memberOrder = useBoard((s) => s.memberOrder);
  const labels = useBoard((s) => s.labels);
  const labelOrder = useBoard((s) => s.labelOrder);
  const groupBy = useBoard((s) => s.groupBy);
  const filters = useBoard((s) => s.filters);
  const filterOn = isFilterActive(filters);

  const groups = useMemo<Group[]>(() => {
    if (groupBy === 'assignee') {
      const gs: Group[] = memberOrder.map((uid) => {
        const m = memberProfiles[uid];
        return {
          key: uid,
          label: (
            <div className="flex items-center gap-2">
              <Avatar username={m?.username ?? null} size="sm" />
              <span className="text-xs text-fg font-medium">
                @{m?.username ?? 'Unbekannt'}
              </span>
            </div>
          ),
          matches: (cardId) => (assignees[cardId] ?? []).includes(uid),
        };
      });
      gs.push({
        key: '__none',
        label: (
          <span className="text-xs text-muted font-medium">
            Nicht zugewiesen
          </span>
        ),
        matches: (cardId) => (assignees[cardId] ?? []).length === 0,
      });
      return gs;
    }
    if (groupBy === 'label') {
      const gs: Group[] = labelOrder.map((lid) => {
        const l = labels[lid];
        return {
          key: lid,
          label: l ? (
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium border ${labelPill(l.color)}`}
            >
              {l.name}
            </span>
          ) : null,
          matches: (cardId) => (cardLabels[cardId] ?? []).includes(lid),
        };
      });
      gs.push({
        key: '__none',
        label: (
          <span className="text-xs text-muted font-medium">Kein Label</span>
        ),
        matches: (cardId) => (cardLabels[cardId] ?? []).length === 0,
      });
      return gs;
    }
    return [];
  }, [groupBy, memberOrder, memberProfiles, assignees, labelOrder, labels, cardLabels]);

  return (
    <div className="flex-1 overflow-auto board-scroll p-3 sm:p-6 min-h-0">
      <div className="inline-flex items-center gap-2 mb-3 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300">
        Swimlane-Modus: Drag &amp; Drop ist deaktiviert. Setze die Gruppierung
        auf „Keine" um Karten zu verschieben.
      </div>
      <div className="flex flex-col gap-6 min-w-min">
        {groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-2">
            <div className="sticky left-0 z-[1] flex items-center">{g.label}</div>
            <div className="flex gap-3 sm:gap-4 items-start">
              {listOrder.map((lid) => {
                const list = lists[lid];
                if (!list) return null;
                const ids = list.cardIds.filter(
                  (cid) =>
                    g.matches(cid) &&
                    (!filterOn ||
                      cardMatchesFilters(cid, {
                        filters,
                        cards,
                        assignees,
                        cardLabels,
                      }))
                );
                return (
                  <div
                    key={lid}
                    className="w-[280px] shrink-0 rounded-xl bg-surface/50 border border-line/60"
                  >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-line/60">
                      <span className="text-xs font-semibold text-fg-soft truncate">
                        {list.title}
                      </span>
                      <span className="text-[10px] text-subtle tabular-nums font-mono">
                        {ids.length}
                      </span>
                    </div>
                    <div className="p-2 space-y-2 min-h-[40px]">
                      {ids.length === 0 ? (
                        <div className="text-center text-[11px] text-subtle py-1">
                          —
                        </div>
                      ) : (
                        ids.map((cid) => (
                          <Card key={cid} id={cid} isDragging={false} />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
