import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import { ensureGuild } from '../db/guilds.js';
import {
  addReactionRole,
  createReactionRoleMessage,
  getReactionRoleMessage,
  listReactionRoleMessages,
  listReactionRoles,
  parseEmoji,
  removeReactionRole,
} from '../db/reactionRoles.js';

const data = new SlashCommandBuilder()
  .setName('reactionroles')
  .setDescription('Self-Service-Rollen über Reaktionen.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName('new')
      .setDescription('Neue Reaction-Roles-Nachricht posten.')
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Channel, in dem die Nachricht erscheinen soll.')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true),
      )
      .addStringOption((o) =>
        o.setName('title').setDescription('Überschrift im Embed.').setMaxLength(200).setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName('description')
          .setDescription('Einleitungstext über der Rollenliste.')
          .setMaxLength(1500),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('add')
      .setDescription('Emoji ↔ Rolle einer bestehenden Reaction-Roles-Nachricht hinzufügen.')
      .addStringOption((o) =>
        o.setName('message_id').setDescription('ID der RR-Nachricht.').setRequired(true),
      )
      .addStringOption((o) =>
        o.setName('emoji').setDescription('Unicode-Emoji oder :custom: aus diesem Server.').setRequired(true),
      )
      .addRoleOption((o) =>
        o.setName('role').setDescription('Rolle, die vergeben werden soll.').setRequired(true),
      )
      .addStringOption((o) =>
        o.setName('label').setDescription('Anzeigetext neben dem Emoji.').setMaxLength(100),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('remove')
      .setDescription('Emoji-Rolle wieder entfernen.')
      .addStringOption((o) =>
        o.setName('message_id').setDescription('ID der RR-Nachricht.').setRequired(true),
      )
      .addStringOption((o) =>
        o.setName('emoji').setDescription('Welches Emoji entfernen?').setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s.setName('list').setDescription('Alle Reaction-Roles-Nachrichten dieses Servers anzeigen.'),
  );

function buildEmbed(
  title: string | null,
  description: string | null,
  rows: { emojiDisplay: string; roleId: string; label: string | null }[],
): EmbedBuilder {
  const body = rows.length
    ? rows.map((r) => `${r.emojiDisplay} → <@&${r.roleId}>${r.label ? ` · ${r.label}` : ''}`).join('\n')
    : '_Noch keine Rollen — füge welche mit `/reactionroles add` hinzu._';
  const desc = [description, body].filter(Boolean).join('\n\n');
  return new EmbedBuilder()
    .setTitle(title ?? 'Wähle deine Rollen')
    .setDescription(desc)
    .setColor(0x5865f2);
}

async function refreshMessage(
  interaction: ChatInputCommandInteraction,
  messageId: string,
): Promise<string | null> {
  const rrMsg = await getReactionRoleMessage(messageId);
  if (!rrMsg) return 'Keine Reaction-Roles-Nachricht mit dieser ID gefunden.';
  if (!interaction.guild || rrMsg.guildId !== interaction.guild.id) return 'Falscher Server.';
  const channel = await interaction.guild.channels.fetch(rrMsg.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return 'Channel der Nachricht existiert nicht mehr.';
  const message = await (channel as TextChannel).messages.fetch(messageId).catch(() => null);
  if (!message) return 'Nachricht wurde gelöscht.';
  const rows = await listReactionRoles(messageId);
  const embed = buildEmbed(rrMsg.title, rrMsg.description, rows);
  await message.edit({ embeds: [embed] });
  return null;
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'Nur in Servern verwendbar.', flags: MessageFlags.Ephemeral });
    return;
  }
  await ensureGuild(interaction.guild);
  const sub = interaction.options.getSubcommand(true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (sub === 'new') {
    const channel = interaction.options.getChannel('channel', true);
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description');
    const target = await interaction.guild.channels.fetch(channel.id).catch(() => null);
    if (!target || !target.isTextBased()) {
      await interaction.editReply('Channel konnte nicht geladen werden.');
      return;
    }
    const embed = buildEmbed(title, description, []);
    const sent = await (target as TextChannel).send({ embeds: [embed] });
    await createReactionRoleMessage({
      messageId: sent.id,
      guildId: interaction.guild.id,
      channelId: target.id,
      title,
      description,
    });
    await interaction.editReply(
      `✅ Nachricht gepostet in <#${target.id}>.\n**Message-ID:** \`${sent.id}\`\nFüge Rollen hinzu mit \`/reactionroles add message_id:${sent.id} emoji:🎮 role:@…\``,
    );
    return;
  }

  if (sub === 'add') {
    const messageId = interaction.options.getString('message_id', true);
    const emojiRaw = interaction.options.getString('emoji', true);
    const role = interaction.options.getRole('role', true);
    const label = interaction.options.getString('label');

    const parsed = parseEmoji(emojiRaw);
    if (!parsed) {
      await interaction.editReply('Konnte das Emoji nicht parsen.');
      return;
    }
    const rrMsg = await getReactionRoleMessage(messageId);
    if (!rrMsg || rrMsg.guildId !== interaction.guild.id) {
      await interaction.editReply('Keine RR-Nachricht mit dieser ID auf diesem Server.');
      return;
    }
    const botMember = interaction.guild.members.me;
    if (botMember && 'comparePositionTo' in botMember.roles.highest) {
      if (botMember.roles.highest.comparePositionTo(role.id) <= 0) {
        await interaction.editReply(
          `⚠️ Die Rolle <@&${role.id}> liegt über meiner höchsten Rolle — ich kann sie nicht vergeben. Bitte die Bot-Rolle im Server höher schieben.`,
        );
        return;
      }
    }

    const channel = await interaction.guild.channels.fetch(rrMsg.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      await interaction.editReply('Channel der Nachricht existiert nicht mehr.');
      return;
    }
    const message = await (channel as TextChannel).messages.fetch(messageId).catch(() => null);
    if (!message) {
      await interaction.editReply('Nachricht wurde gelöscht.');
      return;
    }

    try {
      await message.react(parsed.kind === 'custom' ? parsed.id : parsed.key);
    } catch (err) {
      console.error('[rr] react fehlgeschlagen:', err);
      await interaction.editReply(
        'Reaction konnte nicht hinzugefügt werden — ungültiges Emoji oder fehlende Berechtigung "Add Reactions".',
      );
      return;
    }

    await addReactionRole({
      messageId,
      emojiKey: parsed.key,
      emojiDisplay: parsed.display,
      roleId: role.id,
      label,
    });
    const err = await refreshMessage(interaction, messageId);
    if (err) {
      await interaction.editReply(`Gespeichert, aber: ${err}`);
      return;
    }
    await interaction.editReply(`✅ ${parsed.display} → <@&${role.id}> hinzugefügt.`);
    return;
  }

  if (sub === 'remove') {
    const messageId = interaction.options.getString('message_id', true);
    const emojiRaw = interaction.options.getString('emoji', true);
    const parsed = parseEmoji(emojiRaw);
    if (!parsed) {
      await interaction.editReply('Konnte das Emoji nicht parsen.');
      return;
    }
    const rrMsg = await getReactionRoleMessage(messageId);
    if (!rrMsg || rrMsg.guildId !== interaction.guild.id) {
      await interaction.editReply('Keine RR-Nachricht mit dieser ID auf diesem Server.');
      return;
    }
    await removeReactionRole(messageId, parsed.key);

    const channel = await interaction.guild.channels.fetch(rrMsg.channelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      const message = await (channel as TextChannel).messages.fetch(messageId).catch(() => null);
      if (message) {
        const reactionId =
          parsed.kind === 'custom' ? parsed.id : parsed.key;
        const reaction = message.reactions.cache.find((r) =>
          parsed.kind === 'custom'
            ? r.emoji.id === reactionId
            : r.emoji.name === reactionId,
        );
        if (reaction) await reaction.remove().catch(() => {});
      }
    }
    const refreshErr = await refreshMessage(interaction, messageId);
    if (refreshErr) {
      await interaction.editReply(`Gelöscht, aber: ${refreshErr}`);
      return;
    }
    await interaction.editReply(`🗑️ ${parsed.display} entfernt.`);
    return;
  }

  if (sub === 'list') {
    const msgs = await listReactionRoleMessages(interaction.guild.id);
    if (!msgs.length) {
      await interaction.editReply('Keine Reaction-Roles-Nachrichten auf diesem Server.');
      return;
    }
    const lines = msgs.map(
      (m) => `• \`${m.messageId}\` — <#${m.channelId}> · ${m.title ?? '_(ohne Titel)_'}`,
    );
    await interaction.editReply(lines.join('\n'));
    return;
  }
}

const command: SlashCommand = { data, execute };
export default command;
