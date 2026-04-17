'use client';
import { renameBoard, renameWorkspace } from '@/app/(app)/actions';
import { InlineEditableText } from './InlineEditableText';

export function RenameWorkspaceTitle({
  id,
  name,
  viewClassName,
  inputClassName,
}: {
  id: string;
  name: string;
  viewClassName?: string;
  inputClassName?: string;
}) {
  return (
    <InlineEditableText
      value={name}
      onSave={(v) => renameWorkspace(id, v)}
      ariaLabel="Workspace umbenennen"
      viewClassName={viewClassName}
      inputClassName={inputClassName}
    />
  );
}

export function RenameBoardTitle({
  id,
  name,
  viewClassName,
  inputClassName,
}: {
  id: string;
  name: string;
  viewClassName?: string;
  inputClassName?: string;
}) {
  return (
    <InlineEditableText
      value={name}
      onSave={(v) => renameBoard(id, v)}
      ariaLabel="Board umbenennen"
      viewClassName={viewClassName}
      inputClassName={inputClassName}
    />
  );
}
