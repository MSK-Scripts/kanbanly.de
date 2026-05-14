'use client';
import { useEffect } from 'react';
import { useConfirmStore } from '@/store/confirmStore';
import { Button } from './ui/Button';

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
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-toast-in"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-md rounded-xl bg-surface border border-line shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-5 py-5 flex items-start gap-3">
          <div
            className={`h-10 w-10 shrink-0 rounded-full grid place-items-center text-base font-bold border ${
              danger
                ? 'bg-[var(--danger-soft)] border-[var(--danger-line)] text-[var(--danger)]'
                : 'bg-[var(--info-soft)] border-[var(--info-line)] text-[var(--info)]'
            }`}
            aria-hidden
          >
            {danger ? '!' : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-fg leading-tight">
              {title}
            </h2>
            {description && (
              <p className="text-[13px] text-muted mt-1.5 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="px-5 py-3 bg-elev/40 border-t border-line flex justify-end gap-2">
          <Button
            type="button"
            onClick={() => close(false)}
            variant="ghost"
            size="sm"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={() => close(true)}
            variant={danger ? 'danger' : 'primary'}
            size="sm"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
