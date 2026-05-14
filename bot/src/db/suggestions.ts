import { getDb } from '../db.js';

export type SuggestionFieldKey = 'id' | 'status' | 'upvotes' | 'downvotes' | 'banner';

export type SuggestionConfig = {
  enabled: boolean;
  channelId: string | null;
  modRoleId: string | null;
  embedTitle: string;
  embedMessage: string;
  embedColor: number;
  footerText: string | null;
  bannerUrl: string | null;
  thumbnailUrl: string | null;
  upvoteEmoji: string | null;
  downvoteEmoji: string | null;
  statusOpenEmoji: string | null;
  statusEndedEmoji: string | null;
  allowedRoleIds: string[];
  endMessage: string;
  fieldOrder: SuggestionFieldKey[];
};

export type SuggestionStatus = 'open' | 'approved' | 'rejected' | 'implemented';

export type Suggestion = {
  id: string;
  publicId: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  userId: string;
  content: string;
  status: SuggestionStatus;
  modNote: string | null;
  upvotes: number;
  downvotes: number;
  endedAt: string | null;
};

const DEFAULT_FIELD_ORDER: SuggestionFieldKey[] = [
  'id',
  'status',
  'upvotes',
  'downvotes',
  'banner',
];

const VALID_FIELD_KEYS: ReadonlySet<SuggestionFieldKey> = new Set([
  'id',
  'status',
  'upvotes',
  'downvotes',
  'banner',
]);

function normalizeFieldOrder(raw: unknown): SuggestionFieldKey[] {
  if (!Array.isArray(raw)) return DEFAULT_FIELD_ORDER;
  const seen = new Set<SuggestionFieldKey>();
  const out: SuggestionFieldKey[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const k = v as SuggestionFieldKey;
    if (!VALID_FIELD_KEYS.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  // fehlende Keys mit Default-Reihenfolge anhängen
  for (const k of DEFAULT_FIELD_ORDER) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}

export async function getSuggestionConfig(
  guildId: string,
): Promise<SuggestionConfig> {
  const db = getDb();
  const { data: raw } = await db
    .from('bot_guilds')
    .select(
      'suggestions_enabled, suggestions_channel_id, suggestions_mod_role_id, ' +
        'suggestions_embed_title, suggestions_embed_message, suggestions_embed_color, ' +
        'suggestions_footer_text, suggestions_banner_url, suggestions_thumbnail_url, ' +
        'suggestions_upvote_emoji, suggestions_downvote_emoji, ' +
        'suggestions_status_open_emoji, suggestions_status_ended_emoji, ' +
        'suggestions_allowed_role_ids, suggestions_end_message, suggestions_field_order',
    )
    .eq('guild_id', guildId)
    .maybeSingle();
  const data = raw as Record<string, unknown> | null;
  return {
    enabled: Boolean(data?.suggestions_enabled),
    channelId: (data?.suggestions_channel_id as string | null) ?? null,
    modRoleId: (data?.suggestions_mod_role_id as string | null) ?? null,
    embedTitle: (data?.suggestions_embed_title as string | null) ?? 'Neuer Vorschlag',
    embedMessage:
      (data?.suggestions_embed_message as string | null) ??
      '{user} hat einen neuen Vorschlag gepostet\n\n{suggestion}',
    embedColor: (data?.suggestions_embed_color as number | null) ?? 0x5865f2,
    footerText: (data?.suggestions_footer_text as string | null) ?? null,
    bannerUrl: (data?.suggestions_banner_url as string | null) ?? null,
    thumbnailUrl: (data?.suggestions_thumbnail_url as string | null) ?? null,
    upvoteEmoji: (data?.suggestions_upvote_emoji as string | null) ?? null,
    downvoteEmoji: (data?.suggestions_downvote_emoji as string | null) ?? null,
    statusOpenEmoji: (data?.suggestions_status_open_emoji as string | null) ?? null,
    statusEndedEmoji: (data?.suggestions_status_ended_emoji as string | null) ?? null,
    allowedRoleIds: Array.isArray(data?.suggestions_allowed_role_ids)
      ? (data?.suggestions_allowed_role_ids as unknown[]).filter(
          (v): v is string => typeof v === 'string',
        )
      : [],
    endMessage:
      (data?.suggestions_end_message as string | null) ??
      'Dieser Vorschlag wurde beendet.',
    fieldOrder: normalizeFieldOrder(data?.suggestions_field_order),
  };
}

const PUBLIC_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne I, O, 0, 1 — verwechslungsarm

function generatePublicId(): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += PUBLIC_ID_ALPHABET[Math.floor(Math.random() * PUBLIC_ID_ALPHABET.length)];
  }
  return out;
}

