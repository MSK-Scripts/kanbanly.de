import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { env } from './env.js';
import { commandMap } from './commands/index.js';

// Phase 1: nur Guilds-Intent (genug für Slash-Commands).
// Phase 2 (Welcome): + GuildMembers (privileged, im Dev-Portal aktivieren).
// Phase 4 (AutoMod): + GuildMessages, MessageContent (privileged).
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
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

const shutdown = (signal: string) => {
  console.log(`[bot] ${signal} empfangen, fahre runter…`);
  client.destroy();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(env.DISCORD_BOT_TOKEN);
