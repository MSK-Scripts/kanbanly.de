import { Events, type Client, type Message } from 'discord.js';
import { getTicketByChannel, updateTicketActivity, getPanelById } from '../db/tickets.js';

export function registerTicketActivity(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (!message.inGuild()) return;

    const ticket = await getTicketByChannel(message.channel.id).catch(() => null);
    if (!ticket || ticket.closedAt) return;

    const now = new Date().toISOString();

    // Wenn Staff antwortet UND Owner !== Author → first response erfassen (sofern nicht gesetzt).
    let staffFirst: string | null = null;
    if (
      !ticket.staffFirstResponseAt &&
      message.author.id !== ticket.ownerUserId &&
      ticket.panelId
    ) {
      const panel = await getPanelById(ticket.panelId).catch(() => null);
      const roleIds = panel
        ? panel.staffRoleIds.length > 0
          ? panel.staffRoleIds
          : [panel.staffRoleId]
        : [];
      const isStaff = message.member?.roles.cache.some((r) => roleIds.includes(r.id));
      if (isStaff) staffFirst = now;
    }

    await updateTicketActivity({
      channelId: message.channel.id,
      lastMessageAt: now,
      staffFirstResponseAt: staffFirst,
      resetReminders: true,
    }).catch((err) => console.warn('[ticket-activity]', err));
  });
}
