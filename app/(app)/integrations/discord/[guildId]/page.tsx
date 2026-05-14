import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFreshAccessToken } from '@/lib/discordConnection';
import {
  CHANNEL_TYPE_ANNOUNCEMENT,
  CHANNEL_TYPE_TEXT,
  DiscordRateLimitError,
  canManageGuild,
  fetchCurrentUserGuilds,
  fetchGuildChannels,
  fetchGuildRoles,
  guildIconUrl,
  type DiscordChannel,
  type DiscordGuild,
  type DiscordRole,
} from '@/lib/discord';
import { WelcomeForm } from '@/components/WelcomeForm';
import { AutoRolesForm } from '@/components/AutoRolesForm';
import { LogConfigForm } from '@/components/LogConfigForm';
import { LevelConfigForm } from '@/components/LevelConfigForm';
import { AutoModForm } from '@/components/AutoModForm';
import { BoosterForm } from '@/components/BoosterForm';
import { StickyMessagesForm } from '@/components/StickyMessagesForm';
import { ChannelModesForm } from '@/components/ChannelModesForm';
import { EmbedCreatorForm } from '@/components/EmbedCreatorForm';
import { ReactionRolesManager } from '@/components/ReactionRolesManager';
import { ModuleOverview } from '@/components/ModuleOverview';
import { VerifyForm } from '@/components/VerifyForm';
import { AntiRaidForm } from '@/components/AntiRaidForm';
import { GiveawaysForm } from '@/components/GiveawaysForm';
import {
  BirthdayForm,
  RoleBadgesForm,
  AfkForm,
  SuggestionsForm,
  InviteTrackerForm,
} from '@/components/Phase2FinishForms';
import { HelpdeskForm } from '@/components/HelpdeskForm';
import { TempVoiceForm } from '@/components/TempVoiceForm';
import { GuildSettingsTabs, type Tab } from '@/components/GuildSettingsTabs';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Server-Einstellungen · kanbanly',
};

type LoadResult =
  | { kind: 'no-conn' }
  | { kind: 'forbidden' }
  | { kind: 'no-bot' }
  // rate-limited entfernt — wir cachen Discord-API-Calls 5min und fallen auf DB-Lookup zurück.
  | {
      kind: 'ok';
      guildName: string;
      guildIcon: string | null;
      channels: DiscordChannel[];
      roles: DiscordRole[];
      welcome: {
        enabled: boolean;
        channelId: string | null;
        message: string | null;
        useEmbed: boolean;
        embedColor: number | null;
        dmEnabled: boolean;
        dmMessage: string | null;
        dmUseEmbed: boolean;
      };
      booster: {
        enabled: boolean;
        channelId: string | null;
        message: string | null;
        useEmbed: boolean;
        embedColor: number | null;
      };
      stickyMessages: Array<{ channelId: string; content: string; useEmbed: boolean }>;
      channelModes: Array<{
        channelId: string;
        mode: 'images_only' | 'text_only';
        allowVideos: boolean;
      }>;
      reactionRoleMessages: Array<{
        messageId: string;
        channelId: string;
        title: string | null;
        description: string | null;
        mode: 'reactions' | 'buttons' | 'select_menu';
        roles: Array<{
          emojiKey: string;
          emojiDisplay: string;
          roleId: string;
          label: string | null;
        }>;
      }>;
      autoRoles: { enabled: boolean; roleIds: string[] };
      log: {
        channelId: string | null;
        joins: boolean;
        leaves: boolean;
        messageEdits: boolean;
        messageDeletes: boolean;
        roleChanges: boolean;
      };
      level: {
        enabled: boolean;
        announce: boolean;
        upChannelId: string | null;
        useEmbed: boolean;
        embedColor: number | null;
      };
      levelRewards: Array<{ level: number; roleId: string }>;
      automod: {
        enabled: boolean;
        blockLinks: boolean;
        linkAllowlist: string[];
        maxCapsPct: number | null;
        maxMentions: number | null;
        bannedWords: string[];
      };
      embedTemplates: Array<{
        id: string;
        name: string;
        title: string | null;
        description: string | null;
        color: number | null;
        footer: string | null;
        imageUrl: string | null;
      }>;
      verify: {
        enabled: boolean;
        channelId: string | null;
        roleId: string | null;
        message: string | null;
        panelMessageId: string | null;
        panelTitle: string | null;
        panelColor: number | null;
        buttonLabel: string | null;
        buttonEmoji: string | null;
        buttonStyle: 'primary' | 'secondary' | 'success' | 'danger';
        replySuccess: string | null;
        replyAlready: string | null;
      };
      antiraid: {
        enabled: boolean;
        joinThreshold: number;
        joinWindowSec: number;
        action: 'alert' | 'kick' | 'lockdown';
        alertChannelId: string | null;
      };
      birthday: {
        enabled: boolean;
        channelId: string | null;
        message: string | null;
      };
      birthdayList: Array<{ userId: string; month: number; day: number; year: number | null }>;
      roleBadgesEnabled: boolean;
      roleBadges: Array<{ roleId: string; daysRequired: number }>;
      afk: {
        enabled: boolean;
        channelId: string | null;
        timeoutMinutes: number;
      };
      suggestions: {
        enabled: boolean;
        channelId: string | null;
        modRoleId: string | null;
      };
      suggestionsList: Array<{
        id: string;
        userId: string;
        content: string;
        status: 'open' | 'approved' | 'rejected' | 'implemented';
        upvotes: number;
        downvotes: number;
        createdAt: string;
      }>;
      inviteTrackerEnabled: boolean;
      helpdeskPanels: Array<{
        id: string;
        channelId: string;
        messageId: string | null;
        title: string;
        description: string | null;
        color: number | null;
        items: Array<{
          id: string;
          label: string;
          emoji: string | null;
          style: 'primary' | 'secondary' | 'success' | 'danger';
          answer: string;
          answerColor: number | null;
          position: number;
        }>;
      }>;
      tempvoice: {
        enabled: boolean;
        creatorChannelId: string | null;
        categoryId: string | null;
        nameTemplate: string | null;
        defaultLimit: number;
      };
      giveaways: Array<{
        id: string;
        channelId: string;
        messageId: string | null;
        prize: string;
        winnersCount: number;
        endsAt: string;
        ended: boolean;
        winnerUserIds: string[] | null;
        entriesCount: number;
      }>;
    };

