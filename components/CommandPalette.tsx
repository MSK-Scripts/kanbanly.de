'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  searchContent,
  type SearchResults,
} from '@/app/(app)/search-actions';

type Action = {
  label: string;
  hint: string;
  href: string;
  icon: string;
};

const QUICK_ACTIONS: Action[] = [
  { label: 'Zum Dashboard', hint: 'Übersicht aller Workspaces', href: '/dashboard', icon: '🏠' },
  { label: 'Meine Karten', hint: 'Alle mir zugewiesenen Karten', href: '/meine-karten', icon: '📌' },
  { label: 'Diese Woche', hint: 'Wrap-up: Fällig, überfällig, neu', href: '/woche', icon: '📅' },
  { label: 'Deine Stats', hint: 'Vanity-Metrics über deine Aktivität', href: '/stats', icon: '📈' },
  { label: 'Templates durchstöbern', hint: 'Kuratiert, Community, Deine', href: '/templates', icon: '📋' },
];

type Item =
  | { kind: 'action'; action: Action }
  | { kind: 'board'; id: string; name: string; slug: string; workspace: string | null }
  | { kind: 'workspace'; id: string; name: string; slug: string }
  | { kind: 'card'; id: string; title: string; boardSlug: string; boardName: string };

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({
    boards: [],
    workspaces: [],
    cards: [],
  });
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    void runSearch('');
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void runSearch(query);
    }, 120);
    return () => clearTimeout(t);
  }, [query]);

  async function runSearch(q: string) {
    try {
      const res = await searchContent(q);
      setResults(res);
      setActiveIdx(0);
    } catch {
      setResults({ boards: [], workspaces: [], cards: [] });
    }
  }

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const filteredActions = QUICK_ACTIONS.filter(
      (a) => !q || a.label.toLowerCase().includes(q)
    );
    return [
      ...filteredActions.map((a) => ({ kind: 'action' as const, action: a })),
      ...results.boards.map((b) => ({
        kind: 'board' as const,
        id: b.id,
        name: b.name,
        slug: b.slug,
        workspace: b.workspace_name,
      })),
      ...results.workspaces.map((w) => ({
        kind: 'workspace' as const,
        id: w.id,
        name: w.name,
        slug: w.slug,
      })),
      ...results.cards.map((c) => ({
        kind: 'card' as const,
        id: c.id,
        title: c.title,
        boardSlug: c.board_slug,
        boardName: c.board_name,
      })),
    ];
  }, [query, results]);

  const activate = useCallback(
    (item: Item) => {
      if (item.kind === 'action') router.push(item.action.href);
      else if (item.kind === 'board') router.push(`/boards/${item.slug}`);
      else if (item.kind === 'workspace')
        router.push(`/workspaces/${item.slug}`);
      else if (item.kind === 'card')
        router.push(`/boards/${item.boardSlug}?card=${item.id}`);
      onClose();
    },
    [router, onClose]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => (items.length ? (i + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) =>
          items.length ? (i - 1 + items.length) % items.length : 0
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[activeIdx];
        if (item) activate(item);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [items, activeIdx, activate, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${activeIdx}"]`
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const actionsCount = items.filter((i) => i.kind === 'action').length;
  const boardsCount = items.filter((i) => i.kind === 'board').length;
  const workspacesCount = items.filter((i) => i.kind === 'workspace').length;
  const cardsCount = items.filter((i) => i.kind === 'card').length;

  let runningIdx = 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[1800] flex items-start justify-center bg-black/60 p-4 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-md bg-surface border border-line shadow-md overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <span className="text-muted" aria-hidden>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Board, Karte, Workspace suchen…"
            className="flex-1 bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
          />
          <kbd className="hidden sm:inline text-[10px] text-subtle font-mono border border-line-strong px-1.5 py-0.5 rounded">
            esc
          </kbd>
        </div>

        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto board-scroll py-1"
        >
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-subtle">
              Nichts gefunden. Versuch anders zu suchen.
            </div>
          ) : (
            <>
              {actionsCount > 0 && (
                <Section title="Aktionen">
                  {items
                    .filter((i): i is Extract<Item, { kind: 'action' }> => i.kind === 'action')
                    .map((i) => {
                      const idx = runningIdx++;
                      return (
                        <Row
                          key={`a-${i.action.href}`}
                          idx={idx}
                          active={activeIdx === idx}
                          onClick={() => activate(i)}
                          icon={i.action.icon}
                          title={i.action.label}
                          subtitle={i.action.hint}
                        />
                      );
                    })}
                </Section>
              )}
              {boardsCount > 0 && (
                <Section title="Boards">
                  {items
                    .filter((i): i is Extract<Item, { kind: 'board' }> => i.kind === 'board')
                    .map((i) => {
                      const idx = runningIdx++;
                      return (
                        <Row
                          key={`b-${i.id}`}
                          idx={idx}
                          active={activeIdx === idx}
                          onClick={() => activate(i)}
                          icon="▦"
                          title={i.name}
                          subtitle={i.workspace ?? undefined}
                        />
                      );
                    })}
                </Section>
              )}
              {workspacesCount > 0 && (
                <Section title="Workspaces">
                  {items
                    .filter((i): i is Extract<Item, { kind: 'workspace' }> => i.kind === 'workspace')
                    .map((i) => {
                      const idx = runningIdx++;
                      return (
                        <Row
                          key={`w-${i.id}`}
                          idx={idx}
                          active={activeIdx === idx}
                          onClick={() => activate(i)}
                          icon="◧"
                          title={i.name}
                        />
                      );
                    })}
                </Section>
              )}
              {cardsCount > 0 && (
                <Section title="Karten">
                  {items
                    .filter((i): i is Extract<Item, { kind: 'card' }> => i.kind === 'card')
                    .map((i) => {
                      const idx = runningIdx++;
                      return (
                        <Row
                          key={`c-${i.id}`}
                          idx={idx}
                          active={activeIdx === idx}
                          onClick={() => activate(i)}
                          icon="✦"
                          title={i.title}
                          subtitle={i.boardName}
                        />
                      );
                    })}
                </Section>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-line text-[10px] text-subtle font-mono">
          <span>
            <kbd className="px-1 border border-line-strong rounded">↑</kbd>{' '}
            <kbd className="px-1 border border-line-strong rounded">↓</kbd>{' '}
            navigieren
          </span>
          <span>
            <kbd className="px-1 border border-line-strong rounded">↵</kbd>{' '}
            öffnen
          </span>
          <span className="ml-auto">
            <kbd className="px-1 border border-line-strong rounded">?</kbd>{' '}
            Shortcuts
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-subtle uppercase tracking-wide">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({
  idx,
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  idx: number;
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      data-idx={idx}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
        active ? 'bg-accent/15 text-fg' : 'text-fg-soft hover:bg-elev'
      }`}
    >
      <span className="w-5 text-center text-muted" aria-hidden>
        {icon}
      </span>
      <span className="flex-1 min-w-0 truncate">{title}</span>
      {subtitle && (
        <span className="text-[11px] text-subtle truncate max-w-[40%]">
          {subtitle}
        </span>
      )}
    </button>
  );
}
