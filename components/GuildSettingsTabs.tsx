'use client';
import { useEffect, useState, type ReactNode } from 'react';

export type Tab = {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
  description?: string;
  /** true = ohne den Standard-Card-Wrapper, für Tabs deren Inhalt schon Cards/Grids bringt */
  noCardWrapper?: boolean;
};

type Props = {
  tabs: Tab[];
  defaultTab?: string;
};

export function GuildSettingsTabs({ tabs, defaultTab }: Props) {
  const initial = defaultTab && tabs.some((t) => t.id === defaultTab)
    ? defaultTab
    : tabs[0]?.id ?? '';
  const [active, setActive] = useState(initial);

  // Hash-Routing: #welcome, #automod etc. — damit links sharebar.
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace(/^#/, '');
      if (h && tabs.some((t) => t.id === h)) setActive(h);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [tabs]);

  const switchTo = (id: string) => {
    setActive(id);
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', `#${id}`);
    }
  };

  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
      <nav className="md:sticky md:top-4 self-start">
        <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {tabs.map((t) => {
            const isActive = t.id === active;
            return (
              <li key={t.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => switchTo(t.id)}
                  className={`w-full rounded-md px-3 py-2 text-sm transition-colors text-left whitespace-nowrap ${
                    isActive
                      ? 'bg-accent text-white font-medium'
                      : 'text-fg-soft hover:bg-elev hover:text-fg'
                  }`}
                >
                  {t.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-fg">{current?.label}</h2>
          {current?.description && (
            <p className="text-xs text-muted mt-1">{current.description}</p>
          )}
        </div>
        {current?.noCardWrapper ? (
          current.content
        ) : (
          <div className="rounded-md bg-surface border border-line p-5">
            {current?.content}
          </div>
        )}
      </div>
    </div>
  );
}
