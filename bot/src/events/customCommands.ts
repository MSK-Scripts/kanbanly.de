import { Events, type Client, type Message } from 'discord.js';
import {
  getCommandPrefix,
  getCustomCommand,
  incrementCustomCommandUses,
} from '../db/customCommands.js';

// Simpler In-Memory-Cache für die Prefixe — wenige Schreiboperationen,
// viele Reads. 30s TTL ist genug für UX, ohne Stale-Daten zu lange zu halten.
const prefixCache = new Map<string, { value: string; expiresAt: number }>();

async function prefixFor(guildId: string): Promise<string> {
  const cached = prefixCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await getCommandPrefix(guildId);
  prefixCache.set(guildId, { value, expiresAt: Date.now() + 30_000 });
  return value;
}

export function registerCustomCommands(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (message.system) return;
      if (message.content.length < 2) return;

      const prefix = await prefixFor(message.guild.id);
      if (!message.content.startsWith(prefix)) return;

      const rawTrigger = message.content.slice(prefix.length).split(/\s+/, 1)[0];
      if (!rawTrigger) return;
      const trigger = rawTrigger.toLowerCase();
      // Nur a-z 0-9 _ - — der reguläre Pattern aus der DB-Constraint.
      if (!/^[a-z0-9_-]{1,32}$/.test(trigger)) return;

      const cmd = await getCustomCommand(message.guild.id, trigger);
      if (!cmd) return;

      await message.reply({
        content: cmd.response,
        allowedMentions: { repliedUser: false, parse: [] },
      });
      incrementCustomCommandUses(message.guild.id, trigger).catch(() => {});
    } catch (err) {
      console.error('[customcmd]', err);
    }
  });
}

// Wird vom /customcmd-Command nach Änderungen aufgerufen, damit der
// Cache nicht 30s alte Daten liefert.
export function invalidatePrefixCache(guildId: string): void {
  prefixCache.delete(guildId);
}
