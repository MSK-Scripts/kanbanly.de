import { getDb } from '../db.js';

export type TicketButtonStyle = 'primary' | 'secondary' | 'success' | 'danger';

export type PanelTicketButton = {
  id: string;
  kind: 'ticket';
  label: string;
  emoji?: string | null;
  style: TicketButtonStyle;
  categoryId?: string | null;
  staffRoleIds?: string[];
  welcomeMessage?: string | null;
  namePattern?: string | null;
};

export type PanelLinkButton = {
  id: string;
  kind: 'link';
  label: string;
  emoji?: string | null;
  url: string;
};

export type PanelButton = PanelTicketButton | PanelLinkButton;

export type PanelSelectMenu = {
  enabled: boolean;
  placeholder: string;
  options: Array<{
    label: string;
    description?: string | null;
    emoji?: string | null;
    /** Verweist auf eine Ticket-Button-Konfig (gleiche id), wird genauso angelegt. */
    buttonId: string;
  }>;
};

export type FeedbackMode = 'dm' | 'channel' | 'both';

export type TicketPanel = {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  staffRoleId: string;
  staffRoleIds: string[];
  categoryId: string | null;
  createdBy: string;
  title: string;
  description: string;
  buttonLabel: string;
  buttonEmoji: string | null;
  buttonStyle: TicketButtonStyle;
  color: number | null;
  welcomeMessage: string | null;
  buttons: PanelButton[];
  selectMenu: PanelSelectMenu | null;
  embedPayload: unknown | null;
  feedbackEnabled: boolean;
  feedbackMode: FeedbackMode;
  feedbackQuestion: string;
  inactivityHours: number | null;
  autoCloseHours: number | null;
  staffSlaMinutes: number | null;
  namePattern: string;
};

export type TranscriptMessage = {
  id: string;
  author: { id: string; username: string; avatarUrl: string | null };
  content: string;
  timestamp: string;
  attachments: Array<{ url: string; name: string }>;
  embedsCount: number;
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
  lastMessageAt: string | null;
  staffFirstResponseAt: string | null;
  remindedInactive: boolean;
  remindedSla: boolean;
  selectedButtonId: string | null;
};

type PanelRow = {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string;
  staff_role_id: string;
  staff_role_ids: string[] | null;
  category_id: string | null;
  created_by: string;
  title: string | null;
  description: string | null;
  button_label: string | null;
  button_emoji: string | null;
  button_style: string | null;
  color: number | null;
  welcome_message: string | null;
  buttons: unknown;
  select_menu: unknown;
  embed_payload: unknown;
  feedback_enabled: boolean | null;
  feedback_mode: string | null;
  feedback_question: string | null;
  inactivity_hours: number | null;
  auto_close_hours: number | null;
  staff_sla_minutes: number | null;
  name_pattern: string | null;
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
  last_message_at: string | null;
  staff_first_response_at: string | null;
  reminded_inactive: boolean | null;
  reminded_sla: boolean | null;
  selected_button_id: string | null;
};

const PANEL_SELECT =
  'id, guild_id, channel_id, message_id, staff_role_id, staff_role_ids, category_id, created_by, title, description, button_label, button_emoji, button_style, color, welcome_message, buttons, select_menu, embed_payload, feedback_enabled, feedback_mode, feedback_question, inactivity_hours, auto_close_hours, staff_sla_minutes, name_pattern';

const TICKET_SELECT =
  'id, guild_id, channel_id, owner_user_id, panel_id, created_at, closed_at, closed_by, last_message_at, staff_first_response_at, reminded_inactive, reminded_sla, selected_button_id';

function asArray<T>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

function mapPanel(r: PanelRow): TicketPanel {
  const staffRoleIds =
    r.staff_role_ids && r.staff_role_ids.length > 0
      ? r.staff_role_ids
      : r.staff_role_id
      ? [r.staff_role_id]
      : [];
  return {
    id: r.id,
    guildId: r.guild_id,
    channelId: r.channel_id,
    messageId: r.message_id,
    staffRoleId: r.staff_role_id,
    staffRoleIds,
    categoryId: r.category_id,
    createdBy: r.created_by,
    title: r.title ?? '🎫 Support öffnen',
    description:
      r.description ??
      'Klick den Button unten, um ein privates Ticket zu eröffnen.',
    buttonLabel: r.button_label ?? 'Ticket öffnen',
    buttonEmoji: r.button_emoji ?? null,
    buttonStyle: (r.button_style as TicketButtonStyle | null) ?? 'primary',
    color: r.color ?? null,
    welcomeMessage: r.welcome_message ?? null,
    buttons: asArray<PanelButton>(r.buttons),
    selectMenu:
      r.select_menu && typeof r.select_menu === 'object'
        ? (r.select_menu as PanelSelectMenu)
        : null,
    embedPayload: r.embed_payload ?? null,
    feedbackEnabled: r.feedback_enabled ?? false,
    feedbackMode: (r.feedback_mode as FeedbackMode | null) ?? 'dm',
    feedbackQuestion:
      r.feedback_question ?? 'Wie zufrieden warst du mit dem Support?',
    inactivityHours: r.inactivity_hours,
    autoCloseHours: r.auto_close_hours,
    staffSlaMinutes: r.staff_sla_minutes,
    namePattern: r.name_pattern ?? 'ticket-{user}',
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
    lastMessageAt: r.last_message_at,
    staffFirstResponseAt: r.staff_first_response_at,
    remindedInactive: r.reminded_inactive ?? false,
    remindedSla: r.reminded_sla ?? false,
    selectedButtonId: r.selected_button_id,
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
      staff_role_ids: [args.staffRoleId],
      category_id: args.categoryId,
      created_by: args.createdBy,
    })
    .select(PANEL_SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Panel-Insert lieferte keine Daten.');
  return mapPanel(data as PanelRow);
}

