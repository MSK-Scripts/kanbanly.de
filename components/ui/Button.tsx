'use client';
import { forwardRef } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  children: React.ReactNode;
  fullWidth?: boolean;
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'bg-accent text-white border border-accent hover:bg-accent-hover hover:border-accent-hover shadow-sm shadow-accent/20',
  secondary:
    'bg-elev text-fg border border-line-strong hover:bg-elev-hover hover:border-fg-soft/40',
  ghost:
    'bg-transparent text-muted border border-transparent hover:text-fg hover:bg-elev',
  danger:
    'bg-[var(--danger)] text-white border border-[var(--danger)] hover:opacity-90 shadow-sm shadow-[var(--danger)]/20',
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    leadingIcon,
    trailingIcon,
    children,
    fullWidth,
    className = '',
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed ${
        SIZE_CLASS[size]
      } ${VARIANT_CLASS[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'sm' ? 'xs' : 'sm'} />
      ) : (
        leadingIcon && <span className="shrink-0 inline-flex">{leadingIcon}</span>
      )}
      <span className={loading ? 'opacity-80' : ''}>{children}</span>
      {!loading && trailingIcon && (
        <span className="shrink-0 inline-flex">{trailingIcon}</span>
      )}
    </button>
  );
});
