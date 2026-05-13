import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';

const data = new SlashCommandBuilder()
  .setName('roleall')
  .setDescription('Vergibt eine Rolle an alle (menschlichen) Mitglieder.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .setDMPermission(false)
  .addRoleOption((o) =>
    o.setName('role').setDescription('Welche Rolle?').setRequired(true),
  )
  .addBooleanOption((o) =>
    o
      .setName('include_bots')
      .setDescription('Auch an Bots vergeben? (Standard: nein)'),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'Nur in Servern verwendbar.', flags: MessageFlags.Ephemeral });
    return;
  }
  const role = interaction.options.getRole('role', true);
  const includeBots = interaction.options.getBoolean('include_bots') ?? false;

  const botMember = interaction.guild.members.me;
  if (!botMember) {
    await interaction.reply({ content: 'Bot ist nicht korrekt im Server.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (botMember.roles.highest.comparePositionTo(role.id) <= 0) {
    await interaction.reply({
      content: `Die Rolle <@&${role.id}> liegt über meiner Bot-Rolle. Schieb meine Rolle in der Hierarchie höher.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let members;
  try {
    members = await interaction.guild.members.fetch();
  } catch (err) {
    console.error('[roleall] fetch', err);
    await interaction.editReply('Konnte die Mitgliederliste nicht laden.');
    return;
  }

  const targets = members.filter((m) => {
    if (!includeBots && m.user.bot) return false;
    return !m.roles.cache.has(role.id);
  });

  if (targets.size === 0) {
    await interaction.editReply('Alle passenden Mitglieder haben die Rolle bereits.');
    return;
  }

  // Rate-Limit-freundlich: kleine Pause alle 5 Member.
  let success = 0;
  let failed = 0;
  let i = 0;
  await interaction.editReply(`⏳ Verteile <@&${role.id}> an **${targets.size}** Member…`);
  for (const m of targets.values()) {
    try {
      await m.roles.add(role.id, `Via /roleall durch ${interaction.user.tag}`);
      success += 1;
    } catch {
      failed += 1;
    }
    i += 1;
    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 750));
    if (i % 25 === 0) {
      await interaction.editReply(
        `⏳ ${i}/${targets.size} verarbeitet (${success} OK, ${failed} Fehler)…`,
      );
    }
  }

  await interaction.editReply(
    `✅ Fertig: <@&${role.id}> an **${success}** Member vergeben. ${
      failed ? `(${failed} Fehler — meist Permissions)` : ''
    }`,
  );
}

const command: SlashCommand = { data, execute };
export default command;
