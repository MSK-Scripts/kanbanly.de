import { getDb } from '../db.js';

export type ChannelMode = {
  mode: 'images_only' | 'text_only';
  allowVideos: boolean;
};

// Cache: kürzer für null (damit neue Regeln schnell greifen) als für Hits.
const HIT_TTL_MS = 60_000;
const MISS_TTL_MS = 5_000;
const cache = new Map<string, { value: ChannelMode | null; expires: number }>();

export async function getChannelMode(
  guildId: string,
  channelId: string,
): Promise<ChannelMode | null> {
  const key = `${guildId}:${channelId}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expires > now) return cached.value;

  const db = getDb();
  const { data, error } = await db
    .from('bot_channel_modes')
    .select('mode, allow_videos')
    .eq('guild_id', guildId)
    .eq('channel_id', channelId)
    .maybeSingle();
  if (error) throw error;
  const value: ChannelMode | null = data
    ? {
        mode: data.mode as 'images_only' | 'text_only',
        allowVideos: Boolean(data.allow_videos),
      }
    : null;
  cache.set(key, {
    value,
    expires: now + (value === null ? MISS_TTL_MS : HIT_TTL_MS),
  });
  return value;
}

export function invalidateChannelModeCache(guildId: string, channelId: string): void {
  cache.delete(`${guildId}:${channelId}`);
}

export function clearChannelModeCache(): void {
  cache.clear();
}

let realtimeStarted = false;
export function startChannelModeRealtime(): void {
  if (realtimeStarted) return;
  realtimeStarted = true;
  const db = getDb();
  db.channel('bot-channel-modes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bot_channel_modes' },
      (payload) => {
        const row =
          (payload.new as { guild_id?: string; channel_id?: string } | null) ??
          (payload.old as { guild_id?: string; channel_id?: string } | null);
        if (row?.guild_id && row?.channel_id) {
          invalidateChannelModeCache(row.guild_id, row.channel_id);
        } else {
          clearChannelModeCache();
        }
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[channelMode] Realtime-Subscription aktiv');
      }
    });
}
