import { Client, Events, GatewayIntentBits, MessageFlags, Partials } from 'discord.js';
import { env } from './env.js';
import { commandMap } from './commands/index.js';
import { registerGuildMemberAdd } from './events/guildMemberAdd.js';
import { registerGuildCreate } from './events/guildCreate.js';
import { registerReactionEvents } from './events/reactions.js';
import { registerLogger } from './events/logger.js';
import { registerXp } from './events/xp.js';
import { registerCustomCommands } from './events/customCommands.js';
import { registerAutoMod } from './events/automod.js';
import { startReminderScheduler } from './events/reminders.js';
import { startStatsUpdater } from './events/statsUpdater.js';
import { registerTicketButtons } from './events/ticketButtons.js';
import { registerBooster } from './events/booster.js';
import { registerSticky } from './events/sticky.js';
import { registerChannelMode } from './events/channelMode.js';
import { startChannelModeRealtime } from './db/channelModes.js';
import { registerRrInteractions } from './events/rrInteractions.js';
import { registerVerify } from './events/verify.js';
import { registerAntiRaid } from './events/antiraid.js';
import { registerGiveawayButtons } from './events/giveawayButtons.js';
import { startGiveawayScheduler } from './events/giveawayScheduler.js';

// Intents:
// - Guilds: Slash-Commands, Channel/Role-Cache
// - GuildMembers (privileged, Dev-Portal): Welcome, Auto-Roles, Join/Leave/Role-Logs
// - GuildMessageReactions: Reaction-Roles
// - GuildMessages: Message-Edit/Delete-Logs (Events ohne Content)
// - MessageContent (privileged, Dev-Portal): Inhalt für Edit/Delete-Logs
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  // Partials: nötig, damit Reaction-Events und Message-Delete auch für ältere
  // (nicht gecachte) Messages feuern.
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
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
registerLogger(client);
registerXp(client);
registerCustomCommands(client);
registerAutoMod(client);
startReminderScheduler(client);
startStatsUpdater(client);
registerTicketButtons(client);
registerBooster(client);
registerSticky(client);
registerChannelMode(client);
registerRrInteractions(client);
startChannelModeRealtime();
registerVerify(client);
registerAntiRaid(client);
registerGiveawayButtons(client);
startGiveawayScheduler(client);

const shutdown = (signal: string) => {
  console.log(`[bot] ${signal} empfangen, fahre runter…`);
  client.destroy();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(env.DISCORD_BOT_TOKEN);
