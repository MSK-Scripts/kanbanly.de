type Kind = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

const PILL_CLASS: Record<Kind, string> = {
  success:
    'bg-[var(--success-soft)] text-[var(--success)] border-[var(--success-line)]',
  danger:
    'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger-line)]',
  warning:
    'bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning-line)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)] border-[var(--info-line)]',
  neutral: 'bg-elev text-subtle border-line-strong',
};

const DOT_CLASS: Record<Kind, string> = {
  success: 'bg-[var(--success)]',
  danger: 'bg-[var(--danger)]',
  warning: 'bg-[var(--warning)]',
  info: 'bg-[var(--info)]',
  neutral: 'bg-muted/40',
};

export function StatusPill({
  kind = 'neutral',
  children,
  dot = false,
  className = '',
}: {
  kind?: Kind;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide ${PILL_CLASS[kind]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[kind]}`} />}
      {children}
    </span>
  );
}

export function StatusBanner({
  kind,
  title,
  children,
  className = '',
}: {
  kind: Kind;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-[12.5px] leading-relaxed ${PILL_CLASS[kind]} ${className}`}
    >
      {title && <div className="font-semibold mb-0.5">{title}</div>}
      <div className={title ? 'opacity-90' : ''}>{children}</div>
    </div>
  );
}
