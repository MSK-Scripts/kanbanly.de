'use client';
import Link from 'next/link';
import { useState } from 'react';
import { createBoard } from '@/app/(app)/actions';
import { PlusIcon } from './Icons';
import { AIBoardDialog } from './AIBoardDialog';

export function CreateBoardInline({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [aiOpen, setAIOpen] = useState(false);

  if (!open) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-[44px] flex items-center justify-center gap-2 rounded-md border border-dashed border-line-strong hover:border-accent-hover/60 hover:bg-surface text-muted hover:text-fg text-sm transition-colors"
        >
          <PlusIcon />
          Neues Board
        </button>
        {aiOpen && (
          <AIBoardDialog
            workspaceId={workspaceId}
            onClose={() => setAIOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <form
        action={createBoard}
        className="rounded-md bg-surface border border-line p-3 flex flex-col gap-2"
      >
        <input type="hidden" name="workspace_id" value={workspaceId} />
        <input
          autoFocus
          name="name"
          required
          placeholder="Board-Name"
          className="rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-medium py-1.5"
          >
            Erstellen
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md px-2 text-xs text-muted hover:text-fg-soft"
          >
            Abbrechen
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setAIOpen(true);
            }}
            className="text-[11px] text-accent-soft hover:text-accent-hover"
          >
            ✨ Teste die KI
          </button>
          <Link
            href="/templates"
            className="text-[11px] text-subtle hover:text-accent-soft"
          >
            Oder aus Template →
          </Link>
        </div>
      </form>
      {aiOpen && (
        <AIBoardDialog
          workspaceId={workspaceId}
          onClose={() => setAIOpen(false)}
        />
      )}
    </>
  );
}
