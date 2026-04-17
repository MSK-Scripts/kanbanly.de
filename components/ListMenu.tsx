'use client';
import { useBoard } from '@/store/boardStore';
import { confirm } from '@/store/confirmStore';
import { KebabMenu } from './KebabMenu';

export function ListMenu({ listId }: { listId: string }) {
  const deleteList = useBoard((s) => s.deleteList);
  const list = useBoard((s) => s.lists[listId]);

  return (
    <KebabMenu
      ariaLabel="Spalten-Menü"
      size="sm"
      actions={[
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
