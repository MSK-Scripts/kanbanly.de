import {
  EmbedBuilder,
  Events,
  MessageFlags,
  type ButtonInteraction,
  type Client,
  type Interaction,
} from 'discord.js';
import { getDb } from '../db.js';

export const PRICELIST_BUTTON_PREFIX = 'pl:item:';

async function handleItemClick(
  interaction: ButtonInteraction,
  itemId: string,
): Promise<void> {
  const db = getDb();
  const { data: item } = await db
    .from('bot_pricelist_items')
    .select(
      'detail_title, detail_description, detail_price, detail_color, detail_image_url',
    )
    .eq('id', itemId)
    .maybeSingle();
  if (!item) {
    await interaction.reply({
      content: 'Dieser Eintrag existiert nicht mehr.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle((item.detail_title as string).slice(0, 256))
    .setColor(((item.detail_color as number | null) ?? 0x380d52));
  const desc = (item.detail_description as string | null) ?? '';
  if (desc) embed.setDescription(desc.slice(0, 4000));
  const price = item.detail_price as string | null;
  if (price) embed.addFields({ name: 'Preis', value: price.slice(0, 1024) });
  const img = item.detail_image_url as string | null;
  if (img) embed.setImage(img);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export function registerPricelist(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith(PRICELIST_BUTTON_PREFIX)) return;
    try {
      const itemId = interaction.customId.slice(PRICELIST_BUTTON_PREFIX.length);
      await handleItemClick(interaction, itemId);
    } catch (err) {
      console.error('[pricelist]', err);
      if (!interaction.replied) {
        await interaction
          .reply({
            content: 'Da ist was schiefgelaufen.',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
  });
}
