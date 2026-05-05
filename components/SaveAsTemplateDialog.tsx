'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { saveBoardAsTemplate } from '@/app/(app)/template-actions';

type Props = {
  boardId: string;
  defaultTitle: string;
  onClose: () => void;
};

const EMOJI_OPTIONS = [
  '📋', '🏃', '✍️', '🎯', '🚀', '🐛', '💡', '📅',
  '🎨', '🔧', '📊', '🎓', '💼', '📣', '🧪', '⚙️',
];

export function SaveAsTemplateDialog({
  boardId,
  defaultTitle,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [emoji, setEmoji] = useState('📋');

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-md bg-surface border border-line shadow-md p-5">
        <h2 className="text-lg font-semibold text-fg mb-1">
          Als Template speichern
        </h2>
        <p className="text-xs text-muted mb-4">
          Die aktuellen Listen, Karten, Checklisten und Labels werden als
          Kopie gespeichert. Änderungen am Board wirken sich nicht mehr auf
          das Template aus.
        </p>

        <form action={saveBoardAsTemplate} className="flex flex-col gap-3">
          <input type="hidden" name="board_id" value={boardId} />
          <input type="hidden" name="cover_emoji" value={emoji} />

          <div>
            <label
              htmlFor="template-title"
              className="block text-xs text-muted mb-1"
            >
              Titel
            </label>
            <input
              id="template-title"
              name="title"
              required
              maxLength={80}
              defaultValue={defaultTitle}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
            />
          </div>

          <div>
            <label
              htmlFor="template-desc"
              className="block text-xs text-muted mb-1"
            >
              Beschreibung <span className="text-subtle">(optional)</span>
            </label>
            <textarea
              id="template-desc"
              name="description"
              rows={3}
              maxLength={500}
              placeholder="Wofür ist dieses Template? Wann hilft es?"
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60 resize-none"
            />
          </div>

          <div>
            <p className="text-xs text-muted mb-1.5">Icon</p>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`h-8 w-8 grid place-items-center rounded-md text-base transition-colors ${
                    emoji === e
                      ? 'bg-accent/20 ring-2 ring-accent-hover/60'
                      : 'bg-elev hover:bg-elev'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="is_public"
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span className="text-xs text-fg-soft">
              In der Community veröffentlichen
              <span className="block text-subtle">
                Alle Nutzer können dein Template sehen und daraus Boards
                erstellen. Du kannst das jederzeit wieder auf privat stellen.
              </span>
            </span>
          </label>

          <div className="flex items-center gap-2 mt-1">
            <button
              type="submit"
              className="flex-1 rounded-none bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2 transition-colors"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-none text-sm text-muted hover:text-fg-soft px-3 py-2"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
