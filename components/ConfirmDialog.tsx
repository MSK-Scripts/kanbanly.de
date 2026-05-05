'use client';
import { useEffect } from 'react';
import { useConfirmStore } from '@/store/confirmStore';

export function ConfirmDialog() {
  const open = useConfirmStore((s) => s.open);
  const title = useConfirmStore((s) => s.title);
  const description = useConfirmStore((s) => s.description);
  const confirmLabel = useConfirmStore((s) => s.confirmLabel);
  const cancelLabel = useConfirmStore((s) => s.cancelLabel);
  const danger = useConfirmStore((s) => s.danger);
  const close = useConfirmStore((s) => s.close);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-sm rounded-md bg-surface border border-line shadow-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-5">
          <h2 className="text-base font-semibold text-fg">{title}</h2>
          {description && (
            <p className="text-sm text-muted mt-2 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        <div className="px-5 py-3 bg-bg border-t border-line flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="rounded-md px-4 py-1.5 text-sm text-fg-soft hover:text-fg hover:bg-elev transition-colors"
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium text-white transition-colors ${
              danger
                ? 'bg-rose-500/90 hover:bg-rose-500'
                : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
