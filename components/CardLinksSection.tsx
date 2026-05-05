'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useBoard } from '@/store/boardStore';
import { linkCards, unlinkCards } from '@/app/(app)/card-link-actions';

type Linked = {
  id: string;
  title: string;
  list_title: string | null;
};

type Props = {
  cardId: string;
};

export function CardLinksSection({ cardId }: Props) {
  const cards = useBoard((s) => s.cards);
  const lists = useBoard((s) => s.lists);
  const setOpenCardId = useBoard((s) => s.setOpenCardId);

  const [linked, setLinked] = useState<Linked[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase
      .from('card_links')
      .select('from_card_id, to_card_id')
      .eq('kind', 'related')
      .or(`from_card_id.eq.${cardId},to_card_id.eq.${cardId}`);
    if (!data) {
      setLinked([]);
      return;
    }
    const otherIds = Array.from(
      new Set(
        (data as Array<{ from_card_id: string; to_card_id: string }>).map((r) =>
          r.from_card_id === cardId ? r.to_card_id : r.from_card_id
        )
      )
    );
    if (otherIds.length === 0) {
      setLinked([]);
      return;
    }
    const { data: cardRows } = await supabase
      .from('cards')
      .select('id, title, lists(title)')
      .in('id', otherIds);
    const out = ((cardRows ?? []) as Array<{
      id: string;
      title: string;
      lists: { title: string } | { title: string }[] | null;
    }>).map((r) => ({
      id: r.id,
      title: r.title,
      list_title: Array.isArray(r.lists)
        ? r.lists[0]?.title ?? null
        : r.lists?.title ?? null,
    }));
    setLinked(out);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  const linkedIds = useMemo(() => new Set(linked.map((l) => l.id)), [linked]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(cards)
      .filter((c) => c.id !== cardId && !linkedIds.has(c.id))
      .filter((c) => (q ? c.title.toLowerCase().includes(q) : true))
      .slice(0, 12);
  }, [cards, cardId, linkedIds, query]);

  function findListTitle(otherCardId: string): string | null {
    for (const list of Object.values(lists)) {
      if (list.cardIds.includes(otherCardId)) return list.title;
    }
    return null;
  }

  return (
    <section className="px-5 pb-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-fg-soft uppercase tracking-wide">
          Verknüpfte Karten
        </h3>
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setQuery('');
          }}
          className="text-xs text-accent-soft hover:text-accent-hover"
        >
          {adding ? 'Fertig' : '+ Verknüpfen'}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-subtle">Lädt…</p>
      ) : linked.length === 0 && !adding ? (
        <p className="text-xs text-subtle">Keine Verknüpfungen.</p>
      ) : (
        <ul className="space-y-1 mb-2">
          {linked.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-2 rounded-md bg-elev border border-line-strong px-2.5 py-1.5"
            >
              <button
                type="button"
                onClick={() => setOpenCardId(l.id)}
                className="flex-1 text-left text-sm text-fg hover:text-accent-hover truncate"
              >
                {l.title}
              </button>
              <span className="text-[11px] text-subtle truncate hidden sm:inline">
                {l.list_title ?? findListTitle(l.id) ?? ''}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await unlinkCards(cardId, l.id);
                  setLinked((prev) => prev.filter((x) => x.id !== l.id));
                }}
                className="text-xs text-muted hover:text-rose-500"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="rounded-md bg-elev border border-line-strong">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Karte suchen…"
            className="w-full bg-transparent border-b border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none"
          />
          <div className="max-h-48 overflow-y-auto board-scroll">
            {candidates.length === 0 ? (
              <p className="px-3 py-2 text-xs text-subtle">
                Keine passenden Karten gefunden.
              </p>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={async () => {
                    await linkCards(cardId, c.id);
                    setLinked((prev) => [
                      ...prev,
                      { id: c.id, title: c.title, list_title: findListTitle(c.id) },
                    ]);
                    setQuery('');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-fg-soft hover:bg-elev-hover transition-colors"
                >
                  <span className="flex-1 truncate">{c.title}</span>
                  <span className="text-[11px] text-subtle truncate">
                    {findListTitle(c.id) ?? ''}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
