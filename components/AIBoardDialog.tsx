'use client';
import { useActionState, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  previewAIBoard,
  createAIBoard,
  type AIBoardDraft,
} from '@/app/(app)/ai-actions';
import { labelPill } from '@/lib/labelColors';

type Props = {
  workspaceId: string;
  onClose: () => void;
};

export function AIBoardDialog({ workspaceId, onClose }: Props) {
  const [state, action, pending] = useActionState(previewAIBoard, null);
  const [mounted, setMounted] = useState(false);
  const [overrideName, setOverrideName] = useState('');

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (state?.ok && state.draft) setOverrideName(state.draft.name);
  }, [state]);

  if (!mounted) return null;

  const draft = state?.ok ? state.draft : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-surface border border-line shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-fg flex items-center gap-2">
              <span>Board mit KI erstellen</span>
              <span className="text-[10px] text-subtle font-mono tracking-wide uppercase bg-elev border border-line-strong rounded px-1.5 py-0.5">
                Beta
              </span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Beschreib dein Projekt, die KI baut Listen, Labels und
              Beispielkarten.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="text-subtle hover:text-fg-soft text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto board-scroll p-5 min-h-0">
          {!draft && (
            <form action={action} className="space-y-3">
              <div>
                <label
                  className="block text-xs text-muted mb-1"
                  htmlFor="ai-prompt"
                >
                  Was hast du vor?
                </label>
                <textarea
                  id="ai-prompt"
                  name="prompt"
                  required
                  rows={4}
                  maxLength={2000}
                  autoFocus
                  placeholder="z. B. FiveM-Roleplay-Server aufsetzen mit 3 Entwicklern — Planung, Skripting, Deployment, Community-Management"
                  className="w-full rounded-lg bg-elev/80 border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60 resize-none"
                />
                <p className="text-[11px] text-subtle mt-1">
                  Je konkreter, desto besser — Ziel, Rolle, Zeitraum, Team-Größe.
                </p>
              </div>

              {state && !state.ok && state.error && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs px-3 py-2">
                  {state.error}
                </div>
              )}

              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-[11px] px-3 py-2 leading-relaxed">
                Deine Eingabe wird an Google Gemini gesendet und dort laut
                Googles Bedingungen auch für Modell-Training genutzt. Schreib
                nichts Vertrauliches hinein.
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-lg bg-accent/90 hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-medium py-2 transition-colors"
                >
                  {pending ? 'KI denkt nach…' : 'Board vorschlagen'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg text-sm text-muted hover:text-fg-soft px-3 py-2"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          )}

          {draft && <DraftPreview draft={draft} />}
        </div>

        {draft && (
          <form
            action={createAIBoard}
            className="px-5 py-4 border-t border-line flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0"
          >
            <input type="hidden" name="workspace_id" value={workspaceId} />
            <input type="hidden" name="draft" value={JSON.stringify(draft)} />
            <input
              name="name"
              value={overrideName}
              onChange={(e) => setOverrideName(e.target.value)}
              placeholder={draft.name}
              maxLength={40}
              className="flex-1 rounded-lg bg-elev/80 border border-line-strong px-3 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
            />
            <button
              type="submit"
              className="rounded-lg bg-accent/90 hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              Board erstellen
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg text-xs text-muted hover:text-fg-soft px-2"
              title="Nochmal generieren"
            >
              Nochmal
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

function DraftPreview({ draft }: { draft: AIBoardDraft }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl bg-elev/40 border border-line p-3">
        <div className="text-2xl leading-none" aria-hidden>
          {draft.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-fg">{draft.name}</div>
          {draft.description && (
            <div className="text-xs text-muted mt-0.5 leading-snug">
              {draft.description}
            </div>
          )}
        </div>
      </div>

      {draft.labels.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
            Labels
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {draft.labels.map((l) => (
              <span
                key={l.name}
                className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium border ${labelPill(l.color)}`}
              >
                {l.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
          Listen &amp; Karten
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {draft.lists.map((list, i) => (
            <div
              key={i}
              className="rounded-lg bg-elev/40 border border-line p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-fg">
                  {list.title}
                </span>
                <span className="text-[10px] text-subtle font-mono tabular-nums">
                  {list.cards.length}
                </span>
              </div>
              <ul className="space-y-1">
                {list.cards.slice(0, 4).map((c, j) => (
                  <li
                    key={j}
                    className="text-[11px] text-fg-soft leading-snug truncate"
                    title={c.title}
                  >
                    • {c.title}
                  </li>
                ))}
                {list.cards.length > 4 && (
                  <li className="text-[10px] text-subtle">
                    + {list.cards.length - 4} weitere
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
