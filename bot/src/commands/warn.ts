import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import { ensureGuild } from '../db/guilds.js';
import {
  addWarning,
  clearWarnings,
  listWarnings,
} from '../db/warnings.js';

const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('User verwarnen oder Warnhistorie sehen.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName('add')
      .setDescription('Einen User verwarnen.')
      .addUserOption((o) =>
        o.setName('user').setDescription('Wer wird verwarnt?').setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName('reason')
          .setDescription('Grund (optional, max 500 Zeichen).')
          .setMaxLength(500),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('list')
      .setDescription('Warnungen eines Users anzeigen.')
      .addUserOption((o) =>
        o.setName('user').setDescription('Wessen Historie?').setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('clear')
      .setDescription('Alle Warnungen eines Users löschen.')
      .addUserOption((o) =>
        o.setName('user').setDescription('Wessen Warnungen löschen?').setRequired(true),
      ),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'Nur in Servern verwendbar.', flags: MessageFlags.Ephemeral });
    return;
  }
  await ensureGuild(interaction.guild);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const sub = interaction.options.getSubcommand(true);
  const target = interaction.options.getUser('user', true);

  if (sub === 'add') {
    const reason = interaction.options.getString('reason');
    const warning = await addWarning({
      guildId: interaction.guild.id,
      userId: target.id,
      moderatorId: interaction.user.id,
      reason,
    });
    const total = (await listWarnings(interaction.guild.id, target.id)).length;

    // DM dem User Bescheid geben (best-effort, manche haben DMs zu).
    target
      .send({
        content: `Du wurdest auf **${interaction.guild.name}** verwarnt.${
          reason ? `\n**Grund:** ${reason}` : ''
        }\n_Du hast jetzt ${total} Warnung${total === 1 ? '' : 'en'}._`,
      })
      .catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle('✅ Verwarnt')
      .setDescription(`<@${target.id}> wurde verwarnt.`)
      .addFields(
        { name: 'Grund', value: reason ?? '_(kein Grund angegeben)_' },
        { name: 'Warnungen gesamt', value: String(total), inline: true },
        { name: 'ID', value: warning.id, inline: true },
      )
      .setColor(0xf59e0b);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === 'list') {
    const rows = await listWarnings(interaction.guild.id, target.id);
    if (rows.length === 0) {
      await interaction.editReply(`<@${target.id}> hat keine Warnungen.`);
      return;
    }
    const body = rows
      .map((w, i) => {
        const date = new Date(w.createdAt).toLocaleDateString('de-DE');
        return `**${i + 1}.** ${date} · von <@${w.moderatorId}>\n${
          w.reason ? `> ${w.reason}` : '_(kein Grund)_'
        }`;
      })
      .join('\n\n');
    const embed = new EmbedBuilder()
      .setTitle(`Warnungen für ${target.username}`)
      .setDescription(body.slice(0, 4000))
      .setColor(0xf59e0b)
      .setFooter({ text: `${rows.length} Einträge` });
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === 'clear') {
    const removed = await clearWarnings(interaction.guild.id, target.id);
    await interaction.editReply(
      `🗑️ ${removed} Warnung${removed === 1 ? '' : 'en'} für <@${target.id}> gelöscht.`,
    );
    return;
  }
}

const command: SlashCommand = { data, execute };
export default command;
