'use client';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '@/lib/supabase/client';
import { confirm } from '@/store/confirmStore';
import { withMentions } from '@/lib/mentions';
import { useBoard } from '@/store/boardStore';
import { notifyBoardEvent } from '@/app/(app)/webhook-actions';
import { notifySubscribers, subscribeUserToCard } from '@/lib/notifications';
import { Avatar } from './Avatar';

type CommentRow = {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type CommentWithUser = CommentRow & { username: string | null };

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'gerade eben';
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} Tg.`;
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function CardComments({ cardId }: { cardId: string }) {
  const [rows, setRows] = useState<CommentWithUser[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const memberProfiles = useBoard((s) => s.memberProfiles);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const loadUsernames = async (
      comments: CommentRow[]
    ): Promise<CommentWithUser[]> => {
      const userIds = Array.from(new Set(comments.map((c) => c.user_id)));
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, username')
        .in('id', userIds);
      const nameById = new Map<string, string | null>();
      for (const p of (profiles ?? []) as Array<{
        id: string;
        username: string | null;
      }>) {
        nameById.set(p.id, p.username);
      }
      return comments.map((c) => ({
        ...c,
        username: nameById.get(c.user_id) ?? null,
      }));
    };

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) {
        setCurrentUserId(user?.id ?? null);
        const profile = user ? memberProfiles[user.id] : undefined;
        setCurrentUsername(profile?.username ?? null);
      }

      const { data } = await supabase
        .from('card_comments')
        .select('id, card_id, user_id, content, created_at, updated_at')
        .eq('card_id', cardId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      const withUsers = await loadUsernames((data ?? []) as CommentRow[]);
      if (!cancelled) setRows(withUsers);
    })();

    const channel = supabase
      .channel(`comments-${cardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'card_comments',
          filter: `card_id=eq.${cardId}`,
        },
        async (payload) => {
          if (cancelled) return;
          if (payload.eventType === 'INSERT') {
            const row = payload.new as CommentRow;
            const [withUser] = await loadUsernames([row]);
            if (cancelled) return;
            setRows((prev) =>
              prev
                ? prev.some((r) => r.id === row.id)
                  ? prev
                  : [...prev, withUser]
                : [withUser]
            );
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Partial<CommentRow>;
            setRows((prev) =>
              prev ? prev.filter((r) => r.id !== oldRow.id) : prev
            );
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as CommentRow;
            setRows((prev) =>
              prev
                ? prev.map((r) =>
                    r.id === row.id ? { ...r, ...row, username: r.username } : r
                  )
                : prev
            );
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [cardId]);

  const submit = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSending(false);
      return;
    }
    const { error } = await supabase
      .from('card_comments')
      .insert({ card_id: cardId, user_id: user.id, content });
    if (error) console.error('comment insert', error);
    else {
      const state = useBoard.getState();
      const bId = state.boardId;
      const cardTitle = state.cards[cardId]?.title ?? '';
      const snippet =
        content.length > 120 ? content.slice(0, 120) + '…' : content;
      // Commenter abonniert die Karte automatisch.
      subscribeUserToCard(supabase, cardId, user.id).catch(() => {});
      notifySubscribers(supabase, cardId, user.id, 'comment_added', {
        cardTitle,
        snippet,
      }).catch(() => {});
      if (bId && cardTitle) {
        notifyBoardEvent(bId, {
          kind: 'comment_added',
          cardId,
          cardTitle,
          snippet,
        }).catch(() => {});
      }
    }
    setDraft('');
    setSending(false);
  };

  const deleteComment = async (id: string) => {
    const ok = await confirm({
      title: 'Kommentar löschen?',
      description: 'Der Kommentar wird für alle entfernt.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.from('card_comments').delete().eq('id', id);
    if (error) console.error('comment delete', error);
    else {
      const state = useBoard.getState();
      const bId = state.boardId;
      const cardTitle = state.cards[cardId]?.title ?? '';
      if (bId && cardTitle) {
        notifyBoardEvent(bId, {
          kind: 'comment_deleted',
          cardId,
          cardTitle,
        }).catch(() => {});
      }
    }
  };

  return (
    <div className="space-y-3">
      {rows === null ? (
        <p className="text-xs text-subtle font-mono">Lädt…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-subtle">Noch keine Kommentare.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id} className="flex gap-2.5 group">
              <Avatar username={c.username} size="sm" className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-medium text-fg-soft">
                    @{c.username ?? 'unbekannt'}
                  </span>
                  <span className="text-[10px] text-subtle font-mono tabular-nums">
                    {relativeTime(c.created_at)}
                  </span>
                  {currentUserId === c.user_id && (
                    <button
                      type="button"
                      onClick={() => deleteComment(c.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] text-subtle hover:text-rose-600 dark:text-rose-400 transition-opacity"
                    >
                      Löschen
                    </button>
                  )}
                </div>
                <div className="rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg-soft prose-markdown">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p>{withMentions(children, currentUsername)}</p>
                      ),
                      li: ({ children }) => (
                        <li>{withMentions(children, currentUsername)}</li>
                      ),
                    }}
                  >
                    {c.content}
                  </ReactMarkdown>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Kommentar schreiben… Markdown erlaubt. (Strg+Enter zum Senden)"
          rows={2}
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60 resize-y font-mono"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="rounded-md bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-4 py-1.5 transition-colors"
          >
            {sending ? 'Sende…' : 'Senden'}
          </button>
        </div>
      </form>
    </div>
  );
}
