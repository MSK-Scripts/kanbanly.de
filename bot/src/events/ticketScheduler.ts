import type { Client, TextChannel } from 'discord.js';
import {
  closeTicket,
  getPanelById,
  listOpenTicketsForGuild,
  markRemindedInactive,
  markRemindedSla,
  type TicketPanel,
} from '../db/tickets.js';
import { captureAndSaveTranscript } from '../lib/ticketTranscript.js';
import { maybePromptFeedback } from './ticketButtons.js';
import { getDb } from '../db.js';

const TICK_MS = 60_000; // 1 Minute reicht für SLA-Minuten-Granularität.

async function listAllGuildIds(): Promise<string[]> {
  const db = getDb();
  const { data, error } = await db.from('bot_guilds').select('guild_id');
  if (error) {
    console.warn('[ticket-scheduler] list guilds:', error.message);
    return [];
  }
  return (data ?? []).map((r) => r.guild_id as string);
}

async function processGuild(client: Client, guildId: string): Promise<void> {
  const tickets = await listOpenTicketsForGuild(guildId).catch(() => []);
  if (tickets.length === 0) return;

  // Panel-Cache pro Run.
  const panelCache = new Map<string, TicketPanel | null>();
  const getPanel = async (id: string | null) => {
    if (!id) return null;
    if (panelCache.has(id)) return panelCache.get(id) ?? null;
    const p = await getPanelById(id).catch(() => null);
    panelCache.set(id, p);
    return p;
  };

  const now = Date.now();

  for (const t of tickets) {
    const panel = await getPanel(t.panelId);
    if (!panel) continue;

    const lastMs = t.lastMessageAt ? Date.parse(t.lastMessageAt) : Date.parse(t.createdAt);
    const idleMs = now - lastMs;

    // ── Inaktivitäts-Reminder ──────────────────────────────────
    if (
      panel.inactivityHours != null &&
      panel.inactivityHours > 0 &&
      !t.remindedInactive &&
      idleMs >= panel.inactivityHours * 3600_000
    ) {
      const channel = (await client.channels.fetch(t.channelId).catch(() => null)) as
        | TextChannel
        | null;
      if (channel) {
        await channel
          .send({
            content: `⏰ <@${t.ownerUserId}>, dieses Ticket ist seit **${panel.inactivityHours}h** inaktiv. Brauchst du noch Hilfe?`,
            allowedMentions: { users: [t.ownerUserId] },
          })
          .catch(() => null);
      }
      await markRemindedInactive(t.id);
    }

    // ── Auto-Close ────────────────────────────────────────────
    if (
      panel.autoCloseHours != null &&
      panel.autoCloseHours > 0 &&
      idleMs >= panel.autoCloseHours * 3600_000
    ) {
      const channel = (await client.channels.fetch(t.channelId).catch(() => null)) as
        | TextChannel
        | null;
      if (channel) {
        await channel
          .send({
            content: `🔒 Ticket wegen Inaktivität (${panel.autoCloseHours}h) automatisch geschlossen. Channel wird in 15s gelöscht.`,
          })
          .catch(() => null);

        try {
          await captureAndSaveTranscript(channel);
        } catch (err) {
          console.warn('[ticket-scheduler] transcript:', err);
        }

        await closeTicket(t.channelId, 'auto-close');

        // Feedback-Prompt vor dem Löschen.
        if (panel.feedbackEnabled) {
          await maybePromptFeedback(client, panel, t.id, t.ownerUserId, t.channelId);
        }

        setTimeout(() => {
          channel.delete?.('Ticket auto-closed').catch(() => {});
        }, 15_000);
      } else {
        await closeTicket(t.channelId, 'auto-close');
      }
      continue; // weiter mit nächstem Ticket
    }

    // ── Staff-SLA ─────────────────────────────────────────────
    if (
      panel.staffSlaMinutes != null &&
      panel.staffSlaMinutes > 0 &&
      !t.staffFirstResponseAt &&
      !t.remindedSla
    ) {
      const ageMs = now - Date.parse(t.createdAt);
      if (ageMs >= panel.staffSlaMinutes * 60_000) {
        const channel = (await client.channels.fetch(t.channelId).catch(() => null)) as
          | TextChannel
          | null;
        const roles = panel.staffRoleIds.length > 0 ? panel.staffRoleIds : [panel.staffRoleId];
        if (channel) {
          await channel
            .send({
              content: `📣 ${roles
                .map((r) => `<@&${r}>`)
                .join(' ')} — Reaktion-SLA überschritten (${panel.staffSlaMinutes} Min).`,
              allowedMentions: { roles },
            })
            .catch(() => null);
        }
        await markRemindedSla(t.id);
      }
    }
  }
}

export function startTicketScheduler(client: Client): void {
  const tick = async () => {
    try {
      const guilds = await listAllGuildIds();
      for (const gid of guilds) {
        await processGuild(client, gid);
      }
    } catch (err) {
      console.error('[ticket-scheduler]', err);
    }
  };
  setInterval(tick, TICK_MS);
  // Erste Iteration zeitversetzt, damit der Bot fertig hochfahren kann.
  setTimeout(tick, 30_000);
}
