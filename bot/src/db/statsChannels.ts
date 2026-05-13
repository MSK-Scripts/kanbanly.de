import { getDb } from '../db.js';

export type StatChannel = {
  guildId: string;
  channelId: string;
  template: string;
  lastValue: string | null;
  lastUpdatedAt: string | null;
};

type Row = {
  guild_id: string;
  channel_id: string;
  template: string;
  last_value: string | null;
  last_updated_at: string | null;
};

function map(r: Row): StatChannel {
  return {
    guildId: r.guild_id,
    channelId: r.channel_id,
    template: r.template,
    lastValue: r.last_value,
    lastUpdatedAt: r.last_updated_at,
  };
}

export async function listAllStatChannels(): Promise<StatChannel[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_stat_channels')
    .select('guild_id, channel_id, template, last_value, last_updated_at');
  if (error) throw error;
  return (data ?? []).map((r) => map(r as Row));
}

export async function listStatChannelsForGuild(
  guildId: string,
): Promise<StatChannel[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_stat_channels')
    .select('guild_id, channel_id, template, last_value, last_updated_at')
    .eq('guild_id', guildId);
  if (error) throw error;
  return (data ?? []).map((r) => map(r as Row));
}

export async function upsertStatChannel(args: {
  guildId: string;
  channelId: string;
  template: string;
}): Promise<void> {
  const db = getDb();
  const { error } = await db.from('bot_stat_channels').upsert(
    {
      guild_id: args.guildId,
      channel_id: args.channelId,
      template: args.template,
    },
    { onConflict: 'guild_id,channel_id' },
  );
  if (error) throw error;
}

export async function deleteStatChannel(
  guildId: string,
  channelId: string,
): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_stat_channels')
    .delete()
    .eq('guild_id', guildId)
    .eq('channel_id', channelId)
    .select('channel_id');
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function markStatChannelUpdated(
  guildId: string,
  channelId: string,
  value: string,
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('bot_stat_channels')
    .update({
      last_value: value,
      last_updated_at: new Date().toISOString(),
    })
    .eq('guild_id', guildId)
    .eq('channel_id', channelId);
  if (error) throw error;
}