async function uniquePublicId(guildId: string): Promise<string> {
  const db = getDb();
  for (let i = 0; i < 10; i += 1) {
    const candidate = generatePublicId();
    const { data } = await db
      .from('bot_suggestions')
      .select('id')
      .eq('guild_id', guildId)
      .eq('public_id', candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  // Sehr unwahrscheinlich: Fallback mit Timestamp-Suffix.
  return `${generatePublicId().slice(0, 4)}${Date.now().toString(36).slice(-2).toUpperCase()}`;
}

export async function createSuggestion(input: {
  guildId: string;
  channelId: string;
  userId: string;
  content: string;
}): Promise<Suggestion> {
  const db = getDb();
  const publicId = await uniquePublicId(input.guildId);
  const { data, error } = await db
    .from('bot_suggestions')
    .insert({
      guild_id: input.guildId,
      channel_id: input.channelId,
      user_id: input.userId,
      content: input.content,
      public_id: publicId,
    })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Insert fehlgeschlagen.');
  return map(data);
}

export async function setSuggestionMessageId(
  id: string,
  messageId: string,
): Promise<void> {
  const db = getDb();
  await db.from('bot_suggestions').update({ message_id: messageId }).eq('id', id);
}

export async function getSuggestion(id: string): Promise<Suggestion | null> {
  const db = getDb();
  const { data } = await db
    .from('bot_suggestions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data ? map(data) : null;
}

export async function updateSuggestionStatus(
  id: string,
  status: SuggestionStatus,
  modNote: string | null,
): Promise<void> {
  const db = getDb();
  const patch: Record<string, unknown> = {
    status,
    mod_note: modNote,
    updated_at: new Date().toISOString(),
  };
  if (status !== 'open') patch.ended_at = new Date().toISOString();
  else patch.ended_at = null;
  await db.from('bot_suggestions').update(patch).eq('id', id);
}

export async function castVote(
  suggestionId: string,
  userId: string,
  vote: 'up' | 'down',
): Promise<{ changed: boolean; removed: boolean }> {
  const db = getDb();
  const { data: existing } = await db
    .from('bot_suggestion_votes')
    .select('vote')
    .eq('suggestion_id', suggestionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    if ((existing.vote as string) === vote) {
      await db
        .from('bot_suggestion_votes')
        .delete()
        .eq('suggestion_id', suggestionId)
        .eq('user_id', userId);
      return { changed: true, removed: true };
    }
    await db
      .from('bot_suggestion_votes')
      .update({ vote })
      .eq('suggestion_id', suggestionId)
      .eq('user_id', userId);
    return { changed: true, removed: false };
  }
  await db.from('bot_suggestion_votes').insert({
    suggestion_id: suggestionId,
    user_id: userId,
    vote,
  });
  return { changed: true, removed: false };
}

export async function recomputeSuggestionVotes(id: string): Promise<{
  up: number;
  down: number;
}> {
  const db = getDb();
  const { data } = await db
    .from('bot_suggestion_votes')
    .select('vote')
    .eq('suggestion_id', id);
  const up = (data ?? []).filter((r) => r.vote === 'up').length;
  const down = (data ?? []).filter((r) => r.vote === 'down').length;
  await db
    .from('bot_suggestions')
    .update({ upvotes: up, downvotes: down })
    .eq('id', id);
  return { up, down };
}

function map(r: Record<string, unknown>): Suggestion {
  return {
    id: r.id as string,
    publicId: ((r.public_id as string | null) ?? '').toUpperCase(),
    guildId: r.guild_id as string,
    channelId: r.channel_id as string,
    messageId: (r.message_id as string | null) ?? null,
    userId: r.user_id as string,
    content: r.content as string,
    status: r.status as SuggestionStatus,
    modNote: (r.mod_note as string | null) ?? null,
    upvotes: (r.upvotes as number) ?? 0,
    downvotes: (r.downvotes as number) ?? 0,
    endedAt: (r.ended_at as string | null) ?? null,
  };
}
