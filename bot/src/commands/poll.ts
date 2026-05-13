import {
  MessageFlags,
  PermissionFlagsBits,
  PollLayoutType,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';

const data = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Eine Umfrage starten (native Discord-Poll).')
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
  .setDMPermission(false)
  .addStringOption((o) =>
    o
      .setName('question')
      .setDescription('Was soll abgefragt werden? (max 300 Zeichen)')
      .setRequired(true)
      .setMaxLength(300),
  )
  .addStringOption((o) =>
    o
      .setName('options')
      .setDescription('Antworten, durch | getrennt (z. B. Ja|Nein|Vielleicht). Max 10.')
      .setRequired(true)
      .setMaxLength(1000),
  )
  .addIntegerOption((o) =>
    o
      .setName('hours')
      .setDescription('Wie viele Stunden soll die Umfrage laufen? (1-768, default 24)')
      .setMinValue(1)
      .setMaxValue(768),
  )
  .addBooleanOption((o) =>
    o
      .setName('multiselect')
      .setDescription('Mehrere Antworten erlauben? (default false)'),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'Nur in Servern verwendbar.', flags: MessageFlags.Ephemeral });
    return;
  }

  const question = interaction.options.getString('question', true).trim();
  const optionsRaw = interaction.options.getString('options', true);
  const hours = interaction.options.getInteger('hours') ?? 24;
  const multiselect = interaction.options.getBoolean('multiselect') ?? false;

  const options = optionsRaw
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 10);

  if (options.length < 2) {
    await interaction.reply({
      content: 'Brauche mindestens 2 Optionen. Trenn sie mit `|` — z. B. `Ja|Nein|Vielleicht`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Discord-Limits: Antwort max 55 Zeichen.
  const tooLong = options.find((o) => o.length > 55);
  if (tooLong) {
    await interaction.reply({
      content: `Option zu lang (max 55 Zeichen): "${tooLong}"`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await interaction.reply({
      poll: {
        question: { text: question },
        answers: options.map((text) => ({ text })),
        duration: hours,
        allowMultiselect: multiselect,
        layoutType: PollLayoutType.Default,
      },
    });
  } catch (err) {
    console.error('[poll]', err);
    await interaction
      .reply({
        content:
          'Konnte die Umfrage nicht starten. Bitte stell sicher dass mein Account Polls erstellen darf (Channel-Permission).',
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
  }
}

const command: SlashCommand = { data, execute };
export default command;
