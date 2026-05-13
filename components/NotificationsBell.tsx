'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { acceptInviteByToken } from '@/app/(app)/invite-actions';
import {
  markNotificationsRead,
  markAllNotificationsRead,
} from '@/app/(app)/subscription-actions';

type PendingInvite = {
  id: string;
  token: string;
  role: string;
  expires_at: string;
  board_id: string | null;
  board_name: string | null;
  workspace_name: string | null;
  inviter_name: string | null;
};

type InvitationRow = {
  id: string;
  token: string;
  role: string;
  expires_at: string;
  board_id: string | null;
  invited_by: string | null;
};

type BoardRow = {
  id: string;
  name: string;
  workspaces: { name: string | null } | { name: string | null }[] | null;
};

type ProfileRow = { id: string; username: string | null };

type NotificationRow = {
  id: string;
  kind: string;
  card_id: string | null;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

type EnrichedNotification = NotificationRow & {
  card_title: string | null;
  board_slug: string | null;
  actor_username: string | null;
};

const NOTIF_TEXTS: Record<string, (n: EnrichedNotification) => string> = {
  comment_added: (n) => {
    const snippet = (n.payload.snippet as string | undefined) ?? '';
    return snippet ? `kommentierte: „${snippet}"` : 'kommentierte';
  },
  card_renamed: (n) => {
    const to = n.payload.toTitle as string | undefined;
    return to ? `benannte um in „${to}"` : 'benannte um';
  },
  card_moved: (n) => {
    const to = n.payload.toList as string | undefined;
    return to ? `verschob nach „${to}"` : 'verschob die Karte';
  },
  card_due_set: (n) => {
    const due = n.payload.due as string | undefined;
    return due ? `setzte Fälligkeit auf ${due}` : 'setzte eine Fälligkeit';
  },
  card_due_cleared: () => 'entfernte die Fälligkeit',
  card_archived: () => 'archivierte die Karte',
};

function pick<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function formatRel(iso: string): string {
  const then = new Date(iso);
  const diffMin = Math.round((Date.now() - then.getTime()) / 60000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std`;
  const diffD = Math.round(diffH / 24);
  return `vor ${diffD} Tag${diffD === 1 ? '' : 'en'}`;
}

const ROLE_LABELS: Record<string, string> = {
  viewer: 'Viewer',
  editor: 'Editor',
  admin: 'Admin',
};

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [invites, setInvites] = useState<PendingInvite[] | null>(null);
  const [notifications, setNotifications] = useState<EnrichedNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('invitations')
      .select('id, token, role, expires_at, board_id, invited_by')
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    if (error) {
      setError(error.message);
      return;
    }
    const rows = (data ?? []) as InvitationRow[];
    if (rows.length === 0) {
      setInvites([]);
      return;
    }

    const boardIds = Array.from(
      new Set(rows.map((r) => r.board_id).filter((x): x is string => !!x))
    );
    const inviterIds = Array.from(
      new Set(rows.map((r) => r.invited_by).filter((x): x is string => !!x))
    );

    const [boardsRes, invitersRes] = await Promise.all([
      boardIds.length > 0
        ? supabase
            .from('boards')
            .select('id, name, workspaces(name)')
            .in('id', boardIds)
        : Promise.resolve({ data: [] as BoardRow[], error: null }),
      inviterIds.length > 0
        ? supabase.from('profiles').select('id, username').in('id', inviterIds)
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    ]);

    const boardsMap = new Map<string, BoardRow>();
    ((boardsRes.data ?? []) as BoardRow[]).forEach((b) =>
      boardsMap.set(b.id, b)
    );
    const invitersMap = new Map<string, string | null>();
    ((invitersRes.data ?? []) as ProfileRow[]).forEach((p) =>
      invitersMap.set(p.id, p.username)
    );

    const enriched: PendingInvite[] = rows.map((r) => {
      const board = r.board_id ? boardsMap.get(r.board_id) ?? null : null;
      return {
        id: r.id,
        token: r.token,
        role: r.role,
        expires_at: r.expires_at,
        board_id: r.board_id,
        board_name: board?.name ?? null,
        workspace_name: board ? pick(board.workspaces)?.name ?? null : null,
        inviter_name: r.invited_by
          ? invitersMap.get(r.invited_by) ?? null
          : null,
      };
    });

    enriched.sort((a, b) => a.expires_at.localeCompare(b.expires_at));
    setInvites(enriched);

    const { data: nRaw } = await supabase
      .from('notifications')
      .select('id, kind, card_id, actor_id, payload, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(20);
    const notifRows = (nRaw ?? []) as NotificationRow[];
    if (notifRows.length === 0) {
      setNotifications([]);
      return;
    }
    const cardIds = Array.from(
      new Set(notifRows.map((n) => n.card_id).filter((x): x is string => !!x))
    );
    const actorIds = Array.from(
      new Set(notifRows.map((n) => n.actor_id).filter((x): x is string => !!x))
    );
    const [cardsRes, actorsRes] = await Promise.all([
      cardIds.length > 0
        ? supabase
            .from('cards')
            .select('id, title, lists(boards(slug))')
            .in('id', cardIds)
        : Promise.resolve({ data: [] as unknown[], error: null }),
      actorIds.length > 0
        ? supabase.from('profiles').select('id, username').in('id', actorIds)
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    ]);
    type CardLookup = {
      id: string;
      title: string;
      lists:
        | { boards: { slug: string } | { slug: string }[] | null }
        | { boards: { slug: string } | { slug: string }[] | null }[]
        | null;
    };
    const cardMap = new Map<
      string,
      { title: string; board_slug: string | null }
    >();
    for (const c of (cardsRes.data ?? []) as CardLookup[]) {
      const list = pick(c.lists);
      const board = list ? pick(list.boards) : null;
      cardMap.set(c.id, {
        title: c.title,
        board_slug: board?.slug ?? null,
      });
    }
    const actorMap = new Map<string, string | null>();
    for (const a of (actorsRes.data ?? []) as ProfileRow[]) {
      actorMap.set(a.id, a.username);
    }
    const enrichedNotifs: EnrichedNotification[] = notifRows.map((n) => {
      const card = n.card_id ? cardMap.get(n.card_id) : null;
      return {
        ...n,
        card_title: card?.title ?? null,
        board_slug: card?.board_slug ?? null,
        actor_username: n.actor_id ? actorMap.get(n.actor_id) ?? null : null,
      };
    });
    setNotifications(enrichedNotifs);
  }, []);

  useEffect(() => {
    // Initial-Load der Notifications beim Mount — async fetch + setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => load()
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    // Reload beim Öffnen des Menüs — bewusst.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, load]);

  const accept = (inv: PendingInvite) => {
    setError(null);
    startTransition(async () => {
      const res = await acceptInviteByToken(inv.token);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setInvites((list) =>
        list ? list.filter((i) => i.id !== inv.id) : list
      );
      setOpen(false);
      if (res.boardSlug) {
        router.push(`/boards/${res.boardSlug}`);
      } else {
        router.refresh();
      }
    });
  };

  const unreadCount =
    notifications?.filter((n) => !n.read_at).length ?? 0;
  const count = (invites?.length ?? 0) + unreadCount;

  const openNotification = async (n: EnrichedNotification) => {
    if (!n.read_at) {
      await markNotificationsRead([n.id]);
      setNotifications((prev) =>
        prev
          ? prev.map((x) =>
              x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x
            )
          : prev
      );
    }
    setOpen(false);
    if (n.board_slug && n.card_id) {
      router.push(`/boards/${n.board_slug}?card=${n.card_id}`);
    }
  };

  const onMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) =>
      prev
        ? prev.map((n) =>
            n.read_at ? n : { ...n, read_at: new Date().toISOString() }
          )
        : prev
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Benachrichtigungen${count > 0 ? ` (${count})` : ''}`}
        aria-expanded={open}
        className="relative h-8 w-8 grid place-items-center rounded-md border border-line-strong hover:border-fg-soft bg-elev hover:bg-elev text-fg-soft hover:text-fg transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-rose-500 text-white text-[9px] font-mono font-semibold tabular-nums ring-2 ring-bg">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 rounded-md bg-surface border border-line shadow-md overflow-hidden z-50 max-h-[80vh] flex flex-col">
          {error && (
            <div className="m-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs px-3 py-2">
              {error}
            </div>
          )}

          <div className="overflow-y-auto board-scroll">
            <div className="px-4 pt-3 pb-2 border-b border-line flex items-center justify-between">
              <h3 className="text-xs font-semibold text-fg uppercase tracking-wide">
                Aktivität
              </h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="text-[11px] text-fg-soft hover:text-fg"
                >
                  Alle gelesen
                </button>
              )}
            </div>

            {notifications === null ? (
              <div className="px-4 py-6 text-center text-xs text-subtle">
                Lade…
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-subtle">
                Keine Aktivitäten.
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {notifications.map((n) => {
                  const fmt = NOTIF_TEXTS[n.kind];
                  const text = fmt ? fmt(n) : n.kind;
                  const actor = n.actor_username
                    ? `@${n.actor_username}`
                    : 'Jemand';
                  return (
                    <li
                      key={n.id}
                      className={`px-4 py-2.5 ${
                        n.read_at ? '' : 'bg-elev/40'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => openNotification(n)}
                        className="w-full text-left"
                      >
                        <div className="text-xs text-fg-soft leading-snug">
                          <strong className="text-fg">{actor}</strong> {text}
                        </div>
                        {n.card_title && (
                          <div className="text-[11px] text-subtle mt-0.5 truncate">
                            {n.card_title}
                          </div>
                        )}
                        <div className="text-[10px] text-faint mt-0.5">
                          {formatRel(n.created_at)}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="px-4 pt-3 pb-2 border-t border-b border-line">
              <h3 className="text-xs font-semibold text-fg uppercase tracking-wide">
                Einladungen
              </h3>
            </div>

            {invites === null ? (
              <div className="px-4 py-6 text-center text-xs text-subtle">
                Lade…
              </div>
            ) : invites.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-subtle">
                Keine offenen Einladungen.
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {invites.map((inv) => (
                  <li key={inv.id} className="px-4 py-3">
                    <div className="text-sm text-fg font-medium leading-snug break-words">
                      {inv.board_name ?? 'Unbenanntes Board'}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">
                      {inv.workspace_name && (
                        <>Workspace {inv.workspace_name} · </>
                      )}
                      Rolle: {ROLE_LABELS[inv.role] ?? inv.role}
                    </div>
                    {inv.inviter_name && (
                      <div className="text-[11px] text-subtle mt-0.5">
                        Eingeladen von @{inv.inviter_name}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => accept(inv)}
                      disabled={isPending}
                      className="mt-2 w-full rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-medium py-1.5 transition-colors disabled:opacity-50"
                    >
                      {isPending ? 'Nehme an…' : 'Annehmen'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
