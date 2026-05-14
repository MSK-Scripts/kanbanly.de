'use client';
import { useToastStore, type ToastKind } from '@/store/toastStore';
import { useMounted } from '@/lib/useMounted';
import { createPortal } from 'react-dom';

const ICON: Record<ToastKind, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

const COLOR_CLASS: Record<ToastKind, { iconBg: string; iconText: string; line: string }> = {
  success: {
    iconBg: 'bg-[var(--success-soft)]',
    iconText: 'text-[var(--success)]',
    line: 'border-[var(--success-line)]',
  },
  error: {
    iconBg: 'bg-[var(--danger-soft)]',
    iconText: 'text-[var(--danger)]',
    line: 'border-[var(--danger-line)]',
  },
  warning: {
    iconBg: 'bg-[var(--warning-soft)]',
    iconText: 'text-[var(--warning)]',
    line: 'border-[var(--warning-line)]',
  },
  info: {
    iconBg: 'bg-[var(--info-soft)]',
    iconText: 'text-[var(--info)]',
    line: 'border-[var(--info-line)]',
  },
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const mounted = useMounted();
  if (!mounted) return null;

  const body = (
    <div
      role="region"
      aria-label="Benachrichtigungen"
      className="pointer-events-none fixed top-4 right-4 z-[300] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((t) => {
        const c = COLOR_CLASS[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto animate-toast-in rounded-lg border ${c.line} bg-surface shadow-lg overflow-hidden`}
          >
            <div className="flex items-start gap-3 px-3.5 py-3">
              <div
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${c.iconBg} ${c.iconText} text-[12px] font-bold mt-0.5`}
                aria-hidden
              >
                {ICON[t.kind]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-fg leading-tight">{t.title}</div>
                {t.description && (
                  <div className="mt-0.5 text-[12px] text-muted leading-snug">
                    {t.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Schließen"
                className="text-subtle hover:text-fg transition-colors text-[15px] leading-none mt-0.5"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return createPortal(body, document.body);
}
