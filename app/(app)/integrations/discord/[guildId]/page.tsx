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
import { GuildSettingsTabs, type Tab } from '@/components/GuildSettingsTabs';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Server-Einstellungen · kanbanly',
};

type LoadResult =
  | { kind: 'no-conn' }
  | { kind: 'forbidden' }
  | { kind: 'no-bot' }
  | { kind: 'rate-limited'; retryAfterSec: number }
  | {
      kind: 'ok';
      guild: DiscordGuild;
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
    };

async function load(userId: string, guildId: string): Promise<LoadResult> {
  const token = await getFreshAccessToken(userId);
  if (!token) return { kind: 'no-conn' };

  let guilds: DiscordGuild[];
  try {
    guilds = await fetchCurrentUserGuilds(token);
  } catch (err) {
    if (err instanceof DiscordRateLimitError) {
      return { kind: 'rate-limited', retryAfterSec: err.retryAfterSec };
    }
    throw err;
  }
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) return { kind: 'forbidden' };
  if (!guild.owner && !canManageGuild(guild.permissions)) return { kind: 'forbidden' };

  const admin = createAdminClient();
  const { data: guildRow, error: guildRowError } = await admin
    .from('bot_guilds')
    .select(
      'welcome_enabled, welcome_channel_id, welcome_message, welcome_use_embed, welcome_embed_color, welcome_dm_enabled, welcome_dm_message, welcome_dm_use_embed, booster_enabled, booster_channel_id, booster_message, booster_use_embed, booster_embed_color, auto_roles_enabled, auto_role_ids, log_channel_id, log_joins, log_leaves, log_message_edits, log_message_deletes, log_role_changes, level_enabled, level_announce, level_up_channel_id, level_use_embed, level_embed_color, automod_enabled, automod_block_links, automod_link_allowlist, automod_max_caps_pct, automod_max_mentions, automod_banned_words',
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
    if (err instanceof DiscordRateLimitError) {
      return { kind: 'rate-limited', retryAfterSec: err.retryAfterSec };
    }
    console.error('[guild-settings] channels:', err);
  }

  let roles: DiscordRole[] = [];
  try {
    roles = (await fetchGuildRoles(guildId)).sort((a, b) => b.position - a.position);
  } catch (err) {
    if (err instanceof DiscordRateLimitError) {
      return { kind: 'rate-limited', retryAfterSec: err.retryAfterSec };
    }
    console.error('[guild-settings] roles:', err);
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
    guild,
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
        <div className="mb-4">
          <Link
            href="/integrations/discord"
            className="text-xs text-muted hover:text-fg transition-colors"
          >
            ← zurück zur Server-Übersicht
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

        {result.kind === 'rate-limited' && (
          <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-6">
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium mb-1">
              Discord hat uns kurz ausgebremst (Rate-Limit).
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
              In ~{result.retryAfterSec} Sekunden nochmal die Seite neu laden.
              Das passiert wenn schnell hintereinander gespeichert wird —
              ist kein Fehler in deinen Einstellungen.
            </p>
          </div>
        )}

        {result.kind === 'ok' && (
          <GuildSettingsView
            guildName={result.guild.name}
            guildId={result.guild.id}
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
          />
        )}
      </div>
    </div>
  );
}

function GuildSettingsView({
  guildName,
  guildId,
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
}: {
  guildName: string;
  guildId: string;
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
      isNew: true,
    },
    {
      key: 'channelmodes' as const,
      name: 'Channel-Modes',
      description: 'Beschränkt Channels auf nur Bilder oder nur Text.',
      tab: 'channelmodes',
      enabled: channelModes.length > 0,
      toggleable: false,
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
      content: <EmbedCreatorForm guildId={guildId} channels={channels} />,
    },
  ];

  return (
    <>
      <div className="relative mb-6 overflow-hidden rounded-lg border border-line bg-surface p-5 sm:p-7">
        <div
          className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[#5865F2]/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#5865F2] font-mono mb-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Bot verbunden
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-fg leading-tight truncate tracking-tight">
              {guildName}
            </h1>
            <p className="text-[11px] text-subtle mt-1 font-mono">
              ID · {guildId}
            </p>
          </div>
        </div>
      </div>

      <GuildSettingsTabs tabs={tabs} />
    </>
  );
}
