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
        className="flex items-center gap-2 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
      >
        <PlusIcon />
        Neuer Workspace
      </button>
    );
  }

  return (
    <form
      action={createWorkspace}
      className="flex items-center gap-2 rounded-md bg-surface border border-line p-2"
    >
      <input
        autoFocus
        name="name"
        required
        placeholder="Workspace-Name"
        className="rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
      />
      <button
        type="submit"
        className="rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-medium px-3 py-1.5"
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
    </form>
  );
}
