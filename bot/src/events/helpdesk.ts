import {
  EmbedBuilder,
  Events,
  MessageFlags,
  type ButtonInteraction,
  type Client,
  type Interaction,
} from 'discord.js';
import { getHelpdeskItem } from '../db/helpdesk.js';

function parseCustomId(raw: string): string | null {
  if (!raw.startsWith('hd:btn:')) return null;
  return raw.slice(7);
}

async function handleClick(
  interaction: ButtonInteraction,
  itemId: string,
): Promise<void> {
  const item = await getHelpdeskItem(itemId);
  if (!item) {
    await interaction.reply({
      content: 'Diese Antwort existiert nicht mehr.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const embed = new EmbedBuilder()
    .setColor(item.answerColor ?? 0x5865f2)
    .setTitle(item.label.slice(0, 256))
    .setDescription(item.answer.slice(0, 4000));
  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}

export function registerHelpdesk(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    const itemId = parseCustomId(interaction.customId);
    if (!itemId) return;
    try {
      await handleClick(interaction, itemId);
    } catch (err) {
      console.error('[helpdesk]', err);
    }
  });
}
