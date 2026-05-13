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
      welcome: { enabled: boolean; channelId: string | null; message: string | null };
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
  const { data: guildRow } = await admin
    .from('bot_guilds')
    .select(
      'welcome_enabled, welcome_channel_id, welcome_message, auto_roles_enabled, auto_role_ids, log_channel_id, log_joins, log_leaves, log_message_edits, log_message_deletes, log_role_changes, level_enabled, level_announce, level_up_channel_id, automod_enabled, automod_block_links, automod_link_allowlist, automod_max_caps_pct, automod_max_mentions, automod_banned_words',
    )
    .eq('guild_id', guildId)
    .maybeSingle();
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

  return {
    kind: 'ok',
    guild,
    channels,
    roles,
    welcome: {
      enabled: guildRow.welcome_enabled,
      channelId: guildRow.welcome_channel_id,
      message: guildRow.welcome_message,
    },
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
  welcome: { enabled: boolean; channelId: string | null; message: string | null };
  autoRoles: { enabled: boolean; roleIds: string[] };
  log: {
    channelId: string | null;
    joins: boolean;
    leaves: boolean;
    messageEdits: boolean;
    messageDeletes: boolean;
    roleChanges: boolean;
  };
  level: { enabled: boolean; announce: boolean; upChannelId: string | null };
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
  const overviewItems = [
    {
      label: 'Welcome',
      icon: '👋',
      enabled: welcome.enabled,
      hint: welcome.enabled
        ? welcome.channelId
          ? 'Channel gesetzt'
          : 'Channel fehlt'
        : 'Begrüße neue Mitglieder',
      target: 'welcome',
    },
    {
      label: 'Auto-Roles',
      icon: '🎭',
      enabled: autoRoles.enabled,
      hint: autoRoles.enabled
        ? `${autoRoles.roleIds.length} Rolle${autoRoles.roleIds.length === 1 ? '' : 'n'} bei Join`
        : 'Rolle automatisch vergeben',
      target: 'autoroles',
    },
    {
      label: 'Logging',
      icon: '📋',
      enabled: log.channelId !== null,
      hint:
        log.channelId !== null
          ? [
              log.joins && 'Joins',
              log.leaves && 'Leaves',
              log.messageEdits && 'Edits',
              log.messageDeletes && 'Deletes',
              log.roleChanges && 'Rollen',
            ]
              .filter(Boolean)
              .join(' · ') || 'kein Event aktiv'
          : 'Events in Audit-Channel',
      target: 'logging',
    },
    {
      label: 'Leveling',
      icon: '🏆',
      enabled: level.enabled,
      hint: level.enabled
        ? `${levelRewards.length} Reward${levelRewards.length === 1 ? '' : 's'}`
        : 'XP-System für Engagement',
      target: 'levels',
    },
    {
      label: 'AutoMod',
      icon: '🛡️',
      enabled: automod.enabled,
      hint: automod.enabled
        ? [
            automod.blockLinks && 'Links',
            automod.maxCapsPct !== null && 'Caps',
            automod.maxMentions !== null && 'Mentions',
            automod.bannedWords.length > 0 && 'Wörter',
          ]
            .filter(Boolean)
            .join(' · ') || 'an'
        : 'Spam, Links, Caps filtern',
      target: 'automod',
    },
    {
      label: 'Reaction-Rollen',
      icon: '✨',
      enabled: false,
      hint: 'Via Slash-Command verwaltet',
      target: 'reactionroles',
    },
  ];

  const tabs: Tab[] = [
    {
      id: 'overview',
      label: 'Übersicht',
      icon: '🏠',
      description: 'Status aller Module auf einen Blick — Karte klicken zum Konfigurieren.',
      noCardWrapper: true,
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {overviewItems.map((item) => (
            <a
              key={item.target}
              href={`#${item.target}`}
              className="group relative rounded-md border border-line bg-elev hover:bg-elev-hover hover:border-line-strong transition-all p-4 flex flex-col gap-3 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-2xl leading-none" aria-hidden>
                  {item.icon}
                </div>
                <span
                  className={`text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-sm border ${
                    item.enabled
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-elev text-subtle border-line-strong'
                  }`}
                >
                  {item.enabled ? '● Aktiv' : '○ Aus'}
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold text-fg group-hover:text-accent-hover transition-colors">
                  {item.label}
                </div>
                <div className="text-[11px] text-muted mt-0.5 leading-snug">
                  {item.hint}
                </div>
              </div>
              <div className="absolute right-3 bottom-3 text-fg-soft/40 group-hover:text-accent-hover transition-colors text-sm">
                →
              </div>
            </a>
          ))}
        </div>
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
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
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
        <p className="text-sm text-muted">
          Reaction-Roles werden aktuell über den Slash-Command{' '}
          <code className="px-1.5 py-0.5 rounded bg-elev text-fg-soft text-xs">
            /reactionroles
          </code>{' '}
          im Server verwaltet. Eine UI dafür folgt.
        </p>
      ),
    },
  ];

  return (
    <>
      <div className="mb-6 rounded-md bg-gradient-to-br from-[#5865F2]/12 via-surface to-surface border border-line p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-md bg-[#5865F2]/15 grid place-items-center text-[#5865F2] text-sm font-semibold shrink-0">
            {guildName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-fg leading-tight truncate">
              {guildName}
            </h1>
            <p className="text-[11px] text-subtle mt-0.5 font-mono">
              {guildId}
            </p>
          </div>
        </div>
      </div>

      <GuildSettingsTabs tabs={tabs} />
    </>
  );
}
