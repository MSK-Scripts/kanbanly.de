import {
  ChannelType,
  EmbedBuilder,
  Events,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type Client,
  type Interaction,
  type TextChannel,
} from 'discord.js';
import { getDb } from '../db.js';

export const SHOP_BUY_PREFIX = 'shop:buy:';

function formatPrice(cents: number, currency: string): string {
  const value = (cents / 100).toFixed(2);
  const cur = currency.toUpperCase();
  if (cur === 'EUR') return `${value.replace('.', ',')} €`;
  if (cur === 'USD') return `$${value}`;
  return `${value} ${cur}`;
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://kanbanly.de').replace(/\/$/, '');
}

async function handleBuy(
  interaction: ButtonInteraction,
  productId: string,
): Promise<void> {
  if (!interaction.guild) return;
  const db = getDb();

  // Product + Guild laden.
  const [{ data: product }, { data: guildCfg }] = await Promise.all([
    db
      .from('bot_products')
      .select('id, guild_id, name, price_cents, currency, active, stock')
      .eq('id', productId)
      .maybeSingle(),
    db
      .from('bot_guilds')
      .select(
        'stripe_account_id, stripe_charges_enabled, shop_order_category_id, shop_staff_role_id',
      )
      .eq('guild_id', interaction.guild.id)
      .maybeSingle(),
  ]);

  if (!product || !product.active) {
    await interaction.reply({
      content: 'Dieses Produkt ist gerade nicht verfügbar.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (typeof product.stock === 'number' && product.stock <= 0) {
    await interaction.reply({
      content: 'Ausverkauft.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (
    !guildCfg?.stripe_account_id ||
    !guildCfg.stripe_charges_enabled
  ) {
    await interaction.reply({
      content:
        'Der Server-Owner hat sein Stripe-Konto noch nicht vollständig verbunden — Bestellungen sind aktuell nicht möglich.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Order-Channel anlegen (privat, nur User + Staff).
  let ticketChannelId: string | null = null;
  try {
    const overwrites: Array<{
      id: string;
      allow?: bigint[];
      deny?: bigint[];
    }> = [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
    ];
    if (guildCfg.shop_staff_role_id) {
      overwrites.push({
        id: guildCfg.shop_staff_role_id as string,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      });
    }
    const channel = await interaction.guild.channels.create({
      name: `order-${interaction.user.username
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 16) || 'user'}`,
      type: ChannelType.GuildText,
      parent: (guildCfg.shop_order_category_id as string | null) ?? undefined,
      permissionOverwrites: overwrites,
    });
    ticketChannelId = channel.id;
  } catch (err) {
    console.error('[shop] create channel:', err);
  }

  // Order-Row anlegen.
  const { data: order, error: orderErr } = await db
    .from('bot_orders')
    .insert({
      guild_id: interaction.guild.id,
      user_id: interaction.user.id,
      product_id: product.id,
      product_name: product.name,
      amount_cents: product.price_cents,
      currency: product.currency,
      status: 'pending',
      ticket_channel_id: ticketChannelId,
    })
    .select('id')
    .single();
  if (orderErr || !order) {
    console.error('[shop] insert order:', orderErr);
    await interaction.editReply('Konnte Bestellung nicht anlegen.');
    return;
  }

  const checkoutUrl = `${siteUrl()}/order/${order.id}`;

  if (ticketChannelId) {
    const channel = (await interaction.guild.channels
      .fetch(ticketChannelId)
      .catch(() => null)) as TextChannel | null;
    if (channel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle('🛒 Neue Bestellung')
        .setDescription(
          `Hi <@${interaction.user.id}>, deine Bestellung ist vorbereitet.\n\n` +
            `**Produkt:** ${product.name}\n` +
            `**Preis:** ${formatPrice(product.price_cents as number, product.currency as string)}\n\n` +
            `Klick auf den Link unten um sicher mit Stripe zu bezahlen. Sobald die Zahlung eingeht, wird das Staff-Team automatisch benachrichtigt.`,
        )
        .setColor(0x380d52)
        .setFooter({ text: `Order-ID: ${order.id}` });
      const content = guildCfg.shop_staff_role_id
        ? `<@${interaction.user.id}> · <@&${guildCfg.shop_staff_role_id}>`
        : `<@${interaction.user.id}>`;
      await channel
        .send({
          content,
          embeds: [embed],
          allowedMentions: {
            users: [interaction.user.id],
            roles: guildCfg.shop_staff_role_id
              ? [guildCfg.shop_staff_role_id as string]
              : [],
          },
        })
        .catch(() => null);
      await channel
        .send({
          content: `💳 **Bezahllink:** ${checkoutUrl}`,
        })
        .catch(() => null);
    }
    await interaction.editReply(
      `✓ Bestellung erstellt: <#${ticketChannelId}>\nBezahllink: ${checkoutUrl}`,
    );
  } else {
    await interaction.editReply(
      `✓ Bestellung erstellt.\n💳 Bezahllink: ${checkoutUrl}\n\n(Konnte keinen privaten Channel anlegen — bitte Bot-Permissions prüfen.)`,
    );
  }
}

export function registerShop(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith(SHOP_BUY_PREFIX)) return;
    try {
      const productId = interaction.customId.slice(SHOP_BUY_PREFIX.length);
      await handleBuy(interaction, productId);
    } catch (err) {
      console.error('[shop]', err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
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
