import { Events, type Client, type Message, type TextChannel } from 'discord.js';
import { getStickyForChannel, setStickyLastMessage } from '../db/sticky.js';
import { sendStyled } from '../lib/sendStyled.js';

// Per-Channel-Buffer um Bursts zu glätten: nach 3 Nachrichten oder 5s re-posten.
const pending = new Map<string, { count: number; timer: NodeJS.Timeout | null }>();
const REPOST_AFTER_MESSAGES = 3;
const REPOST_DELAY_MS = 5_000;

async function repostSticky(channel: TextChannel, guildId: string): Promise<void> {
  try {
    const sticky = await getStickyForChannel(guildId, channel.id);
    if (!sticky) return;

    // Alte Sticky-Nachricht löschen.
    if (sticky.lastMessageId) {
      const old = await channel.messages
        .fetch(sticky.lastMessageId)
        .catch(() => null);
      if (old?.deletable) await old.delete().catch(() => {});
    }

    const body = sticky.useEmbed ? sticky.content : `📌 **Wichtig**\n${sticky.content}`;
    const sent = await sendStyled(channel, body, {
      useEmbed: sticky.useEmbed,
      embedColor: sticky.embedColor,
      embedTitle: sticky.useEmbed ? '📌 Wichtig' : null,
    });
    const sentId = (sent as { id?: string } | null)?.id;
    if (sentId) {
      await setStickyLastMessage(guildId, channel.id, sentId).catch((err) =>
        console.error('[sticky] setLastMessage:', err),
      );
    }
  } catch (err) {
    console.error('[sticky] repost:', err);
  }
}

function schedule(channel: TextChannel, guildId: string): void {
  const key = `${guildId}:${channel.id}`;
  const state = pending.get(key) ?? { count: 0, timer: null };
  state.count += 1;
  if (state.count >= REPOST_AFTER_MESSAGES) {
    if (state.timer) clearTimeout(state.timer);
    pending.delete(key);
    repostSticky(channel, guildId).catch(() => {});
    return;
  }
  if (!state.timer) {
    state.timer = setTimeout(() => {
      pending.delete(key);
      repostSticky(channel, guildId).catch(() => {});
    }, REPOST_DELAY_MS);
  }
  pending.set(key, state);
}

export function registerSticky(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.channel.isTextBased()) return;
      const channel = message.channel as TextChannel;

      const sticky = await getStickyForChannel(message.guild.id, channel.id);
      if (!sticky) return;

      schedule(channel, message.guild.id);
    } catch (err) {
      console.error('[sticky] messageCreate:', err);
    }
  });
}
