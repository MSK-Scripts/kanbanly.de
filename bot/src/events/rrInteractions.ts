import {
  Events,
  MessageFlags,
  type ButtonInteraction,
  type Client,
  type GuildMember,
  type Interaction,
  type Role,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { parseCustomId } from '../lib/rrComponents.js';
import { getReactionRoleMessage, listReactionRoles } from '../db/reactionRoles.js';
import { getLogConfig } from '../db/guilds.js';
import { logRoleAction } from '../lib/rrLog.js';

async function applyToggle(
  interaction: ButtonInteraction,
  messageId: string,
  roleId: string,
): Promise<void> {
  if (!interaction.guild) return;
  const member = interaction.member as GuildMember | null;
  if (!member) return;

  const rrMsg = await getReactionRoleMessage(messageId);
  if (!rrMsg || rrMsg.guildId !== interaction.guild.id) {
    await interaction.reply({
      content: 'Diese Reaction-Roles-Nachricht ist abgelaufen.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const role = (await interaction.guild.roles.fetch(roleId).catch(() => null)) as
    | Role
    | null;
  if (!role) {
    await interaction.reply({
      content: 'Die Rolle existiert nicht mehr.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const botMember = interaction.guild.members.me;
  if (botMember && botMember.roles.highest.comparePositionTo(role.id) <= 0) {
    await interaction.reply({
      content: `⚠️ Ich kann <@&${role.id}> nicht vergeben — die Rolle liegt über meiner.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const has = member.roles.cache.has(roleId);
  try {
    if (has) {
      await member.roles.remove(roleId, 'Reaction-Roles-Button');
      await interaction.reply({
        content: `➖ <@&${role.id}> entfernt.`,
        flags: MessageFlags.Ephemeral,
      });
      logRoleAction(interaction.guild, member, role, 'remove', 'button').catch(() => {});
    } else {
      await member.roles.add(roleId, 'Reaction-Roles-Button');
      await interaction.reply({
        content: `➕ <@&${role.id}> hinzugefügt.`,
        flags: MessageFlags.Ephemeral,
      });
      logRoleAction(interaction.guild, member, role, 'add', 'button').catch(() => {});
    }
  } catch (err) {
    console.error('[rr-btn]', err);
    await interaction.reply({
      content: 'Konnte die Rolle nicht ändern.',
      flags: MessageFlags.Ephemeral,
    });
  }
  void getLogConfig;
}

async function applySelect(
  interaction: StringSelectMenuInteraction,
  messageId: string,
): Promise<void> {
  if (!interaction.guild) return;
  const member = interaction.member as GuildMember | null;
  if (!member) return;

  const rrMsg = await getReactionRoleMessage(messageId);
  if (!rrMsg || rrMsg.guildId !== interaction.guild.id) {
    await interaction.reply({
      content: 'Diese Reaction-Roles-Nachricht ist abgelaufen.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const all = await listReactionRoles(messageId);
  const allRoleIds = new Set(all.map((r) => r.roleId));
  const wanted = new Set(interaction.values);
  const botMember = interaction.guild.members.me;

  const toAdd: string[] = [];
  const toRemove: string[] = [];
  for (const roleId of allRoleIds) {
    const have = member.roles.cache.has(roleId);
    const want = wanted.has(roleId);
    if (want && !have) toAdd.push(roleId);
    else if (!want && have) toRemove.push(roleId);
  }

  const added: string[] = [];
  const removed: string[] = [];
  const skipped: string[] = [];

  for (const roleId of toAdd) {
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (!role) continue;
    if (botMember && botMember.roles.highest.comparePositionTo(role.id) <= 0) {
      skipped.push(role.name);
      continue;
    }
    try {
      await member.roles.add(roleId, 'Reaction-Roles-Select');
      added.push(`<@&${roleId}>`);
      logRoleAction(interaction.guild, member, role, 'add', 'select').catch(() => {});
    } catch {
      skipped.push(role.name);
    }
  }
  for (const roleId of toRemove) {
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (!role) continue;
    if (botMember && botMember.roles.highest.comparePositionTo(role.id) <= 0) {
      skipped.push(role.name);
      continue;
    }
    try {
      await member.roles.remove(roleId, 'Reaction-Roles-Select');
      removed.push(`<@&${roleId}>`);
      logRoleAction(interaction.guild, member, role, 'remove', 'select').catch(() => {});
    } catch {
      skipped.push(role.name);
    }
  }

  const parts: string[] = [];
  if (added.length) parts.push(`➕ ${added.join(' ')}`);
  if (removed.length) parts.push(`➖ ${removed.join(' ')}`);
  if (skipped.length) parts.push(`⚠️ Übersprungen: ${skipped.join(', ')}`);
  if (parts.length === 0) parts.push('Keine Änderung.');

  await interaction.reply({
    content: parts.join('\n'),
    flags: MessageFlags.Ephemeral,
  });
}

export function registerRrInteractions(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isButton()) {
        const parsed = parseCustomId(interaction.customId);
        if (!parsed || parsed.kind !== 'btn') return;
        await applyToggle(interaction, parsed.messageId, parsed.roleId);
        return;
      }
      if (interaction.isStringSelectMenu()) {
        const parsed = parseCustomId(interaction.customId);
        if (!parsed || parsed.kind !== 'sel') return;
        await applySelect(interaction, parsed.messageId);
        return;
      }
    } catch (err) {
      console.error('[rr-interaction]', err);
    }
  });
}
