import {
  type Attachment,
  type Message,
  type TextBasedChannel,
} from 'discord.js';
import { saveTicketTranscript, type TranscriptMessage } from '../db/tickets.js';

const MAX_MESSAGES = 1000;
const FETCH_LIMIT = 100;

export async function captureAndSaveTranscript(
  channel: TextBasedChannel,
): Promise<number> {
  if (!('messages' in channel)) return 0;
  const messages: TranscriptMessage[] = [];
  let before: string | undefined = undefined;
  while (messages.length < MAX_MESSAGES) {
    const batch = (await channel.messages
      .fetch({ limit: FETCH_LIMIT, ...(before ? { before } : {}) })
      .catch(() => null)) as ReadonlyMap<string, Message> | null;
    if (!batch || batch.size === 0) break;
    for (const m of batch.values()) {
      messages.push({
        id: m.id,
        author: {
          id: m.author.id,
          username: m.author.username,
          avatarUrl: m.author.displayAvatarURL({ size: 64 }),
        },
        content: m.content.slice(0, 4000),
        timestamp: m.createdAt.toISOString(),
        attachments: Array.from(m.attachments.values()).map((a: Attachment) => ({
          url: a.url,
          name: a.name ?? 'file',
        })),
        embedsCount: m.embeds.length,
      });
      before = m.id;
      if (messages.length >= MAX_MESSAGES) break;
    }
    if (batch.size < FETCH_LIMIT) break;
  }
  // Chronologisch sortieren (älteste zuerst).
  messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  await saveTicketTranscript(channel.id, messages);
  return messages.length;
}
