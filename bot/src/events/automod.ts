import {
  Events,
  PermissionFlagsBits,
  type Client,
  type Message,
} from 'discord.js';
import { getAutoModConfig, type AutoModConfig } from '../db/automod.js';

// In-Memory-Cache, 30s TTL — vermeidet DB-Hit pro Message.
type CacheEntry = { value: AutoModConfig; expiresAt: number };
const cache = new Map<string, CacheEntry>();

async function configFor(guildId: string): Promise<AutoModConfig> {
  const cached = cache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await getAutoModConfig(guildId);
  cache.set(guildId, { value, expiresAt: Date.now() + 30_000 });
  return value;
}

export function invalidateAutoModCache(guildId: string): void {
  cache.delete(guildId);
}

// ─── Filter ───────────────────────────────────────────────────────

const URL_RE = /\bhttps?:\/\/([^\s/]+)/gi;

function urlsInMessage(content: string): string[] {
  const hosts: string[] = [];
  for (const m of content.matchAll(URL_RE)) {
    const host = m[1]?.toLowerCase();
    if (host) hosts.push(host);
  }
  return hosts;
}

function hostMatches(host: string, allowlist: string[]): boolean {
  return allowlist.some((allowed) => {
    const a = allowed.toLowerCase().replace(/^\*\./, '');
    return host === a || host.endsWith(`.${a}`);
  });
}

function capsPercent(text: string): number {
  const letters = text.replace(/[^A-Za-zÄÖÜäöüß]/g, '');
  if (letters.length === 0) return 0;
  const upper = letters.replace(/[^A-ZÄÖÜ]/g, '').length;
  return Math.round((upper / letters.length) * 100);
}

function countUserMentions(message: Message): number {
  // Discord parsed mentions in message.mentions; users + repliedUser separat.
  return message.mentions.users.size + (message.mentions.repliedUser ? 0 : 0);
}

function findBannedWord(content: string, banned: string[]): string | null {
  if (banned.length === 0) return null;
  const lower = content.toLowerCase();
  for (const word of banned) {
    const w = word.toLowerCase().trim();
    if (!w) continue;
    // Wort-Grenze auf ASCII; reicht für die meisten Use-Cases.
    const re = new RegExp(`(^|\\W)${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`, 'i');
    if (re.test(lower)) return word;
  }
  return null;
}

type Violation = { kind: 'link' | 'caps' | 'mentions' | 'banned-word'; detail: string };

function checkMessage(message: Message, cfg: AutoModConfig): Violation | null {
  const content = message.content;
  if (!content || content.length === 0) return null;

  // 1. Links
  if (cfg.blockLinks) {
    const hosts = urlsInMessage(content);
    for (const host of hosts) {
      if (!hostMatches(host, cfg.linkAllowlist)) {
        return { kind: 'link', detail: host };
      }
    }
  }

  // 2. Caps
  if (cfg.maxCapsPct !== null && content.length >= 10) {
    const pct = capsPercent(content);
    if (pct >= cfg.maxCapsPct) {
      return { kind: 'caps', detail: `${pct}%` };
    }
  }

  // 3. Mention-Spam
  if (cfg.maxMentions !== null) {
    const n = countUserMentions(message);
    if (n > cfg.maxMentions) {
      return { kind: 'mentions', detail: String(n) };
    }
  }

  // 4. Banned-Words
  const banned = findBannedWord(content, cfg.bannedWords);
  if (banned) return { kind: 'banned-word', detail: banned };

  return null;
}

function reasonText(v: Violation): string {
  switch (v.kind) {
    case 'link':
      return `Link zu **${v.detail}** ist auf diesem Server nicht erlaubt.`;
    case 'caps':
      return `Bitte schreib nicht so viel in Großbuchstaben (${v.detail}).`;
    case 'mentions':
      return `Zu viele @-Mentions in einer Nachricht (${v.detail}).`;
    case 'banned-word':
      return `Das Wort **${v.detail}** ist auf diesem Server nicht erlaubt.`;
  }
}

// ─── Registration ────────────────────────────────────────────────

async function shouldSkip(message: Message, cfg: AutoModConfig): Promise<boolean> {
  if (!message.guild) return true;
  if (message.author.bot) return true;
  if (message.system) return true;
  if (cfg.ignoredChannelIds.includes(message.channel.id)) return true;

  // Mods (ManageMessages) NICHT moderieren.
  const member = message.member;
  if (member?.permissions.has(PermissionFlagsBits.ManageMessages)) return true;

  // Ignore-Rollen
  if (cfg.ignoredRoleIds.length > 0 && member) {
    for (const roleId of cfg.ignoredRoleIds) {
      if (member.roles.cache.has(roleId)) return true;
    }
  }
  return false;
}

export function registerAutoMod(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      if (!message.guild) return;
      const cfg = await configFor(message.guild.id);
      if (!cfg.enabled) return;
      if (await shouldSkip(message, cfg)) return;

      const violation = checkMessage(message, cfg);
      if (!violation) return;

      const reason = reasonText(violation);

      // Delete + DM (best-effort).
      await message.delete().catch((err) => {
        console.warn('[automod] delete failed:', err);
      });
      message.author
        .send({
          content: `Deine Nachricht in **${message.guild.name}** wurde gelöscht.\n${reason}`,
        })
        .catch(() => {});
    } catch (err) {
      console.error('[automod]', err);
    }
  });
}
