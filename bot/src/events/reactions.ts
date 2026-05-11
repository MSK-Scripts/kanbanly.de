import {
  Events,
  type Client,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from 'discord.js';
import { lookupReactionRole } from '../db/reactionRoles.js';

function reactionKey(r: MessageReaction | PartialMessageReaction): string | null {
  if (r.emoji.id) return r.emoji.id;
  if (r.emoji.name) return r.emoji.name;
  return null;
}

async function applyOrRemove(
  raw: MessageReaction | PartialMessageReaction,
  rawUser: User | PartialUser,
  mode: 'add' | 'remove',
): Promise<void> {
  try {
    if (rawUser.bot) return;
    const reaction = raw.partial ? await raw.fetch() : raw;
    const user = rawUser.partial ? await rawUser.fetch() : rawUser;
    const guild = reaction.message.guild;
    if (!guild) return;
    const key = reactionKey(reaction);
    if (!key) return;

    const rr = await lookupReactionRole(reaction.message.id, key);
    if (!rr) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    if (mode === 'add') {
      if (!member.roles.cache.has(rr.roleId)) {
        await member.roles.add(rr.roleId, 'reaction-role').catch((e) => {
          console.error('[rr] roles.add fehlgeschlagen:', e);
        });
      }
    } else {
      if (member.roles.cache.has(rr.roleId)) {
        await member.roles.remove(rr.roleId, 'reaction-role').catch((e) => {
          console.error('[rr] roles.remove fehlgeschlagen:', e);
        });
      }
    }
  } catch (err) {
    console.error(`[rr] ${mode} Handler-Fehler:`, err);
  }
}

export function registerReactionEvents(client: Client): void {
  client.on(Events.MessageReactionAdd, (reaction, user) =>
    applyOrRemove(reaction, user, 'add'),
  );
  client.on(Events.MessageReactionRemove, (reaction, user) =>
    applyOrRemove(reaction, user, 'remove'),
  );
}
