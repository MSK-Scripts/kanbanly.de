import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';

// Discord Timeout-Limit: 28 Tage (= 2_419_200 Sekunden).
const MAX_TIMEOUT_SECONDS = 28 * 24 * 60 * 60;

function parseDuration(input: string): number | null {
  const match = input.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = match[2].toLowerCase();
  const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  const secs = n * mult;
  if (secs > MAX_TIMEOUT_SECONDS) return null;
  return secs;
}

const data = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('User für eine bestimmte Zeit muten (Discord-Timeout).')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addUserOption((o) =>
    o.setName('user').setDescription('Wer wird getimeoutet?').setRequired(true),
  )
  .addStringOption((o) =>
    o
      .setName('duration')
      .setDescription('Dauer (z.B. 30m, 2h, 1d — max 28d).')
      .setRequired(true),
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
  const durationStr = interaction.options.getString('duration', true);
  const reason = interaction.options.getString('reason') ?? 'Kein Grund angegeben.';

  const seconds = parseDuration(durationStr);
  if (!seconds) {
    await interaction.editReply(
      'Ungültige Dauer. Beispiele: `30m`, `2h`, `1d`. Maximum: `28d`.',
    );
    return;
  }

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) {
    await interaction.editReply('User ist nicht auf dem Server.');
    return;
  }
  if (!member.moderatable) {
    await interaction.editReply(
      'Kann ich nicht timeouten — meine Rolle muss höher sein als die des Users.',
    );
    return;
  }

  try {
    await member.timeout(seconds * 1000, `${interaction.user.username}: ${reason}`);
    await interaction.editReply(
      `🔇 <@${target.id}> für **${durationStr}** getimeoutet.\n**Grund:** ${reason}`,
    );
  } catch (err) {
    console.error('[timeout]', err);
    await interaction.editReply('Konnte den Timeout nicht setzen.');
  }
}

const command: SlashCommand = { data, execute };
export default command;
