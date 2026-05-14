import { getDb } from '../db.js';

export type BirthdayConfig = {
  enabled: boolean;
  channelId: string | null;
  message: string | null;
};

export type Birthday = {
  guildId: string;
  userId: string;
  month: number;
  day: number;
  year: number | null;
};

export async function getBirthdayConfig(
  guildId: string,
): Promise<BirthdayConfig> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_guilds')
    .select('birthday_enabled, birthday_channel_id, birthday_message')
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { enabled: false, channelId: null, message: null };
  return {
    enabled: Boolean(data.birthday_enabled),
    channelId: data.birthday_channel_id ?? null,
    message: data.birthday_message ?? null,
  };
}

export async function setBirthday(
  guildId: string,
  userId: string,
  month: number,
  day: number,
  year: number | null,
): Promise<void> {
  const db = getDb();
  const { error } = await db.from('bot_birthdays').upsert({
    guild_id: guildId,
    user_id: userId,
    month,
    day,
    year,
  });
  if (error) throw error;
}

export async function removeBirthday(
  guildId: string,
  userId: string,
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('bot_birthdays')
    .delete()
    .eq('guild_id', guildId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function listBirthdaysToday(
  guildId: string,
  month: number,
  day: number,
): Promise<Birthday[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_birthdays')
    .select('guild_id, user_id, month, day, year')
    .eq('guild_id', guildId)
    .eq('month', month)
    .eq('day', day);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    guildId: r.guild_id as string,
    userId: r.user_id as string,
    month: r.month as number,
    day: r.day as number,
    year: (r.year as number | null) ?? null,
  }));
}

export async function listAllBirthdaysForGuild(
  guildId: string,
): Promise<Birthday[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_birthdays')
    .select('guild_id, user_id, month, day, year')
    .eq('guild_id', guildId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    guildId: r.guild_id as string,
    userId: r.user_id as string,
    month: r.month as number,
    day: r.day as number,
    year: (r.year as number | null) ?? null,
  }));
}