async function load(userId: string, guildId: string): Promise<LoadResult> {
  const token = await getFreshAccessToken(userId);
  if (!token) return { kind: 'no-conn' };

  const admin0 = createAdminClient();

  // Permission-Check über Discord — bei Rate-Limit fallback auf linked_user_id-Check.
  let guild: DiscordGuild | undefined;
  let guildName: string | null = null;
  let guildIcon: string | null = null;
  let permissionsOk = false;
  try {
    const guilds = await fetchCurrentUserGuilds(token);
    guild = guilds.find((g) => g.id === guildId);
    if (!guild) return { kind: 'forbidden' };
    permissionsOk = guild.owner || canManageGuild(guild.permissions);
    if (!permissionsOk) return { kind: 'forbidden' };
    guildName = guild.name;
    guildIcon = guild.icon;
  } catch (err) {
    if (!(err instanceof DiscordRateLimitError)) throw err;
    // Rate-Limited beim User-Guild-Check: vertraue dem linked_user_id auf bot_guilds.
    const { data: link } = await admin0
      .from('bot_guilds')
      .select('linked_user_id, name')
      .eq('guild_id', guildId)
      .maybeSingle();
    if (!link || link.linked_user_id !== userId) return { kind: 'forbidden' };
    permissionsOk = true;
    guildName = (link.name as string | null) ?? guildId;
  }

  const admin = createAdminClient();
  const { data: guildRow, error: guildRowError } = await admin
    .from('bot_guilds')
    .select(
      'welcome_enabled, welcome_channel_id, welcome_message, welcome_use_embed, welcome_embed_color, welcome_dm_enabled, welcome_dm_message, welcome_dm_use_embed, booster_enabled, booster_channel_id, booster_message, booster_use_embed, booster_embed_color, auto_roles_enabled, auto_role_ids, log_channel_id, log_joins, log_leaves, log_message_edits, log_message_deletes, log_role_changes, level_enabled, level_announce, level_up_channel_id, level_use_embed, level_embed_color, automod_enabled, automod_block_links, automod_link_allowlist, automod_max_caps_pct, automod_max_mentions, automod_banned_words, verify_enabled, verify_channel_id, verify_role_id, verify_message, verify_panel_message_id, verify_panel_title, verify_panel_color, verify_button_label, verify_button_emoji, verify_button_style, verify_reply_success, verify_reply_already, antiraid_enabled, antiraid_join_threshold, antiraid_join_window_sec, antiraid_action, antiraid_alert_channel_id, birthday_enabled, birthday_channel_id, birthday_message, role_badges_enabled, afk_enabled, afk_channel_id, afk_timeout_minutes, suggestions_enabled, suggestions_channel_id, suggestions_mod_role_id, invite_tracker_enabled, tempvoice_enabled, tempvoice_creator_channel_id, tempvoice_category_id, tempvoice_name_template, tempvoice_default_limit',
    )
    .eq('guild_id', guildId)
    .maybeSingle();
  if (guildRowError) {
    console.error('[guild-settings] bot_guilds select failed:', guildRowError);
    throw new Error(
      `Datenbank-Schema unvollständig — vermutlich fehlende Migration. ` +
        `(${guildRowError.message})`,
    );
  }
  if (!guildRow) return { kind: 'no-bot' };

  let channels: DiscordChannel[] = [];
  try {
    channels = (await fetchGuildChannels(guildId))
      .filter((c) => c.type === CHANNEL_TYPE_TEXT || c.type === CHANNEL_TYPE_ANNOUNCEMENT)
      .sort((a, b) => a.position - b.position);
  } catch (err) {
    // Rate-Limit: leise weitermachen mit leerer Liste — die Page bleibt nutzbar.
    if (!(err instanceof DiscordRateLimitError)) {
      console.error('[guild-settings] channels:', err);
    }
  }

  let roles: DiscordRole[] = [];
  try {
    roles = (await fetchGuildRoles(guildId)).sort((a, b) => b.position - a.position);
  } catch (err) {
    // Rate-Limit: leise weitermachen.
    if (!(err instanceof DiscordRateLimitError)) {
      console.error('[guild-settings] roles:', err);
    }
  }

  const autoRoleIdsRaw = guildRow.auto_role_ids as unknown;
  const autoRoleIds = Array.isArray(autoRoleIdsRaw)
    ? (autoRoleIdsRaw as unknown[]).filter(
        (v): v is string => typeof v === 'string',
      )
    : [];

  const { data: rewardsRaw } = await admin
    .from('bot_level_rewards')
    .select('level, role_id')
    .eq('guild_id', guildId)
    .order('level');
  const levelRewards = (rewardsRaw ?? []).map((r) => ({
    level: r.level as number,
    roleId: r.role_id as string,
  }));

  const { data: stickyRaw } = await admin
    .from('bot_sticky_messages')
    .select('channel_id, content, use_embed')
    .eq('guild_id', guildId);
  const stickyMessages = (stickyRaw ?? []).map((r) => ({
    channelId: r.channel_id as string,
    content: r.content as string,
    useEmbed: Boolean(r.use_embed),
  }));

  const { data: modesRaw } = await admin
    .from('bot_channel_modes')
    .select('channel_id, mode, allow_videos')
    .eq('guild_id', guildId);
  const channelModes = (modesRaw ?? []).map((r) => ({
    channelId: r.channel_id as string,
    mode: r.mode as 'images_only' | 'text_only',
    allowVideos: Boolean(r.allow_videos),
  }));

  const { data: rrMsgRaw } = await admin
    .from('bot_reaction_role_messages')
    .select('message_id, channel_id, title, description, mode, created_at')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false });
  const rrMessageIds = (rrMsgRaw ?? []).map((m) => m.message_id as string);
  const { data: rrRolesRaw } = rrMessageIds.length
    ? await admin
        .from('bot_reaction_roles')
        .select('message_id, emoji_key, emoji_display, role_id, label')
        .in('message_id', rrMessageIds)
    : { data: [] as Array<Record<string, unknown>> };
  const rolesByMessage = new Map<
    string,
    Array<{ emojiKey: string; emojiDisplay: string; roleId: string; label: string | null }>
  >();
  for (const r of rrRolesRaw ?? []) {
    const mid = r.message_id as string;
    if (!rolesByMessage.has(mid)) rolesByMessage.set(mid, []);
    rolesByMessage.get(mid)!.push({
      emojiKey: r.emoji_key as string,
      emojiDisplay: r.emoji_display as string,
      roleId: r.role_id as string,
      label: (r.label as string | null) ?? null,
    });
  }
  const { data: tplRaw } = await admin
    .from('bot_embed_templates')
    .select('id, name, title, description, color, footer, image_url')
    .eq('guild_id', guildId)
    .order('updated_at', { ascending: false });
  const embedTemplates = (tplRaw ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    title: (r.title as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    color: (r.color as number | null) ?? null,
    footer: (r.footer as string | null) ?? null,
    imageUrl: (r.image_url as string | null) ?? null,
  }));

  const { data: giveawayRaw } = await admin
    .from('bot_giveaways')
    .select('id, channel_id, message_id, prize, winners_count, ends_at, ended, winner_user_ids')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(50);
  const gwIds = (giveawayRaw ?? []).map((r) => r.id as string);
  const gwCount = new Map<string, number>();
  if (gwIds.length) {
    const { data: ents } = await admin
      .from('bot_giveaway_entries')
      .select('giveaway_id')
      .in('giveaway_id', gwIds);
    for (const e of ents ?? []) {
      const id = e.giveaway_id as string;
      gwCount.set(id, (gwCount.get(id) ?? 0) + 1);
    }
  }
  const giveaways = (giveawayRaw ?? []).map((r) => ({
    id: r.id as string,
    channelId: r.channel_id as string,
    messageId: (r.message_id as string | null) ?? null,
    prize: r.prize as string,
    winnersCount: r.winners_count as number,
    endsAt: r.ends_at as string,
    ended: Boolean(r.ended),
    winnerUserIds: Array.isArray(r.winner_user_ids)
      ? (r.winner_user_ids as unknown[]).filter(
          (v): v is string => typeof v === 'string',
        )
      : null,
    entriesCount: gwCount.get(r.id as string) ?? 0,
  }));

  const { data: birthdaysRaw } = await admin
    .from('bot_birthdays')
    .select('user_id, month, day, year')
    .eq('guild_id', guildId)
    .order('month')
    .order('day');
  const birthdayList = (birthdaysRaw ?? []).map((r) => ({
    userId: r.user_id as string,
    month: r.month as number,
    day: r.day as number,
    year: (r.year as number | null) ?? null,
  }));

  const { data: badgesRaw } = await admin
    .from('bot_role_badges')
    .select('role_id, days_required')
    .eq('guild_id', guildId)
    .order('days_required');
  const roleBadges = (badgesRaw ?? []).map((r) => ({
    roleId: r.role_id as string,
    daysRequired: r.days_required as number,
  }));

  const { data: suggRaw } = await admin
    .from('bot_suggestions')
    .select('id, user_id, content, status, upvotes, downvotes, created_at')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(50);
  const suggestionsList = (suggRaw ?? []).map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    content: r.content as string,
    status: r.status as 'open' | 'approved' | 'rejected' | 'implemented',
    upvotes: (r.upvotes as number) ?? 0,
    downvotes: (r.downvotes as number) ?? 0,
    createdAt: r.created_at as string,
  }));

  const { data: hdPanelsRaw } = await admin
    .from('bot_helpdesk_panels')
    .select('id, channel_id, message_id, title, description, color')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false });
  const hdPanelIds = (hdPanelsRaw ?? []).map((p) => p.id as string);
  const { data: hdItemsRaw } = hdPanelIds.length
    ? await admin
        .from('bot_helpdesk_items')
        .select('id, panel_id, label, emoji, style, answer, answer_color, position')
        .in('panel_id', hdPanelIds)
        .order('position')
    : { data: [] as Array<Record<string, unknown>> };
  const itemsByPanel = new Map<
    string,
    Array<{
      id: string;
      label: string;
      emoji: string | null;
      style: 'primary' | 'secondary' | 'success' | 'danger';
      answer: string;
      answerColor: number | null;
      position: number;
    }>
  >();
  for (const it of hdItemsRaw ?? []) {
    const pid = it.panel_id as string;
    if (!itemsByPanel.has(pid)) itemsByPanel.set(pid, []);
    itemsByPanel.get(pid)!.push({
      id: it.id as string,
      label: it.label as string,
      emoji: (it.emoji as string | null) ?? null,
      style: ((it.style as string) ?? 'secondary') as
        | 'primary'
        | 'secondary'
        | 'success'
        | 'danger',
      answer: it.answer as string,
      answerColor: (it.answer_color as number | null) ?? null,
      position: (it.position as number) ?? 0,
    });
  }
  const helpdeskPanels = (hdPanelsRaw ?? []).map((p) => ({
    id: p.id as string,
    channelId: p.channel_id as string,
    messageId: (p.message_id as string | null) ?? null,
    title: p.title as string,
    description: (p.description as string | null) ?? null,
    color: (p.color as number | null) ?? null,
    items: itemsByPanel.get(p.id as string) ?? [],
  }));

  const reactionRoleMessages = (rrMsgRaw ?? []).map((m) => ({
    messageId: m.message_id as string,
    channelId: m.channel_id as string,
    title: (m.title as string | null) ?? null,
    description: (m.description as string | null) ?? null,
    mode: ((m.mode as string | null) ?? 'reactions') as
      | 'reactions'
      | 'buttons'
      | 'select_menu',
    roles: rolesByMessage.get(m.message_id as string) ?? [],
  }));

  return {
    kind: 'ok',
    guildName: guildName ?? guildId,
    guildIcon,
    channels,
    roles,
    welcome: {
      enabled: guildRow.welcome_enabled,
      channelId: guildRow.welcome_channel_id,
      message: guildRow.welcome_message,
      useEmbed: Boolean(guildRow.welcome_use_embed),
      embedColor: (guildRow.welcome_embed_color as number | null) ?? null,
      dmEnabled: Boolean(guildRow.welcome_dm_enabled),
      dmMessage: (guildRow.welcome_dm_message as string | null) ?? null,
      dmUseEmbed: Boolean(guildRow.welcome_dm_use_embed),
    },
    booster: {
      enabled: Boolean(guildRow.booster_enabled),
      channelId: (guildRow.booster_channel_id as string | null) ?? null,
      message: (guildRow.booster_message as string | null) ?? null,
      useEmbed: Boolean(guildRow.booster_use_embed),
      embedColor: (guildRow.booster_embed_color as number | null) ?? null,
    },
    stickyMessages,
    channelModes,
    reactionRoleMessages,
    embedTemplates,
    verify: {
      enabled: Boolean(guildRow.verify_enabled),
      channelId: (guildRow.verify_channel_id as string | null) ?? null,
      roleId: (guildRow.verify_role_id as string | null) ?? null,
      message: (guildRow.verify_message as string | null) ?? null,
      panelMessageId: (guildRow.verify_panel_message_id as string | null) ?? null,
      panelTitle: (guildRow.verify_panel_title as string | null) ?? null,
      panelColor: (guildRow.verify_panel_color as number | null) ?? null,
      buttonLabel: (guildRow.verify_button_label as string | null) ?? null,
      buttonEmoji: (guildRow.verify_button_emoji as string | null) ?? null,
      buttonStyle:
        ((guildRow.verify_button_style as
          | 'primary'
          | 'secondary'
          | 'success'
          | 'danger'
          | null) ?? 'primary'),
      replySuccess: (guildRow.verify_reply_success as string | null) ?? null,
      replyAlready: (guildRow.verify_reply_already as string | null) ?? null,
    },
    antiraid: {
      enabled: Boolean(guildRow.antiraid_enabled),
      joinThreshold: (guildRow.antiraid_join_threshold as number | null) ?? 5,
      joinWindowSec: (guildRow.antiraid_join_window_sec as number | null) ?? 10,
      action:
        ((guildRow.antiraid_action as 'alert' | 'kick' | 'lockdown' | null) ??
          'alert'),
      alertChannelId:
        (guildRow.antiraid_alert_channel_id as string | null) ?? null,
    },
    birthday: {
      enabled: Boolean(guildRow.birthday_enabled),
      channelId: (guildRow.birthday_channel_id as string | null) ?? null,
      message: (guildRow.birthday_message as string | null) ?? null,
    },
    birthdayList,
    roleBadgesEnabled: Boolean(guildRow.role_badges_enabled),
    roleBadges,
    afk: {
      enabled: Boolean(guildRow.afk_enabled),
      channelId: (guildRow.afk_channel_id as string | null) ?? null,
      timeoutMinutes: (guildRow.afk_timeout_minutes as number | null) ?? 10,
    },
    suggestions: {
      enabled: Boolean(guildRow.suggestions_enabled),
      channelId: (guildRow.suggestions_channel_id as string | null) ?? null,
      modRoleId: (guildRow.suggestions_mod_role_id as string | null) ?? null,
    },
    suggestionsList,
    inviteTrackerEnabled: Boolean(guildRow.invite_tracker_enabled),
    helpdeskPanels,
    tempvoice: {
      enabled: Boolean(guildRow.tempvoice_enabled),
      creatorChannelId:
        (guildRow.tempvoice_creator_channel_id as string | null) ?? null,
      categoryId: (guildRow.tempvoice_category_id as string | null) ?? null,
      nameTemplate: (guildRow.tempvoice_name_template as string | null) ?? null,
      defaultLimit: (guildRow.tempvoice_default_limit as number | null) ?? 0,
    },
    giveaways,
    autoRoles: {
      enabled: Boolean(guildRow.auto_roles_enabled),
      roleIds: autoRoleIds,
    },
    log: {
      channelId: guildRow.log_channel_id ?? null,
      joins: Boolean(guildRow.log_joins),
      leaves: Boolean(guildRow.log_leaves),
      messageEdits: Boolean(guildRow.log_message_edits),
      messageDeletes: Boolean(guildRow.log_message_deletes),
      roleChanges: Boolean(guildRow.log_role_changes),
    },
    level: {
      enabled: Boolean(guildRow.level_enabled),
      announce: Boolean(guildRow.level_announce),
      upChannelId: guildRow.level_up_channel_id ?? null,
      useEmbed: Boolean(guildRow.level_use_embed),
      embedColor: (guildRow.level_embed_color as number | null) ?? null,
    },
    levelRewards,
    automod: {
      enabled: Boolean(guildRow.automod_enabled),
      blockLinks: Boolean(guildRow.automod_block_links),
      linkAllowlist: Array.isArray(guildRow.automod_link_allowlist)
        ? (guildRow.automod_link_allowlist as unknown[]).filter(
            (v): v is string => typeof v === 'string',
          )
        : [],
      maxCapsPct: (guildRow.automod_max_caps_pct as number | null) ?? null,
      maxMentions: (guildRow.automod_max_mentions as number | null) ?? null,
      bannedWords: Array.isArray(guildRow.automod_banned_words)
        ? (guildRow.automod_banned_words as unknown[]).filter(
            (v): v is string => typeof v === 'string',
          )
        : [],
    },
  };
}

