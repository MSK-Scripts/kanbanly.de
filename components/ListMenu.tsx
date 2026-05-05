'use client';
import { useBoard } from '@/store/boardStore';
import { confirm } from '@/store/confirmStore';
import { KebabMenu } from './KebabMenu';

export function ListMenu({ listId }: { listId: string }) {
  const deleteList = useBoard((s) => s.deleteList);
  const setWipLimit = useBoard((s) => s.setWipLimit);
  const list = useBoard((s) => s.lists[listId]);

  const wipLabel = list?.wipLimit
    ? `WIP-Limit ändern (${list.wipLimit})`
    : 'WIP-Limit setzen';

  return (
    <KebabMenu
      ariaLabel="Spalten-Menü"
      size="sm"
      actions={[
        {
          label: wipLabel,
          onSelect: () => {
            const current = list?.wipLimit ? String(list.wipLimit) : '';
            const input = window.prompt(
              'Maximale Karten in dieser Spalte? (leer lassen zum Entfernen)',
              current
            );
            if (input === null) return;
            const trimmed = input.trim();
            if (trimmed === '') {
              void setWipLimit(listId, null);
              return;
            }
            const n = parseInt(trimmed, 10);
            if (!Number.isFinite(n) || n <= 0) return;
            void setWipLimit(listId, n);
          },
        },
        {
          label: 'Spalte löschen',
          danger: true,
          onSelect: async () => {
            const cardCount = list?.cardIds.length ?? 0;
            const ok = await confirm({
              title: `Spalte "${list?.title}" löschen?`,
              description:
                cardCount > 0
                  ? `Die ${cardCount} Karten darin werden mitgelöscht.`
                  : 'Die leere Spalte wird entfernt.',
              confirmLabel: 'Löschen',
              danger: true,
            });
            if (ok) deleteList(listId);
          },
        },
      ]}
    />
  );
}
