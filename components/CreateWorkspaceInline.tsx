'use client';
import { useState } from 'react';
import { createWorkspace } from '@/app/(app)/actions';
import { PlusIcon } from './Icons';

export function CreateWorkspaceInline() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
      >
        <PlusIcon />
        Neuer Workspace
      </button>
    );
  }

  return (
    <form
      action={createWorkspace}
      className="flex flex-col gap-2 rounded-md bg-surface border border-line p-2"
    >
      <input
        autoFocus
        name="name"
        required
        placeholder="Workspace-Name"
        className="w-full rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent"
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
          className="rounded-md px-3 text-xs text-muted hover:text-fg-soft"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