export default async function GuildSettingsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { guildId } = await params;
  const result = await load(user.id, guildId);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-5">
          <Link
            href="/integrations/discord"
            className="group inline-flex items-center gap-2 rounded-lg border border-line bg-surface hover:bg-elev hover:border-line-strong px-3 py-1.5 text-[12.5px] text-muted hover:text-fg transition-all"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
              aria-hidden
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Server-Übersicht
          </Link>
        </div>

        {result.kind === 'no-conn' && (
          <div className="rounded-md bg-surface border border-line p-6">
            <p className="text-sm text-fg">Discord-Verbindung abgelaufen.</p>
            <Link
              href="/api/discord/connect"
              className="mt-3 inline-block text-xs rounded-md bg-[#5865F2] text-white px-3 py-1.5"
            >
              Neu verbinden
            </Link>
          </div>
        )}

        {result.kind === 'forbidden' && (
          <div className="rounded-md bg-surface border border-line p-6">
            <p className="text-sm text-fg">Du hast keine Verwaltungsrechte auf diesem Server.</p>
          </div>
        )}

        {result.kind === 'no-bot' && (
          <div className="rounded-md bg-surface border border-line p-6">
            <p className="text-sm text-fg">Der Bot ist (noch) nicht auf diesem Server.</p>
            <Link
              href="/integrations/discord"
              className="mt-3 inline-block text-xs text-muted hover:text-fg"
            >
              Zur Übersicht — dort findest du den Einladen-Link.
            </Link>
          </div>
        )}

        {/* rate-limited entfernt — gecachte Daten + DB-Fallback */}
        {false && (
          <div className="hidden" />
        )}

        {result.kind === 'ok' && (
          <GuildSettingsView
            guildName={result.guildName}
            guildId={guildId}
            guildIcon={
              result.guildIcon
                ? guildIconUrl({ id: guildId, icon: result.guildIcon })
                : null
            }
            channels={result.channels.map((c) => ({ id: c.id, name: c.name }))}
            roles={result.roles.map((r) => ({
              id: r.id,
              name: r.name,
              color: r.color,
            }))}
            welcome={result.welcome}
            booster={result.booster}
            stickyMessages={result.stickyMessages}
            channelModes={result.channelModes}
            reactionRoleMessages={result.reactionRoleMessages}
            autoRoles={result.autoRoles}
            log={result.log}
            level={result.level}
            levelRewards={result.levelRewards}
            automod={result.automod}
            embedTemplates={result.embedTemplates}
            verify={result.verify}
            antiraid={result.antiraid}
            giveaways={result.giveaways}
            birthday={result.birthday}
            birthdayList={result.birthdayList}
            roleBadgesEnabled={result.roleBadgesEnabled}
            roleBadges={result.roleBadges}
            afk={result.afk}
            suggestions={result.suggestions}
            suggestionsList={result.suggestionsList}
            inviteTrackerEnabled={result.inviteTrackerEnabled}
            helpdeskPanels={result.helpdeskPanels}
            tempvoice={result.tempvoice}
          />
        )}
      </div>
    </div>
  );
}

