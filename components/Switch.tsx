'use client';

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
};

export function Switch({ checked, onChange, size = 'md', ariaLabel }: Props) {
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
      onClick={() => onChange(!checked)}
      className={`relative ${dim.box} shrink-0 rounded-full border transition-colors ${
        checked
          ? 'bg-accent border-accent'
          : 'bg-elev border-line-strong'
      }`}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 ${dim.thumb} rounded-full bg-white shadow transition-all ${
          checked ? 'right-0.5' : 'left-0.5'
        }`}
      />
    </button>
  );
}
