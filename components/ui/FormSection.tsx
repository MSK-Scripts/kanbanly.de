type Props = {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  variant?: 'default' | 'inset';
};

export function FormSection({
  title,
  description,
  badge,
  action,
  children,
  footer,
  variant = 'default',
}: Props) {
  return (
    <section
      className={`rounded-xl border border-line bg-surface ${
        variant === 'inset' ? 'shadow-none' : 'shadow-sm shadow-black/5'
      }`}
    >
      <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-fg leading-tight">
              {title}
            </h3>
            {badge}
          </div>
          {description && (
            <p className="mt-1 text-[12.5px] text-muted leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="px-5 py-5 space-y-4">{children}</div>
      {footer && (
        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line bg-elev/30 rounded-b-xl">
          {footer}
        </footer>
      )}
    </section>
  );
}

export function FormRow({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium text-fg-soft mb-1.5">
        {label}
        {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11.5px] text-subtle leading-snug">{hint}</p>}
    </div>
  );
}

export function FormDivider() {
  return <div className="my-1 border-t border-line/60" />;
}
