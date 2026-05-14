import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import { ensureGuild } from '../db/guilds.js';
import { getDb } from '../db.js';

const data = new SlashCommandBuilder()
  .setName('guess')
  .setDescription('Zahlen-Raten — Bot wählt eine Zahl, du rätst.')
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName('start')
      .setDescription('Neues Spiel starten.')
      .addIntegerOption((o) =>
        o.setName('min').setDescription('Untere Grenze (Standard: 1)').setMinValue(1),
      )
      .addIntegerOption((o) =>
        o
          .setName('max')
          .setDescription('Obere Grenze (Standard: 1000)')
          .setMaxValue(1_000_000),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('try')
      .setDescription('Eine Zahl raten.')
      .addIntegerOption((o) =>
        o.setName('number').setDescription('Deine Zahl').setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s.setName('stop').setDescription('Aktuelles Spiel beenden.'),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild || !interaction.channelId) {
    await interaction.reply({
      content: 'Nur in Server-Channels.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await ensureGuild(interaction.guild);
  const sub = interaction.options.getSubcommand(true);
  const db = getDb();
  const guildId = interaction.guild.id;
  const channelId = interaction.channelId;

  if (sub === 'start') {
    const minVal = Math.max(1, interaction.options.getInteger('min') ?? 1);
    const maxVal = Math.max(minVal + 1, interaction.options.getInteger('max') ?? 1000);
    const target = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
    await db.from('bot_guess_games').upsert({
      guild_id: guildId,
      channel_id: channelId,
      target,
      min_value: minVal,
      max_value: maxVal,
      attempts: 0,
      started_by_user_id: interaction.user.id,
    });
    await interaction.reply({
      content: `Neues Spiel — ich denke an eine Zahl zwischen **${minVal}** und **${maxVal}**.\nRate mit \`/guess try number:<zahl>\`.`,
    });
    return;
  }

  if (sub === 'stop') {
    const { data: existing } = await db
      .from('bot_guess_games')
      .select('target')
      .eq('guild_id', guildId)
      .eq('channel_id', channelId)
      .maybeSingle();
    if (!existing) {
      await interaction.reply({
        content: 'Kein Spiel aktiv.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await db
      .from('bot_guess_games')
      .delete()
      .eq('guild_id', guildId)
      .eq('channel_id', channelId);
    await interaction.reply(
      `Spiel beendet. Die Zahl war **${existing.target}**.`,
    );
    return;
  }

  if (sub === 'try') {
    const guess = interaction.options.getInteger('number', true);
    const { data: game } = await db
      .from('bot_guess_games')
      .select('target, attempts, min_value, max_value, started_by_user_id')
      .eq('guild_id', guildId)
      .eq('channel_id', channelId)
      .maybeSingle();
    if (!game) {
      await interaction.reply({
        content: 'Kein Spiel aktiv. Starte mit `/guess start`.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const target = game.target as number;
    const attempts = ((game.attempts as number) ?? 0) + 1;

    if (guess === target) {
      await db
        .from('bot_guess_games')
        .delete()
        .eq('guild_id', guildId)
        .eq('channel_id', channelId);
      await interaction.reply(
        `🎯 **${guess}** war richtig, <@${interaction.user.id}>! Geraten nach **${attempts}** Versuchen.`,
      );
      return;
    }

    await db
      .from('bot_guess_games')
      .update({ attempts })
      .eq('guild_id', guildId)
      .eq('channel_id', channelId);

    const hint = guess < target ? '↑ höher' : '↓ niedriger';
    await interaction.reply(
      `${guess} ist **falsch** — versuch's ${hint}. (Versuch ${attempts})`,
    );
  }
}

const command: SlashCommand = { data, execute };
export default command;
