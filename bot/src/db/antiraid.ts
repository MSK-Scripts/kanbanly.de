import { getDb } from '../db.js';

export type AntiRaidConfig = {
  enabled: boolean;
  joinThreshold: number;
  joinWindowSec: number;
  action: 'alert' | 'kick' | 'lockdown';
  alertChannelId: string | null;
};

export async function getAntiRaidConfig(
  guildId: string,
): Promise<AntiRaidConfig | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_guilds')
    .select(
      'antiraid_enabled, antiraid_join_threshold, antiraid_join_window_sec, antiraid_action, antiraid_alert_channel_id',
    )
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    enabled: Boolean(data.antiraid_enabled),
    joinThreshold: (data.antiraid_join_threshold as number | null) ?? 5,
    joinWindowSec: (data.antiraid_join_window_sec as number | null) ?? 10,
    action: (data.antiraid_action as AntiRaidConfig['action'] | null) ?? 'alert',
    alertChannelId: data.antiraid_alert_channel_id ?? null,
  };
}
