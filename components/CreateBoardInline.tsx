'use client';
import Link from 'next/link';
import { useState } from 'react';
import { createBoard } from '@/app/(app)/actions';
import { PlusIcon } from './Icons';

export function CreateBoardInline({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-full min-h-[84px] flex items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong hover:border-accent-hover/60 hover:bg-surface/40 text-muted hover:text-fg text-sm transition-colors"
      >
        <PlusIcon />
        Neues Board
      </button>
    );
  }

  return (
    <form
      action={createBoard}
      className="rounded-xl bg-surface/60 border border-line/80 p-3 flex flex-col gap-2"
    >
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <input
        autoFocus
        name="name"
        required
        placeholder="Board-Name"
        className="rounded-md bg-elev/80 border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-md bg-accent/90 hover:bg-accent-hover text-white text-xs font-medium py-1.5"
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
      <Link
        href="/templates"
        className="text-[11px] text-subtle hover:text-accent-soft text-center mt-0.5"
      >
        Oder aus Template erstellen →
      </Link>
    </form>
  );
}
