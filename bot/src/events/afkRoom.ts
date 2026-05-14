import {
  Events,
  type Client,
  type VoiceState,
} from 'discord.js';
import { getDb } from '../db.js';

type AfkCfg = {
  enabled: boolean;
  channelId: string | null;
  timeoutMinutes: number;
};

const cfgCache = new Map<string, { value: AfkCfg; expires: number }>();
const CFG_TTL_MS = 60_000;

async function getCfg(guildId: string): Promise<AfkCfg> {
  const now = Date.now();
  const cached = cfgCache.get(guildId);
  if (cached && cached.expires > now) return cached.value;
  const db = getDb();
  const { data } = await db
    .from('bot_guilds')
    .select('afk_enabled, afk_channel_id, afk_timeout_minutes')
    .eq('guild_id', guildId)
    .maybeSingle();
  const value: AfkCfg = {
    enabled: Boolean(data?.afk_enabled),
    channelId: (data?.afk_channel_id as string | null) ?? null,
    timeoutMinutes: (data?.afk_timeout_minutes as number | null) ?? 10,
  };
  cfgCache.set(guildId, { value, expires: now + CFG_TTL_MS });
  return value;
}

// Pro User+Guild: Timer der nach X Minuten verschiebt.
const pendingTimers = new Map<string, NodeJS.Timeout>();

function clearTimer(key: string): void {
  const t = pendingTimers.get(key);
  if (t) {
    clearTimeout(t);
    pendingTimers.delete(key);
  }
}

export function registerAfkRoom(client: Client): void {
  client.on(
    Events.VoiceStateUpdate,
    async (oldState: VoiceState, newState: VoiceState) => {
      try {
        if (!newState.guild || !newState.member) return;
        const key = `${newState.guild.id}:${newState.member.id}`;

        // Wenn User aus Voice ausgestiegen oder im AFK-Channel → Timer stoppen.
        const cfg = await getCfg(newState.guild.id);
        if (!cfg.enabled || !cfg.channelId) {
          clearTimer(key);
          return;
        }
        if (!newState.channelId) {
          clearTimer(key);
          return;
        }
        if (newState.channelId === cfg.channelId) {
          // Schon im AFK-Channel.
          clearTimer(key);
          return;
        }

        // Stumm + taub (selbst-stumm reicht, aber server-deaf zählt auch) → Timer setzen.
        const isMuted =
          Boolean(newState.selfMute) || Boolean(newState.serverMute);
        const isDeaf =
          Boolean(newState.selfDeaf) || Boolean(newState.serverDeaf);
        if (!isMuted && !isDeaf) {
          clearTimer(key);
          return;
        }

        // Wenn Zustand unverändert ist (alter und neuer State beide stumm und gleicher Channel) — nichts ändern.
        const wasInVoice = oldState.channelId === newState.channelId;
        const wasMuted = wasInVoice && (oldState.selfMute || oldState.serverMute);
        const wasDeaf = wasInVoice && (oldState.selfDeaf || oldState.serverDeaf);
        if (wasMuted === isMuted && wasDeaf === isDeaf && wasInVoice) return;

        clearTimer(key);
        const t = setTimeout(async () => {
          pendingTimers.delete(key);
          try {
            const memberNow = await newState.guild.members
              .fetch(newState.member!.id)
              .catch(() => null);
            if (!memberNow?.voice.channel) return;
            const currentMuted =
              memberNow.voice.selfMute || memberNow.voice.serverMute;
            const currentDeaf =
              memberNow.voice.selfDeaf || memberNow.voice.serverDeaf;
            if (!currentMuted && !currentDeaf) return;
            if (memberNow.voice.channelId === cfg.channelId) return;
            await memberNow.voice.setChannel(
              cfg.channelId!,
              'AFK-Auto-Move',
            );
          } catch (err) {
            console.error('[afk] move:', err);
          }
        }, cfg.timeoutMinutes * 60_000);
        pendingTimers.set(key, t);
      } catch (err) {
        console.error('[afk] handler:', err);
      }
    },
  );
}

export function invalidateAfkCache(guildId: string): void {
  cfgCache.delete(guildId);
}
