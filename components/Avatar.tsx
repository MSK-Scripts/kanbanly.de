type Size = 'xs' | 'sm' | 'md';

type Props = {
  username: string | null;
  size?: Size;
  title?: string;
  className?: string;
};

function hashToHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

const SIZE_CLASSES: Record<Size, string> = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
};

export function Avatar({ username, size = 'sm', title, className = '' }: Props) {
  const safe = (username ?? '?').trim() || '?';
  const initials = safe.slice(0, 2).toUpperCase();
  const hue = hashToHue(safe);
  return (
    <span
      title={title ?? (username ? `@${username}` : undefined)}
      className={`${SIZE_CLASSES[size]} rounded-full grid place-items-center font-semibold text-white shrink-0 ${className}`}
      style={{ backgroundColor: `hsl(${hue} 55% 42%)` }}
    >
      {initials}
    </span>
  );
}
