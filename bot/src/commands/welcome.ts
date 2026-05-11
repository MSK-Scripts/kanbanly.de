import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import {
  ensureGuild,
  getWelcomeConfig,
  renderWelcomeTemplate,
  setWelcomeConfig,
} from '../db/guilds.js';

const DEFAULT_TEMPLATE =
  'Willkommen {mention} auf **{server}** 🎉 — ihr seid jetzt zu {members}.';

const data = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Begrüßungsnachrichten für neue Mitglieder.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName('setup')
      .setDescription('Welcome-Channel und -Text setzen.')
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Channel, in dem neue Mitglieder begrüßt werden.')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName('message')
          .setDescription(
            'Platzhalter: {user} {mention} {server} {members}. Leer = Default-Text.',
          )
          .setMaxLength(1000),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('disable').setDescription('Welcome-Messages deaktivieren.'),
  )
  .addSubcommand((sub) =>
    sub.setName('show').setDescription('Aktuelle Welcome-Konfiguration anzeigen.'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('test')
      .setDescription('Welcome-Message einmal testweise im konfigurierten Channel posten.'),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      content: 'Nur in Servern verwendbar.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await ensureGuild(interaction.guild);

  const sub = interaction.options.getSubcommand(true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (sub === 'setup') {
    const channel = interaction.options.getChannel('channel', true);
    const messageRaw = interaction.options.getString('message');
    const message = messageRaw && messageRaw.trim().length > 0 ? messageRaw : DEFAULT_TEMPLATE;
    await setWelcomeConfig(interaction.guild.id, {
      enabled: true,
      channelId: channel.id,
      message,
    });
    await interaction.editReply(
      `✅ Welcome aktiviert in <#${channel.id}>.\nText: ${message}`,
    );
    return;
  }

  if (sub === 'disable') {
    await setWelcomeConfig(interaction.guild.id, { enabled: false });
    await interaction.editReply('🔕 Welcome-Messages deaktiviert.');
    return;
  }

  if (sub === 'show') {
    const cfg = await getWelcomeConfig(interaction.guild.id);
    if (!cfg || !cfg.enabled) {
      await interaction.editReply('Welcome ist aktuell deaktiviert. `/welcome setup` zum Einrichten.');
      return;
    }
    await interaction.editReply(
      `**Status:** aktiv\n**Channel:** ${cfg.channelId ? `<#${cfg.channelId}>` : '— (nicht gesetzt)'}\n**Text:**\n${cfg.message ?? DEFAULT_TEMPLATE}`,
    );
    return;
  }

  if (sub === 'test') {
    const cfg = await getWelcomeConfig(interaction.guild.id);
    if (!cfg || !cfg.enabled || !cfg.channelId) {
      await interaction.editReply('Erst mit `/welcome setup` einrichten.');
      return;
    }
    const channel = await interaction.guild.channels
      .fetch(cfg.channelId)
      .catch(() => null);
    if (!channel || !channel.isTextBased()) {
      await interaction.editReply(
        'Konfigurierter Channel existiert nicht mehr oder ist nicht textbasiert.',
      );
      return;
    }
    const member = interaction.member && 'user' in interaction.member ? interaction.member : null;
    const rendered = renderWelcomeTemplate(cfg.message ?? DEFAULT_TEMPLATE, {
      username: interaction.user.username,
      mention: `<@${interaction.user.id}>`,
      serverName: interaction.guild.name,
      memberCount: interaction.guild.memberCount,
    });
    await (channel as TextChannel).send({ content: rendered, allowedMentions: { users: [interaction.user.id] } });
    await interaction.editReply(`📨 Testnachricht in <#${cfg.channelId}> gepostet.`);
    void member;
    return;
  }
}

const command: SlashCommand = { data, execute };
export default command;
