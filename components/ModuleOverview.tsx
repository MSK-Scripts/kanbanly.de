'use client';

import { useMemo, useState } from 'react';
import { toggleBotModule } from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { Switch } from './Switch';
import { Spinner } from './ui/Spinner';
import { StatusPill } from './ui/Status';

export type ModuleKey =
  | 'welcome'
  | 'autoroles'
  | 'logging'
  | 'levels'
  | 'automod'
  | 'reactionroles'
  | 'booster'
  | 'sticky'
  | 'channelmodes'
  | 'embed'
  | 'verify'
  | 'antiraid'
  | 'giveaways'
  | 'birthday'
  | 'rolebadges'
  | 'afk'
  | 'suggestions'
  | 'invitetracker'
  | 'helpdesk'
  | 'tempvoice'
  | 'dailyimage'
  | 'teamlist';

type ModuleDef = {
  key: ModuleKey;
  name: string;
  description: string;
  tab: string;
  enabled: boolean;
  /** Toggle-State live editierbar (Boolean-Spalte) */
  toggleable: boolean;
  /** Anzahl konfigurierter Einträge für nicht-toggleable Module (z.B. Sticky-Channels) */
  count?: number;
  isNew?: boolean;
};

type Props = {
  guildId: string;
  modules: ModuleDef[];
};

const GearIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-3.5 w-3.5"
    aria-hidden
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export function ModuleOverview({ guildId, modules }: Props) {
  const [query, setQuery] = useState('');
  const [optimisticState, setOptimisticState] = useState<Record<string, boolean>>({});
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q),
    );
  }, [modules, query]);

  const total = modules.length;
  const active = modules.filter((m) =>
    optimisticState[m.key] !== undefined ? optimisticState[m.key] : m.enabled,
  ).length;

  const navigate = (tab: string) => {
    window.location.hash = tab;
  };

  const onToggle = async (mod: ModuleDef, next: boolean) => {
    if (!mod.toggleable) return;
    // Optimistisches Update — UI reagiert sofort.
    setOptimisticState((prev) => ({ ...prev, [mod.key]: next }));
    setBusyKeys((prev) => {
      const s = new Set(prev);
      s.add(mod.key);
      return s;
    });
    try {
      const r = await toggleBotModule(guildId, mod.key, next);
      if (r.ok) {
        toast.success(`${mod.name} ${next ? 'aktiviert' : 'deaktiviert'}`);
      } else {
        // Roll back optimistic.
        setOptimisticState((prev) => ({ ...prev, [mod.key]: !next }));
        toast.error('Konnte nicht ändern', r.error);
      }
    } catch (err) {
      setOptimisticState((prev) => ({ ...prev, [mod.key]: !next }));
      toast.error('Konnte nicht ändern', err instanceof Error ? err.message : undefined);
    } finally {
      setBusyKeys((prev) => {
        const s = new Set(prev);
        s.delete(mod.key);
        return s;
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-fg leading-tight">Module</h2>
          <p className="text-[12.5px] text-muted mt-0.5">
            {active} von {total} aktiv
          </p>
        </div>
        <div className="hidden sm:flex h-1.5 w-32 overflow-hidden rounded-full border border-line bg-elev">
          <div
            className="h-full bg-gradient-to-r from-accent to-accent-hover transition-all duration-500"
            style={{ width: `${(active / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen…"
          className="w-full rounded-lg bg-elev border border-line-strong pl-10 pr-3 py-2.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong p-10 text-center text-sm text-subtle">
          Kein Modul gefunden für „{query}".
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => {
            const live =
              optimisticState[m.key] !== undefined ? optimisticState[m.key] : m.enabled;
            return (
              <article
                key={m.key}
                className="group relative rounded-xl border border-line bg-surface hover:border-line-strong transition-all flex flex-col"
              >
                <div className="p-4 flex-1">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <h3 className="text-[15px] font-semibold text-fg leading-tight">
                        {m.name}
                      </h3>
                      {m.isNew && (
                        <StatusPill kind="success">Neu</StatusPill>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {busyKeys.has(m.key) && (
                        <span className="text-subtle">
                          <Spinner size="xs" />
                        </span>
                      )}
                      {m.toggleable ? (
                        <Switch
                          checked={live}
                          onChange={(next) => onToggle(m, next)}
                          size="sm"
                          ariaLabel={`${m.name} umschalten`}
                        />
                      ) : (
                        <StatusPill kind={m.enabled ? 'success' : 'neutral'} dot>
                          {m.count !== undefined
                            ? `${m.count} aktiv`
                            : m.enabled
                            ? 'Konfiguriert'
                            : 'Tool'}
                        </StatusPill>
                      )}
                    </div>
                  </div>
                  <p className="text-[12.5px] text-muted leading-relaxed line-clamp-2">
                    {m.description}
                  </p>
                </div>
                <div className="px-4 py-2.5 border-t border-line/60">
                  <button
                    type="button"
                    onClick={() => navigate(m.tab)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-soft)] hover:text-fg transition-colors"
                  >
                    <GearIcon />
                    Einstellungen
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
