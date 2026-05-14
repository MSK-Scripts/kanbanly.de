import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';

const SUPPORTED = [
  'linkvertise.com',
  'link-to.net',
  'link-hub.net',
  'direct-link.net',
  'boost.ink',
  'sub2unlock.com',
  'sub2unlock.net',
  'mboost.me',
  'rekonise.com',
  'social-unlock.com',
  'lootlinks.co',
  'loot-link.com',
  'lootdest.com',
  'lootdest.org',
  'adfoc.us',
  'adf.ly',
  'shorte.st',
  'ouo.io',
  'bit.ly',
  'tinyurl.com',
];

type BypassResponse = {
  status?: string;
  destination?: string;
  result?: string;
  url?: string;
  message?: string;
  error?: string;
};

const data = new SlashCommandBuilder()
  .setName('bypass')
  .setDescription('Umgeht Link-Shortener wie Linkvertise, Boost.ink, Adfly …')
  .setDMPermission(true)
  .addStringOption((o) =>
    o
      .setName('url')
      .setDescription('Der Shortener-Link, den du auflösen willst')
      .setRequired(true),
  )
  .addBooleanOption((o) =>
    o
      .setName('public')
      .setDescription('Antwort öffentlich posten (Standard: nur für dich sichtbar)'),
  );

function isValidUrl(input: string): URL | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

async function callBypassApi(url: string): Promise<{ ok: true; destination: string } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(
      `https://api.bypass.vip/bypass?url=${encodeURIComponent(url)}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'kanbanly-bot/1.0 (+https://kanbanly.de)' },
      },
    );
    if (!res.ok) {
      return { ok: false, error: `API antwortete mit HTTP ${res.status}` };
    }
    const json = (await res.json()) as BypassResponse;
    const dest = json.destination ?? json.result ?? json.url;
    if (json.status && json.status.toLowerCase() !== 'success' && !dest) {
      return { ok: false, error: json.message ?? json.error ?? 'Bypass fehlgeschlagen' };
    }
    if (!dest) {
      return { ok: false, error: 'Keine Ziel-URL im Response gefunden' };
    }
    return { ok: true, destination: dest };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { ok: false, error: 'Timeout (15s) — Service nicht erreichbar' };
    }
    return { ok: false, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const raw = interaction.options.getString('url', true);
  const makePublic = interaction.options.getBoolean('public') ?? false;
  const flags = makePublic ? undefined : MessageFlags.Ephemeral;

  const parsed = isValidUrl(raw);
  if (!parsed) {
    await interaction.reply({
      content: 'Das sieht nicht nach einer gültigen URL aus (muss mit `http://` oder `https://` beginnen).',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply(flags ? { flags } : undefined);

  const result = await callBypassApi(parsed.toString());

  if (!result.ok) {
    const hostHint = SUPPORTED.some((d) => parsed.hostname.endsWith(d))
      ? ''
      : `\n\n*Hinweis: \`${parsed.hostname}\` ist evtl. nicht unterstützt. Bekannte Dienste: ${SUPPORTED.slice(0, 6).join(', ')}, …*`;
    await interaction.editReply({
      content: `❌ Bypass fehlgeschlagen: ${result.error}${hostHint}`,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle('🔓 Link aufgelöst')
    .addFields(
      { name: 'Original', value: `\`\`\`${parsed.toString().slice(0, 1000)}\`\`\`` },
      { name: 'Ziel', value: result.destination.slice(0, 1024) },
    )
    .setFooter({ text: 'via api.bypass.vip' });

  await interaction.editReply({ embeds: [embed] });
}

const command: SlashCommand = { data, execute };
export default command;
