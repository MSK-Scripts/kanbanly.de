import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import { ensureGuild } from '../db/guilds.js';
import { invalidatePrefixCache } from '../events/customCommands.js';
import { getDb } from '../db.js';
import {
  TRIGGER_RE,
  deleteCustomCommand,
  getCustomCommand,
  listCustomCommands,
  upsertCustomCommand,
} from '../db/customCommands.js';

const data = new SlashCommandBuilder()
  .setName('customcmd')
  .setDescription('Eigene Prefix-Commands für diesen Server verwalten.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName('add')
      .setDescription('Neuen Custom-Command anlegen / ändern.')
      .addStringOption((o) =>
        o
          .setName('trigger')
          .setDescription('Trigger ohne Prefix (a-z 0-9 _ -, max 32 Zeichen).')
          .setRequired(true)
          .setMaxLength(32),
      )
      .addStringOption((o) =>
        o
          .setName('response')
          .setDescription('Was soll der Bot antworten? (max 2000 Zeichen)')
          .setRequired(true)
          .setMaxLength(2000),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('remove')
      .setDescription('Custom-Command löschen.')
      .addStringOption((o) =>
        o.setName('trigger').setDescription('Trigger ohne Prefix.').setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s.setName('list').setDescription('Alle Custom-Commands dieses Servers.'),
  )
  .addSubcommand((s) =>
    s
      .setName('prefix')
      .setDescription('Prefix für Custom-Commands ändern (default: !).')
      .addStringOption((o) =>
        o
          .setName('value')
          .setDescription('Neuer Prefix (1-3 Zeichen, z. B. ! oder ? oder >>).')
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(3),
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

  if (sub === 'add') {
    const trigger = interaction.options.getString('trigger', true).toLowerCase();
    const response = interaction.options.getString('response', true);
    if (!TRIGGER_RE.test(trigger)) {
      await interaction.editReply('Trigger: 1-32 Zeichen aus a-z, 0-9, _ und -.');
      return;
    }
    const existing = await getCustomCommand(interaction.guild.id, trigger);
    await upsertCustomCommand({
      guildId: interaction.guild.id,
      trigger,
      response,
      createdBy: interaction.user.id,
    });
    await interaction.editReply(
      existing
        ? `✏️ Custom-Command \`${trigger}\` aktualisiert.`
        : `✅ Custom-Command \`${trigger}\` angelegt.`,
    );
    return;
  }

  if (sub === 'remove') {
    const trigger = interaction.options.getString('trigger', true).toLowerCase();
    const ok = await deleteCustomCommand(interaction.guild.id, trigger);
    await interaction.editReply(
      ok ? `🗑️ \`${trigger}\` gelöscht.` : `Kein Custom-Command \`${trigger}\` gefunden.`,
    );
    return;
  }

  if (sub === 'list') {
    const rows = await listCustomCommands(interaction.guild.id);
    if (rows.length === 0) {
      await interaction.editReply('Keine Custom-Commands. Leg welche mit `/customcmd add` an.');
      return;
    }
    const body = rows.map((r) => `\`${r.trigger}\` · ${r.uses}× genutzt`).join('\n');
    const embed = new EmbedBuilder()
      .setTitle(`Custom-Commands · ${interaction.guild.name}`)
      .setDescription(body.slice(0, 4000))
      .setColor(0x6366f1)
      .setFooter({ text: `${rows.length} Einträge` });
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === 'prefix') {
    const value = interaction.options.getString('value', true).trim();
    if (value.length < 1 || value.length > 3) {
      await interaction.editReply('Prefix muss 1-3 Zeichen lang sein.');
      return;
    }
    const db = getDb();
    const { error } = await db
      .from('bot_guilds')
      .update({ command_prefix: value, updated_at: new Date().toISOString() })
      .eq('guild_id', interaction.guild.id);
    if (error) {
      await interaction.editReply(`Fehler: ${error.message}`);
      return;
    }
    invalidatePrefixCache(interaction.guild.id);
    await interaction.editReply(`✅ Prefix ist jetzt \`${value}\`. Beispiel: \`${value}rules\``);
    return;
  }
}

const command: SlashCommand = { data, execute };
export default command;
