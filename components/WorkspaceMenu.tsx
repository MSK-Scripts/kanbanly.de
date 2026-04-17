'use client';
import { useRouter } from 'next/navigation';
import { deleteWorkspace } from '@/app/(app)/actions';
import { confirm } from '@/store/confirmStore';
import { KebabMenu } from './KebabMenu';

type Props = {
  workspaceId: string;
  workspaceName: string;
};

export function WorkspaceMenu({ workspaceId, workspaceName }: Props) {
  const router = useRouter();

  return (
    <KebabMenu
      ariaLabel="Workspace-Menü"
      actions={[
        {
          label: 'Workspace löschen',
          danger: true,
          onSelect: async () => {
            const ok = await confirm({
              title: `Workspace "${workspaceName}" löschen?`,
              description:
                'Alle Boards, Mitgliedschaften und Einladungen in diesem Workspace werden entfernt. Das kann nicht rückgängig gemacht werden.',
              confirmLabel: 'Löschen',
              danger: true,
            });
            if (!ok) return;
            await deleteWorkspace(workspaceId);
            router.push('/');
          },
        },
      ]}
    />
  );
}