export async function getPanelById(panelId: string): Promise<TicketPanel | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_ticket_panels')
    .select(PANEL_SELECT)
    .eq('id', panelId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPanel(data as PanelRow) : null;
}

export async function getPanelByMessage(messageId: string): Promise<TicketPanel | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_ticket_panels')
    .select(PANEL_SELECT)
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
    .select(PANEL_SELECT)
    .eq('guild_id', guildId);
  if (error) throw error;
  return (data ?? []).map((r) => mapPanel(r as PanelRow));
}

export async function createTicket(args: {
  guildId: string;
  channelId: string;
  ownerUserId: string;
  panelId: string | null;
  selectedButtonId?: string | null;
}): Promise<Ticket> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('bot_tickets')
    .insert({
      guild_id: args.guildId,
      channel_id: args.channelId,
      owner_user_id: args.ownerUserId,
      panel_id: args.panelId,
      selected_button_id: args.selectedButtonId ?? null,
      last_message_at: now,
    })
    .select(TICKET_SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Ticket-Insert lieferte keine Daten.');
  return mapTicket(data as TicketRow);
}

export async function getTicketByChannel(channelId: string): Promise<Ticket | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_tickets')
    .select(TICKET_SELECT)
    .eq('channel_id', channelId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTicket(data as TicketRow) : null;
}

export async function getTicketById(ticketId: string): Promise<Ticket | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_tickets')
    .select(TICKET_SELECT)
    .eq('id', ticketId)
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
    .select(TICKET_SELECT)
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

export async function saveTicketTranscript(
  channelId: string,
  transcript: TranscriptMessage[],
): Promise<void> {
  const db = getDb();
  await db
    .from('bot_tickets')
    .update({
      transcript,
      transcript_saved_at: new Date().toISOString(),
    })
    .eq('channel_id', channelId);
}

export async function updateTicketActivity(args: {
  channelId: string;
  lastMessageAt: string;
  staffFirstResponseAt?: string | null;
  resetReminders?: boolean;
}): Promise<void> {
  const db = getDb();
  const patch: Record<string, unknown> = {
    last_message_at: args.lastMessageAt,
  };
  if (args.staffFirstResponseAt) {
    patch.staff_first_response_at = args.staffFirstResponseAt;
  }
  if (args.resetReminders) {
    patch.reminded_inactive = false;
    patch.reminded_sla = false;
  }
  await db
    .from('bot_tickets')
    .update(patch)
    .eq('channel_id', args.channelId)
    .is('closed_at', null);
}

export async function listOpenTicketsForGuild(guildId: string): Promise<Ticket[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_tickets')
    .select(TICKET_SELECT)
    .eq('guild_id', guildId)
    .is('closed_at', null);
  if (error) throw error;
  return (data ?? []).map((r) => mapTicket(r as TicketRow));
}

export async function markRemindedInactive(ticketId: string): Promise<void> {
  const db = getDb();
  await db
    .from('bot_tickets')
    .update({ reminded_inactive: true })
    .eq('id', ticketId);
}

export async function markRemindedSla(ticketId: string): Promise<void> {
  const db = getDb();
  await db
    .from('bot_tickets')
    .update({ reminded_sla: true })
    .eq('id', ticketId);
}

export async function saveTicketFeedback(args: {
  ticketId: string;
  guildId: string;
  userId: string;
  rating: number;
  comment: string | null;
}): Promise<void> {
  const db = getDb();
  await db.from('bot_ticket_feedback').upsert(
    {
      ticket_id: args.ticketId,
      guild_id: args.guildId,
      user_id: args.userId,
      rating: args.rating,
      comment: args.comment,
    },
    { onConflict: 'ticket_id' },
  );
}

export async function getTicketFeedback(
  ticketId: string,
): Promise<{ rating: number; comment: string | null } | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_ticket_feedback')
    .select('rating, comment')
    .eq('ticket_id', ticketId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { rating: data.rating as number, comment: (data.comment as string | null) ?? null }
    : null;
}
