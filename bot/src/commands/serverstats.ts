import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import { ensureGuild } from '../db/guilds.js';
import {
  deleteStatChannel,
  listStatChannelsForGuild,
  upsertStatChannel,
} from '../db/statsChannels.js';

const HELP = [
  'Verfügbare Variablen:',
  '`{members}` · Mitgliederzahl insgesamt',
  '`{boosts}` · Nitro-Boost-Zahl',
  '`{name}` · Server-Name',
  '',
  'Beispiele:',
  '`👥 Members: {members}`',
  '`🚀 Boosts: {boosts}`',
].join('\n');

const data = new SlashCommandBuilder()
  .setName('serverstats')
  .setDescription('Voice-/Category-Channels mit Live-Werten verwalten.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName('add')
      .setDescription('Channel als Stats-Anzeige hinzufügen.')
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Voice- oder Category-Channel.')
          .addChannelTypes(
            ChannelType.GuildVoice,
            ChannelType.GuildCategory,
            ChannelType.GuildStageVoice,
          )
          .setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName('template')
          .setDescription('Template, z.B. "👥 {members}". Variablen: /serverstats help')
          .setRequired(true)
          .setMaxLength(100),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('remove')
      .setDescription('Channel nicht mehr automatisch aktualisieren.')
      .addChannelOption((o) =>
        o.setName('channel').setDescription('Welcher Channel?').setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s.setName('list').setDescription('Alle Stats-Channels dieses Servers.'),
  )
  .addSubcommand((s) =>
    s.setName('help').setDescription('Welche Variablen kann ich im Template nutzen?'),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'Nur in Servern verwendbar.', flags: MessageFlags.Ephemeral });
    return;
  }
  await ensureGuild(interaction.guild);
  const sub = interaction.options.getSubcommand(true);

  if (sub === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('🔢 Server-Stats Variablen')
      .setDescription(HELP)
      .setColor(0x6366f1);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (sub === 'list') {
    const rows = await listStatChannelsForGuild(interaction.guild.id);
    if (rows.length === 0) {
      await interaction.editReply('Keine Stats-Channels. Leg welche mit `/serverstats add` an.');
      return;
    }
    const body = rows
      .map((r) => `<#${r.channelId}> · \`${r.template}\``)
      .join('\n');
    const embed = new EmbedBuilder()
      .setTitle('🔢 Stats-Channels')
      .setDescription(body)
      .setColor(0x6366f1)
      .setFooter({ text: 'Update alle 10 Min (Discord rate-limit).' });
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === 'add') {
    const channel = interaction.options.getChannel('channel', true);
    const template = interaction.options.getString('template', true);
    if (!/\{(members|boosts|name)\}/.test(template)) {
      await interaction.editReply(
        'Template enthält keine Variable. `/serverstats help` zeigt verfügbare.',
      );
      return;
    }
    await upsertStatChannel({
      guildId: interaction.guild.id,
      channelId: channel.id,
      template,
    });
    await interaction.editReply(
      `✅ <#${channel.id}> wird ab jetzt automatisch aktualisiert (alle ~10 Min).\nTemplate: \`${template}\``,
    );
    return;
  }

  if (sub === 'remove') {
    const channel = interaction.options.getChannel('channel', true);
    const ok = await deleteStatChannel(interaction.guild.id, channel.id);
    await interaction.editReply(
      ok
        ? `🗑️ <#${channel.id}> wird nicht mehr aktualisiert.`
        : 'Channel war gar nicht in der Liste.',
    );
    return;
  }
}

const command: SlashCommand = { data, execute };
export default command;
