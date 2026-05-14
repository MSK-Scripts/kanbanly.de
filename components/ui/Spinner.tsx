type Props = {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
};

const SIZE_CLASS: Record<NonNullable<Props['size']>, string> = {
  xs: 'h-3 w-3 border',
  sm: 'h-3.5 w-3.5 border',
  md: 'h-4 w-4 border-2',
};

export function Spinner({ size = 'sm', className = '' }: Props) {
  return (
    <span
      role="status"
      aria-label="Lädt"
      className={`inline-block animate-spinner rounded-full border-current border-t-transparent ${SIZE_CLASS[size]} ${className}`}
    />
  );
}
