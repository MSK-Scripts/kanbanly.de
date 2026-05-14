import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import { ensureGuild } from '../db/guilds.js';
import { removeBirthday, setBirthday } from '../db/birthdays.js';

const data = new SlashCommandBuilder()
  .setName('birthday')
  .setDescription('Trage deinen Geburtstag ein.')
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName('set')
      .setDescription('Trage deinen Geburtstag ein.')
      .addIntegerOption((o) =>
        o.setName('day').setDescription('Tag (1-31)').setMinValue(1).setMaxValue(31).setRequired(true),
      )
      .addIntegerOption((o) =>
        o
          .setName('month')
          .setDescription('Monat (1-12)')
          .setMinValue(1)
          .setMaxValue(12)
          .setRequired(true),
      )
      .addIntegerOption((o) =>
        o
          .setName('year')
          .setDescription('Jahr (optional, für Alter)')
          .setMinValue(1900)
          .setMaxValue(new Date().getFullYear()),
      ),
  )
  .addSubcommand((s) =>
    s.setName('remove').setDescription('Entferne deinen Geburtstag.'),
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

  if (sub === 'set') {
    const day = interaction.options.getInteger('day', true);
    const month = interaction.options.getInteger('month', true);
    const year = interaction.options.getInteger('year');
    // Plausibilität: 31. Februar fangen.
    const test = new Date(year ?? 2000, month - 1, day);
    if (test.getMonth() + 1 !== month || test.getDate() !== day) {
      await interaction.reply({
        content: 'Ungültiges Datum.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await setBirthday(interaction.guild.id, interaction.user.id, month, day, year);
    await interaction.reply({
      content: `✓ Geburtstag gespeichert: **${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year ?? '????'}**`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'remove') {
    await removeBirthday(interaction.guild.id, interaction.user.id);
    await interaction.reply({
      content: '✓ Geburtstag entfernt.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

const command: SlashCommand = { data, execute };
export default command;
