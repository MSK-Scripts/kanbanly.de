import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';

const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Einen User vom Server kicken.')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .setDMPermission(false)
  .addUserOption((o) =>
    o.setName('user').setDescription('Wer wird gekickt?').setRequired(true),
  )
  .addStringOption((o) =>
    o.setName('reason').setDescription('Grund (optional).').setMaxLength(500),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'Nur in Servern verwendbar.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') ?? 'Kein Grund angegeben.';

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) {
    await interaction.editReply('User ist nicht auf dem Server.');
    return;
  }
  if (!member.kickable) {
    await interaction.editReply(
      'Kann ich nicht kicken — meine Rolle muss höher sein als die des Users.',
    );
    return;
  }

  // DM vor dem Kick (best-effort).
  target
    .send({
      content: `Du wurdest von **${interaction.guild.name}** gekickt.\n**Grund:** ${reason}`,
    })
    .catch(() => {});

  try {
    await member.kick(`${interaction.user.username}: ${reason}`);
    await interaction.editReply(`👢 <@${target.id}> gekickt. Grund: ${reason}`);
  } catch (err) {
    console.error('[kick]', err);
    await interaction.editReply('Konnte den Kick nicht ausführen.');
  }
}

const command: SlashCommand = { data, execute };
export default command;
