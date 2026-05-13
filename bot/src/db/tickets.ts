import { getDb } from '../db.js';

export type TicketPanel = {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  staffRoleId: string;
  categoryId: string | null;
  createdBy: string;
};

export type Ticket = {
  id: string;
  guildId: string;
  channelId: string;
  ownerUserId: string;
  panelId: string | null;
  createdAt: string;
  closedAt: string | null;
  closedBy: string | null;
};

type PanelRow = {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string;
  staff_role_id: string;
  category_id: string | null;
  created_by: string;
};

type TicketRow = {
  id: string;
  guild_id: string;
  channel_id: string;
  owner_user_id: string;
  panel_id: string | null;
  created_at: string;
  closed_at: string | null;
  closed_by: string | null;
};

function mapPanel(r: PanelRow): TicketPanel {
  return {
    id: r.id,
    guildId: r.guild_id,
    channelId: r.channel_id,
    messageId: r.message_id,
    staffRoleId: r.staff_role_id,
    categoryId: r.category_id,
    createdBy: r.created_by,
  };
}

function mapTicket(r: TicketRow): Ticket {
  return {
    id: r.id,
    guildId: r.guild_id,
    channelId: r.channel_id,
    ownerUserId: r.owner_user_id,
    panelId: r.panel_id,
    createdAt: r.created_at,
    closedAt: r.closed_at,
    closedBy: r.closed_by,
  };
}

export async function createPanel(args: {
  guildId: string;
  channelId: string;
  messageId: string;
  staffRoleId: string;
  categoryId: string | null;
  createdBy: string;
}): Promise<TicketPanel> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_ticket_panels')
    .insert({
      guild_id: args.guildId,
      channel_id: args.channelId,
      message_id: args.messageId,
      staff_role_id: args.staffRoleId,
      category_id: args.categoryId,
      created_by: args.createdBy,
    })
    .select('id, guild_id, channel_id, message_id, staff_role_id, category_id, created_by')
    .single();
  if (error || !data) throw error ?? new Error('Panel-Insert lieferte keine Daten.');
  return mapPanel(data as PanelRow);
}

export async function getPanelByMessage(messageId: string): Promise<TicketPanel | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_ticket_panels')
    .select('id, guild_id, channel_id, message_id, staff_role_id, category_id, created_by')
    .eq('message_id', messageId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPanel(data as PanelRow) : null;
}

export async function deletePanel(messageId: string): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_ticket_panels')
    .delete()
    .eq('message_id', messageId)
    .select('id');
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function listPanelsForGuild(guildId: string): Promise<TicketPanel[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_ticket_panels')
    .select('id, guild_id, channel_id, message_id, staff_role_id, category_id, created_by')
    .eq('guild_id', guildId);
  if (error) throw error;
  return (data ?? []).map((r) => mapPanel(r as PanelRow));
}

export async function createTicket(args: {
  guildId: string;
  channelId: string;
  ownerUserId: string;
  panelId: string | null;
}): Promise<Ticket> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_tickets')
    .insert({
      guild_id: args.guildId,
      channel_id: args.channelId,
      owner_user_id: args.ownerUserId,
      panel_id: args.panelId,
    })
    .select(
      'id, guild_id, channel_id, owner_user_id, panel_id, created_at, closed_at, closed_by',
    )
    .single();
  if (error || !data) throw error ?? new Error('Ticket-Insert lieferte keine Daten.');
  return mapTicket(data as TicketRow);
}

export async function getTicketByChannel(channelId: string): Promise<Ticket | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_tickets')
    .select('id, guild_id, channel_id, owner_user_id, panel_id, created_at, closed_at, closed_by')
    .eq('channel_id', channelId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTicket(data as TicketRow) : null;
}

export async function getOpenTicketForOwner(
  guildId: string,
  ownerUserId: string,
): Promise<Ticket | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_tickets')
    .select('id, guild_id, channel_id, owner_user_id, panel_id, created_at, closed_at, closed_by')
    .eq('guild_id', guildId)
    .eq('owner_user_id', ownerUserId)
    .is('closed_at', null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTicket(data as TicketRow) : null;
}

export async function closeTicket(channelId: string, closedBy: string): Promise<void> {
  const db = getDb();
  await db
    .from('bot_tickets')
    .update({
      closed_at: new Date().toISOString(),
      closed_by: closedBy,
    })
    .eq('channel_id', channelId)
    .is('closed_at', null);
}
