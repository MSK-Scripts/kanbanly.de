import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import { ensureGuild } from '../db/guilds.js';
import {
  createGiveaway,
  finalizeGiveaway,
  getGiveaway,
  listEntries,
  setGiveawayMessageId,
} from '../db/giveaways.js';
import {
  buildGiveawayComponents,
  buildGiveawayEmbed,
  parseDuration,
  pickWinners,
} from '../lib/giveaway.js';

const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('Verwalte Giveaways.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName('start')
      .setDescription('Neues Giveaway starten.')
      .addStringOption((o) =>
        o.setName('prize').setDescription('Was wird verlost?').setRequired(true).setMaxLength(200),
      )
      .addStringOption((o) =>
        o.setName('duration').setDescription('Dauer (z.B. 1d, 2h, 30m, 1d 2h)').setRequired(true),
      )
      .addIntegerOption((o) =>
        o
          .setName('winners')
          .setDescription('Anzahl Gewinner (Standard: 1)')
          .setMinValue(1)
          .setMaxValue(20),
      )
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Channel für die Giveaway-Nachricht (Standard: aktueller)')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('reroll')
      .setDescription('Beendetes Giveaway neu auslosen.')
      .addStringOption((o) =>
        o.setName('id').setDescription('Giveaway-ID').setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('end')
      .setDescription('Giveaway sofort beenden.')
      .addStringOption((o) =>
        o.setName('id').setDescription('Giveaway-ID').setRequired(true),
      ),
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

  if (sub === 'start') {
    const prize = interaction.options.getString('prize', true);
    const durationStr = interaction.options.getString('duration', true);
    const winners = interaction.options.getInteger('winners') ?? 1;
    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel | null;
    if (!channel || !channel.isTextBased()) {
      await interaction.reply({
        content: 'Ungültiger Channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs < 30_000 || durationMs > 30 * 86400 * 1000) {
      await interaction.reply({
        content:
          'Ungültige Dauer. Format: `30s`, `5m`, `2h`, `1d` — oder kombiniert `1d 2h`. Min 30s, max 30d.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const endsAt = new Date(Date.now() + durationMs);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const gw = await createGiveaway({
      guildId: interaction.guild.id,
      channelId: channel.id,
      prize,
      winnersCount: winners,
      endsAt,
      createdByUserId: interaction.user.id,
    });

    const embed = buildGiveawayEmbed(prize, endsAt, winners, 0, false);
    const components = buildGiveawayComponents(gw.id, false);

    try {
      const sent = await channel.send({ embeds: [embed], components });
      await setGiveawayMessageId(gw.id, sent.id);
      await interaction.editReply(
        `🎉 Giveaway gestartet in <#${channel.id}>!\nID: \`${gw.id}\``,
      );
    } catch (err) {
      console.error('[giveaway/start]', err);
      await interaction.editReply('Konnte die Nachricht nicht posten.');
    }
    return;
  }

  if (sub === 'reroll' || sub === 'end') {
    const id = interaction.options.getString('id', true);
    const gw = await getGiveaway(id);
    if (!gw || gw.guildId !== interaction.guild.id) {
      await interaction.reply({
        content: 'Kein Giveaway mit dieser ID auf diesem Server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const entries = await listEntries(id);
    const winners = pickWinners(entries, gw.winnersCount);
    await finalizeGiveaway(id, winners);

    const channel = (await interaction.guild.channels
      .fetch(gw.channelId)
      .catch(() => null)) as TextChannel | null;
    if (channel && gw.messageId) {
      const embed = buildGiveawayEmbed(
        gw.prize,
        new Date(gw.endsAt),
        gw.winnersCount,
        entries.length,
        true,
        winners,
      );
      const msg = await channel.messages.fetch(gw.messageId).catch(() => null);
      if (msg) await msg.edit({ embeds: [embed], components: [] }).catch(() => {});

      const winnersTxt = winners.length
        ? winners.map((u) => `<@${u}>`).join(' · ')
        : '_Keine Teilnehmer_';
      await channel
        .send({
          content:
            sub === 'reroll'
              ? `🎲 **Reroll**: ${winnersTxt} hat **${gw.prize}** gewonnen!`
              : `🎉 **${gw.prize}** ging an: ${winnersTxt}`,
        })
        .catch(() => {});
    }

    await interaction.editReply(
      `${sub === 'reroll' ? 'Reroll' : 'Beendet'} — ${winners.length} Gewinner.`,
    );
    return;
  }
}

const command: SlashCommand = { data, execute };
export default command;
