import {
  Events,
  MessageFlags,
  type ButtonInteraction,
  type Client,
  type Interaction,
  type TextChannel,
} from 'discord.js';
import {
  addEntry,
  getGiveaway,
  hasEntry,
  listEntries,
  removeEntry,
} from '../db/giveaways.js';
import {
  buildGiveawayComponents,
  buildGiveawayEmbed,
  parseGiveawayCustomId,
} from '../lib/giveaway.js';

async function refreshGiveawayMessage(
  client: Client,
  giveawayId: string,
): Promise<void> {
  const gw = await getGiveaway(giveawayId);
  if (!gw || !gw.messageId || gw.ended) return;
  const guild = await client.guilds.fetch(gw.guildId).catch(() => null);
  if (!guild) return;
  const channel = (await guild.channels.fetch(gw.channelId).catch(() => null)) as
    | TextChannel
    | null;
  if (!channel) return;
  const msg = await channel.messages.fetch(gw.messageId).catch(() => null);
  if (!msg) return;
  const entries = await listEntries(giveawayId);
  const embed = buildGiveawayEmbed(
    gw.prize,
    new Date(gw.endsAt),
    gw.winnersCount,
    entries.length,
    false,
  );
  const components = buildGiveawayComponents(giveawayId, false);
  await msg.edit({ embeds: [embed], components }).catch(() => {});
}

async function handleJoin(
  interaction: ButtonInteraction,
  giveawayId: string,
): Promise<void> {
  const gw = await getGiveaway(giveawayId);
  if (!gw || gw.ended) {
    await interaction.reply({
      content: 'Dieses Giveaway ist bereits beendet.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const already = await hasEntry(giveawayId, interaction.user.id);
  if (already) {
    await removeEntry(giveawayId, interaction.user.id);
    await interaction.reply({
      content: 'Du nimmst nicht mehr teil.',
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await addEntry(giveawayId, interaction.user.id);
    await interaction.reply({
      content: `✓ Du nimmst am Giveaway „${gw.prize}" teil. Viel Glück!`,
      flags: MessageFlags.Ephemeral,
    });
  }
  refreshGiveawayMessage(interaction.client, giveawayId).catch(() => {});
}

export function registerGiveawayButtons(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    const giveawayId = parseGiveawayCustomId(interaction.customId);
    if (!giveawayId) return;
    try {
      await handleJoin(interaction, giveawayId);
    } catch (err) {
      console.error('[giveaway/button]', err);
    }
  });
}
