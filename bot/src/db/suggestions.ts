import { getDb } from '../db.js';

export type SuggestionConfig = {
  enabled: boolean;
  channelId: string | null;
  modRoleId: string | null;
};

export type SuggestionStatus =
  | 'open'
  | 'approved'
  | 'rejected'
  | 'implemented';

export type Suggestion = {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  userId: string;
  content: string;
  status: SuggestionStatus;
  modNote: string | null;
  upvotes: number;
  downvotes: number;
};

export async function getSuggestionConfig(
  guildId: string,
): Promise<SuggestionConfig> {
  const db = getDb();
  const { data } = await db
    .from('bot_guilds')
    .select('suggestions_enabled, suggestions_channel_id, suggestions_mod_role_id')
    .eq('guild_id', guildId)
    .maybeSingle();
  return {
    enabled: Boolean(data?.suggestions_enabled),
    channelId: (data?.suggestions_channel_id as string | null) ?? null,
    modRoleId: (data?.suggestions_mod_role_id as string | null) ?? null,
  };
}

export async function createSuggestion(input: {
  guildId: string;
  channelId: string;
  userId: string;
  content: string;
}): Promise<Suggestion> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_suggestions')
    .insert({
      guild_id: input.guildId,
      channel_id: input.channelId,
      user_id: input.userId,
      content: input.content,
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
  await db
    .from('bot_suggestions')
    .update({ status, mod_note: modNote, updated_at: new Date().toISOString() })
    .eq('id', id);
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
      // Klick auf gleichen Vote = entfernen.
      await db
        .from('bot_suggestion_votes')
        .delete()
        .eq('suggestion_id', suggestionId)
        .eq('user_id', userId);
      return { changed: true, removed: true };
    }
    // Wechsel der Stimme.
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
    guildId: r.guild_id as string,
    channelId: r.channel_id as string,
    messageId: (r.message_id as string | null) ?? null,
    userId: r.user_id as string,
    content: r.content as string,
    status: r.status as SuggestionStatus,
    modNote: (r.mod_note as string | null) ?? null,
    upvotes: (r.upvotes as number) ?? 0,
    downvotes: (r.downvotes as number) ?? 0,
  };
}
