import { type Client, type TextChannel } from 'discord.js';
import { getDb } from '../db.js';
import { getBirthdayConfig, listBirthdaysToday } from '../db/birthdays.js';

const CHECK_INTERVAL_MS = 60 * 60_000; // jede Stunde
let lastFireDay = -1;

function todayParts(): { month: number; day: number; year: number } {
  const d = new Date();
  return { month: d.getMonth() + 1, day: d.getDate(), year: d.getFullYear() };
}

function renderMessage(
  template: string,
  user: { mention: string; username: string; age: number | null },
): string {
  return template
    .replaceAll('{user}', user.username)
    .replaceAll('{mention}', user.mention)
    .replaceAll('{age}', user.age !== null ? String(user.age) : '?');
}

async function fireForGuild(client: Client, guildId: string): Promise<void> {
  const cfg = await getBirthdayConfig(guildId);
  if (!cfg.enabled || !cfg.channelId) return;

  const { month, day, year } = todayParts();
  const birthdays = await listBirthdaysToday(guildId, month, day);
  if (birthdays.length === 0) return;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;
  const channel = (await guild.channels.fetch(cfg.channelId).catch(() => null)) as
    | TextChannel
    | null;
  if (!channel?.isTextBased()) return;

  const template =
    cfg.message ?? '🎂 Alles Gute zum Geburtstag, {mention}! 🎉';

  for (const b of birthdays) {
    const member = await guild.members.fetch(b.userId).catch(() => null);
    if (!member) continue;
    const age = b.year !== null ? year - b.year : null;
    const text = renderMessage(template, {
      mention: `<@${b.userId}>`,
      username: member.user.username,
      age,
    });
    await channel
      .send({ content: text, allowedMentions: { users: [b.userId] } })
      .catch(() => {});
  }
}

async function tick(client: Client): Promise<void> {
  try {
    const now = new Date();
    const day = now.getDate();
    // Nur 1× pro Tag feuern, beim ersten Tick mit Stunde >= 9 UTC.
    if (now.getUTCHours() < 9) return;
    if (lastFireDay === day) return;
    lastFireDay = day;

    const db = getDb();
    const { data: guilds } = await db
      .from('bot_guilds')
      .select('guild_id')
      .eq('birthday_enabled', true);
    for (const g of guilds ?? []) {
      await fireForGuild(client, g.guild_id as string).catch((err) =>
        console.error('[birthday] fireForGuild:', err),
      );
    }
  } catch (err) {
    console.error('[birthday/scheduler]', err);
  }
}

export function startBirthdayScheduler(client: Client): void {
  setTimeout(() => {
    tick(client).catch(() => {});
    setInterval(() => tick(client).catch(() => {}), CHECK_INTERVAL_MS);
  }, 60_000);
  console.log('[birthday/scheduler] gestartet — Tick pro Stunde');
}
