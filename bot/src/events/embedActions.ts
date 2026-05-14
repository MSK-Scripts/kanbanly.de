import {
  Events,
  MessageFlags,
  type ButtonInteraction,
  type Client,
  type GuildMember,
  type Interaction,
} from 'discord.js';

const PREFIX = 'ec:role:';

async function handleRoleToggle(
  interaction: ButtonInteraction,
  roleId: string,
): Promise<void> {
  if (!interaction.guild) return;
  const member = interaction.member as GuildMember | null;
  if (!member) return;

  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await interaction.reply({
      content: 'Diese Rolle existiert nicht mehr.',
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
      await member.roles.remove(roleId, 'Embed-Action-Button');
      await interaction.reply({
        content: `➖ <@&${role.id}> entfernt.`,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await member.roles.add(roleId, 'Embed-Action-Button');
      await interaction.reply({
        content: `➕ <@&${role.id}> hinzugefügt.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (err) {
    console.error('[embedAction] role-toggle:', err);
    await interaction.reply({
      content: 'Konnte die Rolle nicht ändern.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

export function registerEmbedActions(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith(PREFIX)) return;
    const roleId = interaction.customId.slice(PREFIX.length);
    if (!roleId) return;
    try {
      await handleRoleToggle(interaction, roleId);
    } catch (err) {
      console.error('[embedAction]', err);
    }
  });
}
