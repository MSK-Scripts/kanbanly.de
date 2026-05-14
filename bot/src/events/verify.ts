import {
  Events,
  MessageFlags,
  type ButtonInteraction,
  type Client,
  type GuildMember,
  type Interaction,
} from 'discord.js';
import { getVerifyConfig } from '../db/verify.js';

const CUSTOM_ID = 'verify:btn';

export function buildVerifyButtonCustomId(): string {
  return CUSTOM_ID;
}

async function handleVerify(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return;
  const member = interaction.member as GuildMember | null;
  if (!member) return;

  const cfg = await getVerifyConfig(interaction.guild.id);
  if (!cfg || !cfg.enabled || !cfg.roleId) {
    await interaction.reply({
      content: 'Verifizierung ist aktuell deaktiviert.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  function render(template: string): string {
    return template
      .replaceAll('{user}', interaction.user.username)
      .replaceAll('{mention}', `<@${interaction.user.id}>`)
      .replaceAll('{server}', interaction.guild?.name ?? '');
  }

  if (member.roles.cache.has(cfg.roleId)) {
    await interaction.reply({
      content: render(cfg.replyAlready ?? '✓ Du bist bereits verifiziert.'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const role = await interaction.guild.roles.fetch(cfg.roleId).catch(() => null);
  if (!role) {
    await interaction.reply({
      content: 'Verifizierungs-Rolle existiert nicht mehr — bitte Admin kontaktieren.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const botMember = interaction.guild.members.me;
  if (botMember && botMember.roles.highest.comparePositionTo(role.id) <= 0) {
    await interaction.reply({
      content:
        '⚠️ Bot-Rolle liegt unter der Verifizierungs-Rolle — bitte Admin kontaktieren.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await member.roles.add(cfg.roleId, 'Verify-Button');
    await interaction.reply({
      content: render(cfg.replySuccess ?? '✓ Verifiziert — willkommen!'),
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    console.error('[verify] role.add:', err);
    await interaction.reply({
      content: 'Konnte die Rolle nicht vergeben. Bitte Admin kontaktieren.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

export function registerVerify(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== CUSTOM_ID) return;
    try {
      await handleVerify(interaction);
    } catch (err) {
      console.error('[verify] handler:', err);
    }
  });
}
