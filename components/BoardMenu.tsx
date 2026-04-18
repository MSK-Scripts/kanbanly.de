'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteBoard } from '@/app/(app)/actions';
import { confirm } from '@/store/confirmStore';
import { KebabMenu } from './KebabMenu';
import { SaveAsTemplateDialog } from './SaveAsTemplateDialog';

type Props = {
  boardId: string;
  boardName: string;
  workspaceId: string;
};

export function BoardMenu({ boardId, boardName, workspaceId }: Props) {
  const router = useRouter();
  const [saveTplOpen, setSaveTplOpen] = useState(false);

  return (
    <>
      <KebabMenu
        ariaLabel="Board-Menü"
        actions={[
          {
            label: 'Als Template speichern',
            onSelect: () => setSaveTplOpen(true),
          },
          {
            label: 'Board löschen',
            danger: true,
            onSelect: async () => {
              const ok = await confirm({
                title: `Board "${boardName}" löschen?`,
                description:
                  'Alle Listen, Karten, Checklisten und Einladungen werden mitgelöscht.',
                confirmLabel: 'Löschen',
                danger: true,
              });
              if (!ok) return;
              await deleteBoard(boardId);
              router.push(`/workspaces/${workspaceId}`);
            },
          },
        ]}
      />
      {saveTplOpen && (
        <SaveAsTemplateDialog
          boardId={boardId}
          defaultTitle={boardName}
          onClose={() => setSaveTplOpen(false)}
        />
      )}
    </>
  );
}
