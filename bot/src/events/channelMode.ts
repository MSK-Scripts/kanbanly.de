import { Events, PermissionFlagsBits, type Client, type Message } from 'discord.js';
import { getChannelMode } from '../db/channelModes.js';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|mkv|avi|m4v)$/i;

function hasImageAttachment(message: Message, allowVideos: boolean): boolean {
  for (const a of message.attachments.values()) {
    const name = a.name ?? '';
    const type = a.contentType ?? '';
    if (type.startsWith('image/') || IMAGE_EXT.test(name)) return true;
    if (allowVideos && (type.startsWith('video/') || VIDEO_EXT.test(name))) return true;
  }
  // Embeds (z.B. Tenor-Gifs) zählen ebenfalls.
  for (const e of message.embeds) {
    if (e.image || e.thumbnail) return true;
    if (allowVideos && e.video) return true;
  }
  return false;
}

export function registerChannelMode(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.deletable) return;

      // Moderatoren werden nicht gefiltert.
      const member = message.member;
      if (
        member?.permissions.has(PermissionFlagsBits.ManageMessages) ||
        member?.permissions.has(PermissionFlagsBits.Administrator)
      ) {
        return;
      }

      const cfg = await getChannelMode(message.guild.id, message.channel.id);
      if (!cfg) return;

      let violates = false;
      let reason = '';

      if (cfg.mode === 'images_only') {
        if (!hasImageAttachment(message, cfg.allowVideos)) {
          violates = true;
          reason = cfg.allowVideos
            ? 'Dieser Channel ist nur für Bilder und Videos.'
            : 'Dieser Channel ist nur für Bilder.';
        }
      } else if (cfg.mode === 'text_only') {
        if (message.attachments.size > 0) {
          violates = true;
          reason = 'Dieser Channel ist nur für Text — keine Anhänge.';
        }
      }

      if (!violates) return;

      await message.delete().catch(() => {});
      try {
        await message.author.send(
          `⚠️ Deine Nachricht in <#${message.channel.id}> wurde gelöscht: ${reason}`,
        );
      } catch {
        // DMs deaktiviert — egal.
      }
    } catch (err) {
      console.error('[channelMode]', err);
    }
  });
}
