import Link from 'next/link';

type Props = {
  boardSlug: string;
  active: 'board' | 'calendar';
};

export function BoardTabs({ boardSlug, active }: Props) {
  const tabs: Array<{ key: 'board' | 'calendar'; label: string; href: string }> =
    [
      { key: 'board', label: 'Board', href: `/boards/${boardSlug}` },
      {
        key: 'calendar',
        label: 'Kalender',
        href: `/boards/${boardSlug}/kalender`,
      },
    ];

  return (
    <div className="flex items-center gap-1 px-3 sm:px-6 pt-2 border-b border-line/60">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors ${
            active === t.key
              ? 'bg-surface text-fg border border-line border-b-transparent'
              : 'text-muted hover:text-fg-soft'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
