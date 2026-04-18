'use client';
import { useState, useTransition } from 'react';
import {
  createBoardFromTemplate,
  setTemplatePublic,
  deleteTemplate,
} from '@/app/(app)/template-actions';
import { confirm } from '@/store/confirmStore';

type Template = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_emoji: string | null;
  is_built_in: boolean;
  is_public: boolean;
  use_count: number;
};

type Workspace = { id: string; name: string; slug: string };

export function TemplateCard({
  template,
  workspaces,
  authorUsername,
  isOwner,
}: {
  template: Template;
  workspaces: Workspace[];
  authorUsername: string | null;
  isOwner: boolean;
}) {
  const [useOpen, setUseOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const togglePublic = () => {
    startTransition(async () => {
      await setTemplatePublic(template.id, !template.is_public);
    });
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Template "${template.title}" löschen?`,
      description:
        'Das Template wird für alle entfernt, die es bisher nicht benutzt haben.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteTemplate(template.id);
    });
  };

  return (
    <div className="rounded-xl bg-surface/60 border border-line/80 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none shrink-0" aria-hidden>
          {template.cover_emoji || '📋'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-fg leading-tight">
            {template.title}
          </h3>
          {template.description && (
            <p className="text-xs text-muted mt-1 leading-snug line-clamp-3">
              {template.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-subtle font-mono tabular-nums">
        {template.is_built_in ? (
          <span className="rounded-none bg-accent/15 text-accent-soft px-1.5 py-0.5 border border-accent/30">
            Kuratiert
          </span>
        ) : authorUsername ? (
          <span>@{authorUsername}</span>
        ) : null}
        {isOwner && !template.is_built_in && (
          <span
            className={`rounded-none px-1.5 py-0.5 border ${
              template.is_public
                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30'
                : 'bg-elev border-line-strong text-muted'
            }`}
          >
            {template.is_public ? 'Öffentlich' : 'Privat'}
          </span>
        )}
        <span className="ml-auto">{template.use_count}× genutzt</span>
      </div>

      {!useOpen ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUseOpen(true)}
            className="flex-1 rounded-none bg-accent/90 hover:bg-accent-hover text-white text-xs font-medium py-1.5 transition-colors"
          >
            Verwenden
          </button>
          {isOwner && !template.is_built_in && (
            <>
              <button
                type="button"
                onClick={togglePublic}
                disabled={isPending}
                className="rounded-none border border-line-strong hover:border-muted bg-elev/60 hover:bg-elev text-fg-soft hover:text-fg text-xs px-2.5 py-1.5 transition-colors disabled:opacity-50"
                title={
                  template.is_public
                    ? 'Aus der Community entfernen'
                    : 'Für alle sichtbar machen'
                }
              >
                {template.is_public ? 'Privat machen' : 'Veröffentlichen'}
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={isPending}
                className="rounded-none border border-rose-500/40 hover:border-rose-500/70 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs px-2.5 py-1.5 transition-colors disabled:opacity-50"
              >
                Löschen
              </button>
            </>
          )}
        </div>
      ) : (
        <UseForm
          templateId={template.id}
          defaultName={template.title}
          workspaces={workspaces}
          onCancel={() => setUseOpen(false)}
        />
      )}
    </div>
  );
}

function UseForm({
  templateId,
  defaultName,
  workspaces,
  onCancel,
}: {
  templateId: string;
  defaultName: string;
  workspaces: Workspace[];
  onCancel: () => void;
}) {
  if (workspaces.length === 0) {
    return (
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs p-2.5">
        Du brauchst erst einen Workspace. Erstelle einen im Dashboard.
      </div>
    );
  }

  return (
    <form
      action={createBoardFromTemplate}
      className="flex flex-col gap-2 rounded-lg bg-elev/40 p-2.5"
    >
      <input type="hidden" name="template_id" value={templateId} />
      <input
        name="name"
        required
        defaultValue={defaultName}
        placeholder="Board-Name"
        className="rounded-md bg-elev/80 border border-line-strong px-2.5 py-1.5 text-xs text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
      />
      <select
        name="workspace_id"
        defaultValue={workspaces[0]?.id}
        required
        className="rounded-md bg-elev/80 border border-line-strong px-2.5 py-1.5 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-none bg-accent/90 hover:bg-accent-hover text-white text-xs font-medium py-1.5 transition-colors"
        >
          Board erstellen
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-none text-xs text-muted hover:text-fg-soft px-2"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
