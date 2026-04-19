'use server';
import { createClient } from '@/lib/supabase/server';

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;

type Ok = { ok: true };
type Err = { ok: false; error: string };

function validateUrl(url: string): string | null {
  if (!url) return 'URL fehlt.';
  if (url.length > 500) return 'URL zu lang.';
  if (!DISCORD_WEBHOOK_RE.test(url))
    return 'Das sieht nicht wie eine Discord-Webhook-URL aus. Erwartet: https://discord.com/api/webhooks/ID/TOKEN';
  return null;
}

export async function getBoardWebhook(
  boardId: string
): Promise<{ url: string; enabled: boolean; events: string[] } | null> {
  if (!boardId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('board_webhooks')
    .select('discord_url, enabled, events')
    .eq('board_id', boardId)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    discord_url: string;
    enabled: boolean;
    events: string[];
  };
  return { url: row.discord_url, enabled: row.enabled, events: row.events };
}

export async function saveBoardWebhook(
  boardId: string,
  url: string,
  enabled: boolean,
  events: string[]
): Promise<Ok | Err> {
  if (!boardId) return { ok: false, error: 'Board fehlt.' };
  const urlError = validateUrl(url);
  if (urlError) return { ok: false, error: urlError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet.' };

  const { error } = await supabase.from('board_webhooks').upsert(
    {
      board_id: boardId,
      discord_url: url,
      enabled,
      events: events.length > 0 ? events : DEFAULT_EVENTS,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'board_id' }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateBoardWebhookSettings(
  boardId: string,
  enabled: boolean,
  events: string[]
): Promise<Ok | Err> {
  if (!boardId) return { ok: false, error: 'Board fehlt.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('board_webhooks')
    .update({
      enabled,
      events: events.length > 0 ? events : DEFAULT_EVENTS,
      updated_at: new Date().toISOString(),
    })
    .eq('board_id', boardId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteBoardWebhook(
  boardId: string
): Promise<Ok | Err> {
  if (!boardId) return { ok: false, error: 'Board fehlt.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('board_webhooks')
    .delete()
    .eq('board_id', boardId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function postToDiscord(url: string, payload: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function boardLink(boardSlug: string, cardId?: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kanbanly.de';
  return cardId
    ? `${base}/boards/${boardSlug}?card=${cardId}`
    : `${base}/boards/${boardSlug}`;
}

export async function testBoardWebhook(boardId: string): Promise<Ok | Err> {
  const supabase = await createClient();
  const [webhookRes, boardRes, userRes] = await Promise.all([
    supabase
      .from('board_webhooks')
      .select('discord_url')
      .eq('board_id', boardId)
      .maybeSingle(),
    supabase.from('boards').select('name, slug').eq('id', boardId).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const hook = webhookRes.data as { discord_url?: string } | null;
  if (!hook?.discord_url)
    return { ok: false, error: 'Kein Webhook konfiguriert.' };
  const board = boardRes.data as { name?: string; slug?: string } | null;
  const user = userRes.data.user;

  const username =
    user?.user_metadata && typeof user.user_metadata === 'object'
      ? (user.user_metadata as Record<string, unknown>).username
      : null;

  const ok = await postToDiscord(hook.discord_url, {
    username: 'kanbanly',
    embeds: [
      {
        title: 'Webhook-Test',
        description: `Der Discord-Webhook für **${board?.name ?? 'Board'}** funktioniert. Ausgelöst von **@${typeof username === 'string' ? username : 'dir'}**.`,
        color: 0x8b5cf6,
        url: board?.slug ? boardLink(board.slug) : undefined,
        timestamp: new Date().toISOString(),
      },
    ],
  });
  return ok
    ? { ok: true }
    : { ok: false, error: 'Discord hat die Nachricht abgelehnt. URL prüfen.' };
}

export type WebhookEvent =
  | { kind: 'card_created'; cardId: string; cardTitle: string; listTitle: string }
  | { kind: 'card_moved'; cardId: string; cardTitle: string; fromList: string; toList: string }
  | { kind: 'card_renamed'; cardId: string; fromTitle: string; toTitle: string }
  | { kind: 'card_deleted'; cardTitle: string }
  | { kind: 'card_due_set'; cardId: string; cardTitle: string; due: string }
  | { kind: 'card_due_cleared'; cardId: string; cardTitle: string }
  | { kind: 'task_added'; cardId: string; cardTitle: string; taskTitle: string }
  | { kind: 'task_done'; cardId: string; cardTitle: string; taskTitle: string }
  | { kind: 'task_undone'; cardId: string; cardTitle: string; taskTitle: string }
  | { kind: 'task_deleted'; cardId: string; cardTitle: string; taskTitle: string }
  | { kind: 'label_added'; cardId: string; cardTitle: string; labelName: string }
  | { kind: 'label_removed'; cardId: string; cardTitle: string; labelName: string }
  | { kind: 'assignee_added'; cardId: string; cardTitle: string; who: string }
  | { kind: 'assignee_removed'; cardId: string; cardTitle: string; who: string }
  | { kind: 'comment_added'; cardId: string; cardTitle: string; snippet: string }
  | { kind: 'comment_deleted'; cardId: string; cardTitle: string };

const EMBED_COLORS: Record<WebhookEvent['kind'], number> = {
  card_created: 0x22c55e,
  card_moved: 0x8b5cf6,
  card_renamed: 0x8b5cf6,
  card_deleted: 0xf43f5e,
  card_due_set: 0xf59e0b,
  card_due_cleared: 0x64748b,
  task_added: 0x22c55e,
  task_done: 0x22c55e,
  task_undone: 0x64748b,
  task_deleted: 0xf43f5e,
  label_added: 0x8b5cf6,
  label_removed: 0x64748b,
  assignee_added: 0x22c55e,
  assignee_removed: 0x64748b,
  comment_added: 0x0ea5e9,
  comment_deleted: 0xf43f5e,
};

export const AVAILABLE_EVENTS: Array<WebhookEvent['kind']> = [
  'card_created',
  'card_moved',
  'card_renamed',
  'card_deleted',
  'card_due_set',
  'card_due_cleared',
  'task_added',
  'task_done',
  'task_undone',
  'task_deleted',
  'label_added',
  'label_removed',
  'assignee_added',
  'assignee_removed',
  'comment_added',
  'comment_deleted',
];

export const DEFAULT_EVENTS: Array<WebhookEvent['kind']> = [
  'card_created',
  'card_moved',
  'card_deleted',
  'comment_added',
];

function buildEmbed(
  event: WebhookEvent,
  by: string
): { title: string; description: string } {
  switch (event.kind) {
    case 'card_created':
      return {
        title: 'Neue Karte',
        description: `**${event.cardTitle}**\nin *${event.listTitle}* erstellt von ${by}`,
      };
    case 'card_moved':
      return {
        title: 'Karte verschoben',
        description: `**${event.cardTitle}**\n*${event.fromList}* → *${event.toList}* von ${by}`,
      };
    case 'card_renamed':
      return {
        title: 'Karte umbenannt',
        description: `~~${event.fromTitle}~~ → **${event.toTitle}** von ${by}`,
      };
    case 'card_deleted':
      return {
        title: 'Karte gelöscht',
        description: `~~${event.cardTitle}~~ gelöscht von ${by}`,
      };
    case 'card_due_set':
      return {
        title: 'Fälligkeit gesetzt',
        description: `**${event.cardTitle}** ist fällig am **${event.due}** (${by})`,
      };
    case 'card_due_cleared':
      return {
        title: 'Fälligkeit entfernt',
        description: `**${event.cardTitle}** hat keinen Termin mehr (${by})`,
      };
    case 'task_added':
      return {
        title: 'Neuer Task',
        description: `**${event.cardTitle}** · „${event.taskTitle}" hinzugefügt von ${by}`,
      };
    case 'task_done':
      return {
        title: 'Task erledigt',
        description: `**${event.cardTitle}** · ✓ „${event.taskTitle}" abgehakt von ${by}`,
      };
    case 'task_undone':
      return {
        title: 'Task wieder offen',
        description: `**${event.cardTitle}** · „${event.taskTitle}" wieder aktiv (${by})`,
      };
    case 'task_deleted':
      return {
        title: 'Task gelöscht',
        description: `**${event.cardTitle}** · ~~${event.taskTitle}~~ gelöscht von ${by}`,
      };
    case 'label_added':
      return {
        title: 'Label hinzugefügt',
        description: `**${event.cardTitle}** · Label „${event.labelName}" gesetzt von ${by}`,
      };
    case 'label_removed':
      return {
        title: 'Label entfernt',
        description: `**${event.cardTitle}** · Label „${event.labelName}" entfernt von ${by}`,
      };
    case 'assignee_added':
      return {
        title: 'Zuweisung hinzugefügt',
        description: `**${event.cardTitle}** · ${event.who} zugewiesen von ${by}`,
      };
    case 'assignee_removed':
      return {
        title: 'Zuweisung entfernt',
        description: `**${event.cardTitle}** · ${event.who} nicht mehr zugewiesen (${by})`,
      };
    case 'comment_added':
      return {
        title: 'Neuer Kommentar',
        description: `**${event.cardTitle}** · ${by}: „${event.snippet}"`,
      };
    case 'comment_deleted':
      return {
        title: 'Kommentar gelöscht',
        description: `**${event.cardTitle}** · Kommentar entfernt von ${by}`,
      };
  }
}

export async function notifyBoardEvent(
  boardId: string,
  event: WebhookEvent
): Promise<void> {
  if (!boardId) return;
  const supabase = await createClient();
  const [whRes, boardRes, userRes] = await Promise.all([
    supabase
      .from('board_webhooks')
      .select('discord_url, enabled, events')
      .eq('board_id', boardId)
      .maybeSingle(),
    supabase.from('boards').select('name, slug').eq('id', boardId).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const hook = whRes.data as {
    discord_url?: string;
    enabled?: boolean;
    events?: string[];
  } | null;
  if (!hook?.discord_url || !hook.enabled) return;
  if (hook.events && !hook.events.includes(event.kind)) return;

  const board = boardRes.data as { name?: string; slug?: string } | null;
  const boardName = board?.name ?? 'Board';
  const cardIdInEvent =
    'cardId' in event && typeof event.cardId === 'string'
      ? event.cardId
      : undefined;
  const cardUrl = board?.slug ? boardLink(board.slug, cardIdInEvent) : undefined;

  const username =
    userRes.data.user?.user_metadata &&
    typeof userRes.data.user.user_metadata === 'object'
      ? (userRes.data.user.user_metadata as Record<string, unknown>).username
      : null;
  const by = typeof username === 'string' ? `@${username}` : 'jemand';

  const { title, description } = buildEmbed(event, by);

  await postToDiscord(hook.discord_url, {
    username: `kanbanly · ${boardName}`,
    embeds: [
      {
        title,
        description,
        color: EMBED_COLORS[event.kind],
        url: cardUrl,
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
