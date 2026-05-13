import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';

const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Einen User permanent vom Server bannen.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false)
  .addUserOption((o) =>
    o.setName('user').setDescription('Wer wird gebannt?').setRequired(true),
  )
  .addStringOption((o) =>
    o.setName('reason').setDescription('Grund (optional).').setMaxLength(500),
  )
  .addIntegerOption((o) =>
    o
      .setName('delete_days')
      .setDescription('Lösche Nachrichten der letzten N Tage (0-7).')
      .setMinValue(0)
      .setMaxValue(7),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'Nur in Servern verwendbar.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') ?? 'Kein Grund angegeben.';
  const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

  // Check ob User Member ist + bannable.
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (member && !member.bannable) {
    await interaction.editReply(
      'Kann ich nicht bannen — meine Rolle muss höher sein als die des Users.',
    );
    return;
  }

  // DM (nur wenn noch Member — gebannte User können keine DMs mehr empfangen vom Server-Bot).
  if (member) {
    target
      .send({
        content: `Du wurdest von **${interaction.guild.name}** gebannt.\n**Grund:** ${reason}`,
      })
      .catch(() => {});
  }

  try {
    await interaction.guild.members.ban(target.id, {
      reason: `${interaction.user.username}: ${reason}`,
      deleteMessageSeconds: deleteDays * 86400,
    });
    await interaction.editReply(
      `🔨 <@${target.id}> gebannt.\n**Grund:** ${reason}${
        deleteDays ? `\n_Nachrichten der letzten ${deleteDays} Tag${deleteDays === 1 ? '' : 'e'} gelöscht._` : ''
      }`,
    );
  } catch (err) {
    console.error('[ban]', err);
    await interaction.editReply('Konnte den Ban nicht ausführen.');
  }
}

const command: SlashCommand = { data, execute };
export default command;
