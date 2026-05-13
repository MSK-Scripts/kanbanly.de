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
  TAG_NAME_RE,
  createTag,
  deleteTag,
  getTag,
  incrementTagUses,
  listTags,
  updateTag,
} from '../db/tags.js';

const data = new SlashCommandBuilder()
  .setName('tag')
  .setDescription('Schnelle FAQ-Antworten posten.')
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName('show')
      .setDescription('Tag posten.')
      .addStringOption((o) =>
        o.setName('name').setDescription('Tag-Name.').setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('list')
      .setDescription('Alle Tags dieses Servers auflisten.'),
  )
  .addSubcommand((s) =>
    s
      .setName('add')
      .setDescription('Neuen Tag anlegen (ManageMessages).')
      .addStringOption((o) =>
        o
          .setName('name')
          .setDescription('Tag-Name (a-z, 0-9, _, -, max 32 Zeichen).')
          .setRequired(true)
          .setMaxLength(32),
      )
      .addStringOption((o) =>
        o
          .setName('content')
          .setDescription('Antwort-Text (max 2000 Zeichen).')
          .setRequired(true)
          .setMaxLength(2000),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('edit')
      .setDescription('Bestehenden Tag ändern (ManageMessages).')
      .addStringOption((o) =>
        o.setName('name').setDescription('Tag-Name.').setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName('content')
          .setDescription('Neuer Antwort-Text.')
          .setRequired(true)
          .setMaxLength(2000),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('remove')
      .setDescription('Tag löschen (ManageMessages).')
      .addStringOption((o) =>
        o.setName('name').setDescription('Tag-Name.').setRequired(true),
      ),
  );

function canManage(interaction: ChatInputCommandInteraction): boolean {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ??
    false
  );
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'Nur in Servern verwendbar.', flags: MessageFlags.Ephemeral });
    return;
  }
  await ensureGuild(interaction.guild);
  const sub = interaction.options.getSubcommand(true);

  // ─── /tag show ────────────────────────────────────────────────
  if (sub === 'show') {
    const rawName = interaction.options.getString('name', true).toLowerCase();
    if (!TAG_NAME_RE.test(rawName)) {
      await interaction.reply({
        content: 'Tag-Name darf nur a-z, 0-9, _ und - enthalten.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const tag = await getTag(interaction.guild.id, rawName);
    if (!tag) {
      await interaction.reply({
        content: `Kein Tag \`${rawName}\` auf diesem Server.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    incrementTagUses(interaction.guild.id, rawName).catch(() => {});
    await interaction.reply({ content: tag.content });
    return;
  }

  // ─── /tag list ────────────────────────────────────────────────
  if (sub === 'list') {
    const tags = await listTags(interaction.guild.id);
    if (tags.length === 0) {
      await interaction.reply({
        content: 'Noch keine Tags. Leg welche mit `/tag add` an.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const body = tags
      .map((t) => `\`${t.name}\` · ${t.uses}× genutzt`)
      .join('\n');
    const embed = new EmbedBuilder()
      .setTitle(`Tags · ${interaction.guild.name}`)
      .setDescription(body.slice(0, 4000))
      .setColor(0x6366f1)
      .setFooter({ text: `${tags.length} Einträge` });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  // ─── /tag add | edit | remove (ManageMessages) ─────────────────
  if (!canManage(interaction)) {
    await interaction.reply({
      content: '🔒 Nur User mit Berechtigung „Nachrichten verwalten" dürfen Tags ändern.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (sub === 'add') {
    const name = interaction.options.getString('name', true).toLowerCase();
    const content = interaction.options.getString('content', true);
    if (!TAG_NAME_RE.test(name)) {
      await interaction.editReply('Name: 1-32 Zeichen aus a-z, 0-9, _ und -.');
      return;
    }
    const existing = await getTag(interaction.guild.id, name);
    if (existing) {
      await interaction.editReply(`Tag \`${name}\` gibt's schon — \`/tag edit\` nutzen.`);
      return;
    }
    await createTag({
      guildId: interaction.guild.id,
      name,
      content,
      createdBy: interaction.user.id,
    });
    await interaction.editReply(`✅ Tag \`${name}\` angelegt.`);
    return;
  }

  if (sub === 'edit') {
    const name = interaction.options.getString('name', true).toLowerCase();
    const content = interaction.options.getString('content', true);
    const ok = await updateTag(interaction.guild.id, name, content);
    if (!ok) {
      await interaction.editReply(`Kein Tag \`${name}\` gefunden.`);
      return;
    }
    await interaction.editReply(`✏️ Tag \`${name}\` aktualisiert.`);
    return;
  }

  if (sub === 'remove') {
    const name = interaction.options.getString('name', true).toLowerCase();
    const ok = await deleteTag(interaction.guild.id, name);
    if (!ok) {
      await interaction.editReply(`Kein Tag \`${name}\` gefunden.`);
      return;
    }
    await interaction.editReply(`🗑️ Tag \`${name}\` gelöscht.`);
    return;
  }
}

const command: SlashCommand = { data, execute };
export default command;
