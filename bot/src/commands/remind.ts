import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import {
  createReminder,
  deleteReminder,
  listUserReminders,
} from '../db/reminders.js';

// Limit: 365 Tage in Sekunden.
const MAX_DURATION_SECONDS = 365 * 24 * 60 * 60;

function parseDuration(input: string): number | null {
  // Akzeptiert: 30s, 5m, 2h, 1d (auch kombiniert: "1d 2h 30m").
  const re = /(\d+)\s*([smhd])/gi;
  let total = 0;
  let matched = false;
  for (const m of input.matchAll(re)) {
    matched = true;
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    const unit = m[2].toLowerCase();
    const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    total += n * mult;
  }
  if (!matched || total <= 0 || total > MAX_DURATION_SECONDS) return null;
  return total;
}

function formatRel(dueAt: string): string {
  const ts = Math.floor(new Date(dueAt).getTime() / 1000);
  return `<t:${ts}:R>`;
}

const data = new SlashCommandBuilder()
  .setName('remind')
  .setDescription('Setz dir oder anderen eine Erinnerung.')
  .addSubcommand((s) =>
    s
      .setName('me')
      .setDescription('Erinnere mich nach einer Zeit.')
      .addStringOption((o) =>
        o
          .setName('when')
          .setDescription('Wann? (z.B. 30m, 2h, 1d, 1d 2h 30m — max 365d)')
          .setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName('what')
          .setDescription('Woran erinnern? (max 500 Zeichen)')
          .setRequired(true)
          .setMaxLength(500),
      )
      .addBooleanOption((o) =>
        o
          .setName('dm')
          .setDescription('Per DM statt im Channel? (default false)'),
      ),
  )
  .addSubcommand((s) =>
    s.setName('list').setDescription('Deine offenen Erinnerungen.'),
  )
  .addSubcommand((s) =>
    s
      .setName('cancel')
      .setDescription('Erinnerung löschen.')
      .addStringOption((o) =>
        o.setName('id').setDescription('Reminder-ID aus /remind list.').setRequired(true),
      ),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand(true);

  if (sub === 'me') {
    const when = interaction.options.getString('when', true);
    const what = interaction.options.getString('what', true);
    const dmOnly = interaction.options.getBoolean('dm') ?? false;

    const seconds = parseDuration(when);
    if (!seconds) {
      await interaction.reply({
        content:
          'Konnte die Dauer nicht parsen. Beispiele: `30m`, `2h`, `1d`, `1d 2h 30m`. Max: 365 Tage.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const dueAt = new Date(Date.now() + seconds * 1000);
    const reminder = await createReminder({
      userId: interaction.user.id,
      guildId: interaction.guild?.id ?? null,
      channelId: dmOnly ? null : interaction.channelId ?? null,
      dueAt,
      content: what,
    });

    await interaction.reply({
      content: `⏰ Erinnere dich ${formatRel(reminder.dueAt)} ${
        dmOnly ? 'per DM' : 'hier im Channel'
      }.\n> ${what}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'list') {
    const rows = await listUserReminders(interaction.user.id, 10);
    if (rows.length === 0) {
      await interaction.reply({
        content: 'Keine offenen Erinnerungen.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const body = rows
      .map(
        (r) =>
          `\`${r.id.slice(0, 8)}\` · ${formatRel(r.dueAt)}\n> ${r.content.slice(0, 100)}`,
      )
      .join('\n\n');
    const embed = new EmbedBuilder()
      .setTitle('⏰ Deine Erinnerungen')
      .setDescription(body.slice(0, 4000))
      .setColor(0x6366f1)
      .setFooter({ text: 'Lösch mit /remind cancel id:<id>' });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'cancel') {
    const idPrefix = interaction.options.getString('id', true).toLowerCase();
    const rows = await listUserReminders(interaction.user.id, 25);
    const match = rows.find((r) => r.id.startsWith(idPrefix));
    if (!match) {
      await interaction.reply({
        content: 'Keine Erinnerung mit der ID gefunden.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const ok = await deleteReminder(match.id, interaction.user.id);
    await interaction.reply({
      content: ok ? '🗑️ Erinnerung gelöscht.' : 'Konnte nicht löschen.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
}

const command: SlashCommand = { data, execute };
export default command;
