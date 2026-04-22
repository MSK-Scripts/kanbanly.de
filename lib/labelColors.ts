export const LABEL_COLORS = {
  rose: {
    pill: 'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500/40',
    dot: 'bg-rose-500',
    swatch: 'bg-rose-500',
  },
  orange: {
    pill: 'bg-orange-500/20 text-orange-800 dark:text-orange-200 border-orange-500/40',
    dot: 'bg-orange-500',
    swatch: 'bg-orange-500',
  },
  amber: {
    pill: 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40',
    dot: 'bg-amber-500',
    swatch: 'bg-amber-500',
  },
  emerald: {
    pill: 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/40',
    dot: 'bg-emerald-500',
    swatch: 'bg-emerald-500',
  },
  teal: {
    pill: 'bg-teal-500/20 text-teal-800 dark:text-teal-200 border-teal-500/40',
    dot: 'bg-teal-500',
    swatch: 'bg-teal-500',
  },
  sky: {
    pill: 'bg-sky-500/20 text-sky-800 dark:text-sky-200 border-sky-500/40',
    dot: 'bg-sky-500',
    swatch: 'bg-sky-500',
  },
  violet: {
    pill: 'bg-violet-500/20 text-violet-800 dark:text-violet-200 border-violet-500/40',
    dot: 'bg-violet-500',
    swatch: 'bg-violet-500',
  },
  pink: {
    pill: 'bg-pink-500/20 text-pink-800 dark:text-pink-200 border-pink-500/40',
    dot: 'bg-pink-500',
    swatch: 'bg-pink-500',
  },
} as const;

export type LabelColor = keyof typeof LABEL_COLORS;

export const LABEL_COLOR_KEYS: LabelColor[] = Object.keys(
  LABEL_COLORS
) as LabelColor[];

type ColorEntry = { pill: string; dot: string; swatch: string };

const COLORS: Record<string, ColorEntry> = LABEL_COLORS;

export function labelPill(color: string): string {
  return COLORS[color]?.pill ?? LABEL_COLORS.violet.pill;
}

export function labelDot(color: string): string {
  return COLORS[color]?.dot ?? LABEL_COLORS.violet.dot;
}

export const LABEL_HEX: Record<string, string> = {
  rose: '#f43f5e',
  orange: '#f97316',
  amber: '#f59e0b',
  emerald: '#10b981',
  teal: '#14b8a6',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  pink: '#ec4899',
};

export function labelHex(color: string): string {
  return LABEL_HEX[color] ?? LABEL_HEX.violet;
}
