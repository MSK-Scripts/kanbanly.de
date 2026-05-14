'use client';

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  disabled?: boolean;
};

export function Switch({
  checked,
  onChange,
  size = 'md',
  ariaLabel,
  disabled = false,
}: Props) {
  const dim =
    size === 'sm'
      ? { box: 'h-5 w-9', thumb: 'h-3.5 w-3.5' }
      : { box: 'h-6 w-11', thumb: 'h-4 w-4' };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative ${dim.box} shrink-0 rounded-full border transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed ${
        checked
          ? 'bg-accent border-accent shadow-inner'
          : 'bg-elev border-line-strong hover:border-fg-soft/40'
      }`}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 ${dim.thumb} rounded-full bg-white shadow-md transition-all duration-200 ease-out ${
          checked ? 'right-0.5' : 'left-0.5'
        }`}
      />
    </button>
  );
}