function GuildSettingsView({
  guildName,
  guildId,
  guildIcon,
  channels,
  roles,
  welcome,
  booster,
  stickyMessages,
  channelModes,
  reactionRoleMessages,
  autoRoles,
  log,
  level,
  levelRewards,
  automod,
  embedTemplates,
  verify,
  antiraid,
  giveaways,
  birthday,
  birthdayList,
  roleBadgesEnabled,
  roleBadges,
  afk,
  suggestions,
  suggestionsList,
  inviteTrackerEnabled,
  helpdeskPanels,
  tempvoice,
}: {
  guildName: string;
  guildId: string;
  guildIcon: string | null;
  channels: Array<{ id: string; name: string }>;
  roles: Array<{ id: string; name: string; color: number }>;
  welcome: {
    enabled: boolean;
    channelId: string | null;
    message: string | null;
    useEmbed: boolean;
    embedColor: number | null;
    dmEnabled: boolean;
    dmMessage: string | null;
    dmUseEmbed: boolean;
  };
  booster: {
    enabled: boolean;
    channelId: string | null;
    message: string | null;
    useEmbed: boolean;
    embedColor: number | null;
  };
  stickyMessages: Array<{ channelId: string; content: string; useEmbed: boolean }>;
  channelModes: Array<{
    channelId: string;
    mode: 'images_only' | 'text_only';
    allowVideos: boolean;
  }>;
  reactionRoleMessages: Array<{
    messageId: string;
    channelId: string;
    title: string | null;
    description: string | null;
    mode: 'reactions' | 'buttons' | 'select_menu';
    roles: Array<{
      emojiKey: string;
      emojiDisplay: string;
      roleId: string;
      label: string | null;
    }>;
  }>;
  autoRoles: { enabled: boolean; roleIds: string[] };
  log: {
    channelId: string | null;
    joins: boolean;
    leaves: boolean;
    messageEdits: boolean;
    messageDeletes: boolean;
    roleChanges: boolean;
  };
  level: {
    enabled: boolean;
    announce: boolean;
    upChannelId: string | null;
    useEmbed: boolean;
    embedColor: number | null;
  };
  levelRewards: Array<{ level: number; roleId: string }>;
  automod: {
    enabled: boolean;
    blockLinks: boolean;
    linkAllowlist: string[];
    maxCapsPct: number | null;
    maxMentions: number | null;
    bannedWords: string[];
  };
  embedTemplates: Array<{
    id: string;
    name: string;
    title: string | null;
    description: string | null;
    color: number | null;
    footer: string | null;
    imageUrl: string | null;
  }>;
  verify: {
    enabled: boolean;
    channelId: string | null;
    roleId: string | null;
    message: string | null;
    panelMessageId: string | null;
    panelTitle: string | null;
    panelColor: number | null;
    buttonLabel: string | null;
    buttonEmoji: string | null;
    buttonStyle: 'primary' | 'secondary' | 'success' | 'danger';
    replySuccess: string | null;
    replyAlready: string | null;
  };
  antiraid: {
    enabled: boolean;
    joinThreshold: number;
    joinWindowSec: number;
    action: 'alert' | 'kick' | 'lockdown';
    alertChannelId: string | null;
  };
  giveaways: Array<{
    id: string;
    channelId: string;
    messageId: string | null;
    prize: string;
    winnersCount: number;
    endsAt: string;
    ended: boolean;
    winnerUserIds: string[] | null;
    entriesCount: number;
  }>;
  birthday: { enabled: boolean; channelId: string | null; message: string | null };
  birthdayList: Array<{
    userId: string;
    month: number;
    day: number;
    year: number | null;
  }>;
  roleBadgesEnabled: boolean;
  roleBadges: Array<{ roleId: string; daysRequired: number }>;
  afk: { enabled: boolean; channelId: string | null; timeoutMinutes: number };
  suggestions: {
    enabled: boolean;
    channelId: string | null;
    modRoleId: string | null;
  };
  suggestionsList: Array<{
    id: string;
    userId: string;
    content: string;
    status: 'open' | 'approved' | 'rejected' | 'implemented';
    upvotes: number;
    downvotes: number;
    createdAt: string;
  }>;
  inviteTrackerEnabled: boolean;
  helpdeskPanels: Array<{
    id: string;
    channelId: string;
    messageId: string | null;
    title: string;
    description: string | null;
    color: number | null;
    items: Array<{
      id: string;
      label: string;
      emoji: string | null;
      style: 'primary' | 'secondary' | 'success' | 'danger';
      answer: string;
      answerColor: number | null;
      position: number;
    }>;
  }>;
  tempvoice: {
    enabled: boolean;
    creatorChannelId: string | null;
    categoryId: string | null;
    nameTemplate: string | null;
    defaultLimit: number;
  };
}) {
  const moduleDefs = [
    {
      key: 'welcome' as const,
      name: 'Welcome',
      description: 'Begrüßt neue Mitglieder mit personalisierter Nachricht und optionaler DM.',
      tab: 'welcome',
      enabled: welcome.enabled,
      toggleable: true,
    },
    {
      key: 'autoroles' as const,
      name: 'Auto-Roles',
      description: 'Vergibt jedem neuen Mitglied automatisch eine oder mehrere Rollen.',
      tab: 'autoroles',
      enabled: autoRoles.enabled,
      toggleable: true,
    },
    {
      key: 'logging' as const,
      name: 'Logging',
      description: 'Audit-Trail mit Joins, Leaves, Message-Edits/Deletes und Rollen-Änderungen.',
      tab: 'logging',
      enabled: log.channelId !== null,
      toggleable: false,
      count: log.channelId !== null
        ? [log.joins, log.leaves, log.messageEdits, log.messageDeletes, log.roleChanges].filter(Boolean).length
        : undefined,
    },
    {
      key: 'levels' as const,
      name: 'Leveling',
      description: 'XP-System mit Level-Up-Nachrichten und automatischen Rollen-Rewards.',
      tab: 'levels',
      enabled: level.enabled,
      toggleable: true,
    },
    {
      key: 'automod' as const,
      name: 'AutoMod',
      description: 'Spam-, Link-, Caps- und Mention-Filter sowie Wort-Blacklist.',
      tab: 'automod',
      enabled: automod.enabled,
      toggleable: true,
    },
    {
      key: 'reactionroles' as const,
      name: 'Reaction-Rollen',
      description: 'Self-Service-Rollen via Reaktion, Button oder Dropdown.',
      tab: 'reactionroles',
      enabled: reactionRoleMessages.length > 0,
      toggleable: false,
      count: reactionRoleMessages.length > 0 ? reactionRoleMessages.length : undefined,
      isNew: true,
    },
    {
      key: 'booster' as const,
      name: 'Booster-Message',
      description: 'Bedankt sich automatisch wenn jemand den Server boostet.',
      tab: 'booster',
      enabled: booster.enabled,
      toggleable: true,
      isNew: true,
    },
    {
      key: 'sticky' as const,
      name: 'Sticky Messages',
      description: 'Re-postet wichtige Nachrichten am Channel-Ende.',
      tab: 'sticky',
      enabled: stickyMessages.length > 0,
      toggleable: false,
      count: stickyMessages.length > 0 ? stickyMessages.length : undefined,
      isNew: true,
    },
    {
      key: 'channelmodes' as const,
      name: 'Channel-Modes',
      description: 'Beschränkt Channels auf nur Bilder oder nur Text.',
      tab: 'channelmodes',
      enabled: channelModes.length > 0,
      toggleable: false,
      count: channelModes.length > 0 ? channelModes.length : undefined,
      isNew: true,
    },
    {
      key: 'embed' as const,
      name: 'Embed-Creator',
      description: 'Baue benutzerdefinierte Embed-Nachrichten und sende sie als Bot.',
      tab: 'embed',
      enabled: false,
      toggleable: false,
      isNew: true,
    },
    {
      key: 'verify' as const,
      name: 'Verifizierung',
      description: 'Button-Verify schützt vor Selfbots — neue Member klicken, um die Verified-Rolle zu bekommen.',
      tab: 'verify',
      enabled: verify.enabled,
      toggleable: true,
      isNew: true,
    },
    {
      key: 'antiraid' as const,
      name: 'Anti-Raid',
      description: 'Burst-Detection: X Joins in Y Sekunden → Alert, Kick oder Lockdown.',
      tab: 'antiraid',
      enabled: antiraid.enabled,
      toggleable: true,
      isNew: true,
    },
    {
      key: 'giveaways' as const,
      name: 'Giveaways',
      description: 'Verlose Preise mit Button-Teilnahme, automatischem Ende und Reroll.',
      tab: 'giveaways',
      enabled: giveaways.some((g) => !g.ended),
      toggleable: false,
      count: giveaways.some((g) => !g.ended)
        ? giveaways.filter((g) => !g.ended).length
        : undefined,
      isNew: true,
    },
    {
      key: 'birthday' as const,
      name: 'Geburtstage',
      description: 'Automatische Glückwünsche zum Geburtstag im konfigurierten Channel.',
      tab: 'birthday',
      enabled: birthday.enabled,
      toggleable: true,
      isNew: true,
    },
    {
      key: 'rolebadges' as const,
      name: 'Rollen-Badges',
      description: 'Auto-Rollen nach X Tagen Mitgliedschaft (1-Year-Member etc.).',
      tab: 'rolebadges',
      enabled: roleBadgesEnabled,
      toggleable: true,
      isNew: true,
    },
    {
      key: 'afk' as const,
      name: 'AFK-Room',
      description: 'Stumm/taube Voice-User werden nach X Minuten in AFK-Channel verschoben.',
      tab: 'afk',
      enabled: afk.enabled,
      toggleable: true,
      isNew: true,
    },
    {
      key: 'suggestions' as const,
      name: 'Vorschläge',
      description: '/suggest mit Modal — Upvote/Downvote-Buttons + Mod-Approve.',
      tab: 'suggestions',
      enabled: suggestions.enabled,
      toggleable: true,
      isNew: true,
    },
    {
      key: 'invitetracker' as const,
      name: 'Invite-Tracker',
      description: 'Wer hat wen eingeladen — mit Leaderboard.',
      tab: 'invitetracker',
      enabled: inviteTrackerEnabled,
      toggleable: true,
      isNew: true,
    },
    {
      key: 'helpdesk' as const,
      name: 'Helpdesk',
      description: 'Button-Panels mit ephemeren FAQ-Antworten — perfekt für Server-Regeln und Common-Questions.',
      tab: 'helpdesk',
      enabled: helpdeskPanels.length > 0,
      toggleable: false,
      count: helpdeskPanels.length > 0 ? helpdeskPanels.length : undefined,
      isNew: true,
    },
    {
      key: 'tempvoice' as const,
      name: 'Temp-Voice',
      description: 'User joint Creator-Channel → Bot legt persönlichen Voice-Channel an, der bei Verlassen gelöscht wird.',
      tab: 'tempvoice',
      enabled: tempvoice.enabled,
      toggleable: true,
      isNew: true,
    },
  ];

  const tabs: Tab[] = [
    {
      id: 'overview',
      label: 'Übersicht',
      icon: '🏠',
      description: 'Alle Module — durchsuchen, ein-/ausschalten, konfigurieren.',
      noCardWrapper: true,
      content: (
        <ModuleOverview guildId={guildId} modules={moduleDefs} />
      ),
    },
    {
      id: 'welcome',
      label: 'Welcome',
      icon: '👋',
      description: 'Begrüßungs-Nachricht für neue Mitglieder.',
      content: (
        <WelcomeForm guildId={guildId} channels={channels} initial={welcome} />
      ),
    },
    {
      id: 'autoroles',
      label: 'Auto-Roles',
      icon: '🎭',
      description: 'Rollen, die jedem neuen Mitglied automatisch vergeben werden.',
      content: (
        <AutoRolesForm guildId={guildId} roles={roles} initial={autoRoles} />
      ),
    },
    {
      id: 'logging',
      label: 'Logging',
      icon: '📋',
      description: 'Joins, Leaves, Edits, Deletes und Rollen-Änderungen in einen Audit-Channel.',
      content: (
        <LogConfigForm guildId={guildId} channels={channels} initial={log} />
      ),
    },
    {
      id: 'levels',
      label: 'Levels',
      icon: '🏆',
      description: 'XP-System, Level-Up-Nachrichten und Rollen-Rewards.',
      content: (
        <LevelConfigForm
          guildId={guildId}
          channels={channels}
          roles={roles}
          initial={level}
          rewards={levelRewards}
        />
      ),
    },
    {
      id: 'automod',
      label: 'AutoMod',
      icon: '🛡️',
      description: 'Spam-/Link-/Caps-/Mention-Filter und verbotene Wörter.',
      content: <AutoModForm guildId={guildId} initial={automod} />,
    },
    {
      id: 'reactionroles',
      label: 'Reaction-Rollen',
      icon: '✨',
      description: 'Self-Service-Rollen über Emoji-Reaktionen.',
      content: (
        <ReactionRolesManager
          guildId={guildId}
          channels={channels}
          roles={roles}
          initial={reactionRoleMessages}
        />
      ),
    },
    {
      id: 'booster',
      label: 'Booster',
      icon: '🚀',
      description: 'Dankesnachricht für Server-Booster.',
      content: <BoosterForm guildId={guildId} channels={channels} initial={booster} />,
    },
    {
      id: 'sticky',
      label: 'Sticky',
      icon: '📌',
      description: 'Wichtige Nachrichten am Channel-Ende fixieren.',
      content: (
        <StickyMessagesForm
          guildId={guildId}
          channels={channels}
          initial={stickyMessages}
        />
      ),
    },
    {
      id: 'channelmodes',
      label: 'Channel-Modes',
      icon: '🎯',
      description: 'Bilder-Only oder Text-Only-Channels.',
      content: (
        <ChannelModesForm
          guildId={guildId}
          channels={channels}
          initial={channelModes}
        />
      ),
    },
    {
      id: 'embed',
      label: 'Embed-Creator',
      icon: '🎨',
      description: 'Baue custom Embeds und sende sie als Bot.',
      content: (
        <EmbedCreatorForm
          guildId={guildId}
          channels={channels}
          initialTemplates={embedTemplates}
        />
      ),
    },
    {
      id: 'verify',
      label: 'Verifizierung',
      icon: '🛡️',
      description: 'Button-Verify — schützt vor Selfbots und Raid-Accounts.',
      content: (
        <VerifyForm
          guildId={guildId}
          channels={channels}
          roles={roles}
          initial={verify}
        />
      ),
    },
    {
      id: 'antiraid',
      label: 'Anti-Raid',
      icon: '🚨',
      description: 'Burst-Detection: X Joins in Y Sekunden → Alert/Kick/Lockdown.',
      content: (
        <AntiRaidForm guildId={guildId} channels={channels} initial={antiraid} />
      ),
    },
    {
      id: 'giveaways',
      label: 'Giveaways',
      icon: '🎉',
      description: 'Preise verlosen mit Button-Teilnahme und automatischem Ende.',
      content: (
        <GiveawaysForm guildId={guildId} channels={channels} initial={giveaways} />
      ),
    },
    {
      id: 'birthday',
      label: 'Geburtstage',
      icon: '🎂',
      description: 'Tägliche Glückwünsche um ~09:00 UTC.',
      content: (
        <BirthdayForm
          guildId={guildId}
          channels={channels}
          initial={birthday}
          birthdays={birthdayList}
        />
      ),
    },
    {
      id: 'rolebadges',
      label: 'Rollen-Badges',
      icon: '🏅',
      description: 'Auto-Rollen nach Mitgliedschafts-Dauer.',
      content: (
        <RoleBadgesForm
          guildId={guildId}
          roles={roles}
          enabled={roleBadgesEnabled}
          badges={roleBadges}
        />
      ),
    },
    {
      id: 'afk',
      label: 'AFK-Room',
      icon: '💤',
      description: 'Stumm/taube User in AFK-Voice verschieben.',
      content: <AfkForm guildId={guildId} channels={channels} initial={afk} />,
    },
    {
      id: 'suggestions',
      label: 'Vorschläge',
      icon: '💡',
      description: 'Modal-Vorschläge mit Voting + Mod-Workflow.',
      content: (
        <SuggestionsForm
          guildId={guildId}
          channels={channels}
          roles={roles}
          initial={suggestions}
          list={suggestionsList}
        />
      ),
    },
    {
      id: 'invitetracker',
      label: 'Invite-Tracker',
      icon: '📨',
      description: 'Leaderboard wer wen eingeladen hat.',
      content: (
        <InviteTrackerForm guildId={guildId} enabled={inviteTrackerEnabled} />
      ),
    },
    {
      id: 'helpdesk',
      label: 'Helpdesk',
      icon: '❓',
      description: 'Button-Panels mit ephemeren FAQ-Antworten.',
      content: (
        <HelpdeskForm
          guildId={guildId}
          channels={channels}
          initial={helpdeskPanels}
        />
      ),
    },
    {
      id: 'tempvoice',
      label: 'Temp-Voice',
      icon: '🔊',
      description: 'Persönliche Voice-Channels auf Knopfdruck.',
      content: <TempVoiceForm guildId={guildId} initial={tempvoice} />,
    },
  ];

  return (
    <>
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
        <div className="relative shrink-0">
          <div className="h-14 w-14 rounded-2xl bg-elev flex items-center justify-center overflow-hidden ring-1 ring-line">
            {guildIcon ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={guildIcon}
                alt=""
                width={56}
                height={56}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-base text-muted font-semibold">
                {guildName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[var(--success)] border-2 border-surface"
            title="Bot aktiv"
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-fg leading-tight truncate">
            {guildName}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-[11.5px] text-muted">
            <span className="text-[var(--success)] font-medium">Bot aktiv</span>
            <span className="text-faint">·</span>
            <span className="font-mono text-subtle truncate">{guildId}</span>
          </div>
        </div>
      </div>

      <GuildSettingsTabs tabs={tabs} />
    </>
  );
}
