import type { Client, TextChannel } from 'discord.js';
import { listDueReminders, markReminderDelivered } from '../db/reminders.js';

const POLL_INTERVAL_MS = 30_000;

async function deliverOne(client: Client, reminder: {
  id: string;
  userId: string;
  guildId: string | null;
  channelId: string | null;
  content: string;
}): Promise<void> {
  const text = `⏰ <@${reminder.userId}>, du wolltest erinnert werden:\n> ${reminder.content}`;

  // Erst Channel versuchen (wenn gesetzt + erreichbar), sonst DM.
  if (reminder.channelId) {
    const channel = await client.channels.fetch(reminder.channelId).catch(() => null);
    if (channel && channel.isTextBased() && 'send' in channel) {
      try {
        await (channel as TextChannel).send({
          content: text,
          allowedMentions: { users: [reminder.userId] },
        });
        return;
      } catch (err) {
        console.warn(`[reminder] channel send failed, falling back to DM:`, err);
      }
    }
  }

  // Fallback: DM.
  try {
    const user = await client.users.fetch(reminder.userId);
    await user.send({ content: text });
  } catch (err) {
    console.warn(`[reminder] DM failed for ${reminder.userId}:`, err);
  }
}

export function startReminderScheduler(client: Client): void {
  const tick = async () => {
    try {
      const due = await listDueReminders(new Date(), 25);
      for (const r of due) {
        await deliverOne(client, r);
        await markReminderDelivered(r.id);
      }
    } catch (err) {
      console.error('[reminder-scheduler]', err);
    }
  };

  // Beim Start einmal direkt, dann alle 30s.
  client.once('clientReady', () => {
    tick().catch(() => {});
    setInterval(() => {
      tick().catch(() => {});
    }, POLL_INTERVAL_MS);
  });
}
