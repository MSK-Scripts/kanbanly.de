import { Client, Events, GatewayIntentBits, MessageFlags, Partials } from 'discord.js';
import { env } from './env.js';
import { commandMap } from './commands/index.js';
import { registerGuildMemberAdd } from './events/guildMemberAdd.js';
import { registerGuildCreate } from './events/guildCreate.js';
import { registerReactionEvents } from './events/reactions.js';

// Intents:
// - Guilds: Slash-Commands, Channel/Role-Cache
// - GuildMembers (privileged, im Dev-Portal aktivieren): Welcome
// - GuildMessageReactions: Reaction-Roles
// Phase 4 wird zusätzlich GuildMessages + MessageContent (privileged) brauchen.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  // Partials: nötig, damit Reaction-Events auch für ältere (nicht gecachte) Messages feuern.
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});

client.once(Events.ClientReady, (c) => {
  console.log(`[bot] eingeloggt als ${c.user.tag} · ${c.guilds.cache.size} Guild(s)`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = commandMap.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(`[bot] /${interaction.commandName} fehlgeschlagen:`, err);
    if (interaction.replied || interaction.deferred) {
      await interaction
        .followUp({ content: 'Da ist was schiefgelaufen.', flags: MessageFlags.Ephemeral })
        .catch(() => {});
    } else {
      await interaction
        .reply({ content: 'Da ist was schiefgelaufen.', flags: MessageFlags.Ephemeral })
        .catch(() => {});
    }
  }
});

registerGuildCreate(client);
registerGuildMemberAdd(client);
registerReactionEvents(client);

const shutdown = (signal: string) => {
  console.log(`[bot] ${signal} empfangen, fahre runter…`);
  client.destroy();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(env.DISCORD_BOT_TOKEN);
