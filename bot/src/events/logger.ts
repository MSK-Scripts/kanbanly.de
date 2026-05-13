import {
  ChannelType,
  EmbedBuilder,
  Events,
  type Client,
  type Guild,
  type GuildMember,
  type Message,
  type PartialGuildMember,
  type PartialMessage,
  type TextChannel,
} from 'discord.js';
import { getLogConfig, type LogConfig } from '../db/guilds.js';

const COLOR_JOIN = 0x22c55e;
const COLOR_LEAVE = 0xf43f5e;
const COLOR_EDIT = 0xf59e0b;
const COLOR_DELETE = 0xef4444;
const COLOR_ROLE = 0x8b5cf6;

async function getLogChannel(
  guild: Guild,
  cfg: LogConfig,
): Promise<TextChannel | null> {
  if (!cfg.channelId) return null;
  const ch = await guild.channels.fetch(cfg.channelId).catch(() => null);
  if (!ch) return null;
  if (
    ch.type !== ChannelType.GuildText &&
    ch.type !== ChannelType.GuildAnnouncement
  ) {
    return null;
  }
  return ch as TextChannel;
}

async function sendLog(
  guild: Guild,
  cfg: LogConfig,
  embed: EmbedBuilder,
): Promise<void> {
  const channel = await getLogChannel(guild, cfg);
  if (!channel) return;
  await channel.send({ embeds: [embed] }).catch((err) => {
    console.error('[logger] send fehlgeschlagen:', err);
  });
}

function truncate(s: string, max = 1024): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export function registerLogger(client: Client): void {
  // ─── Member join ────────────────────────────────────────────────
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    try {
      if (member.user.bot) return;
      const cfg = await getLogConfig(member.guild.id);
      if (!cfg.joins) return;
      const embed = new EmbedBuilder()
        .setColor(COLOR_JOIN)
        .setAuthor({
          name: `${member.user.username} ist beigetreten`,
          iconURL: member.user.displayAvatarURL(),
        })
        .setDescription(`<@${member.id}> · \`${member.id}\``)
        .addFields({
          name: 'Account erstellt',
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
        })
        .setTimestamp();
      await sendLog(member.guild, cfg, embed);
    } catch (err) {
      console.error('[logger] join:', err);
    }
  });

  // ─── Member leave ───────────────────────────────────────────────
  client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
    try {
      const cfg = await getLogConfig(member.guild.id);
      if (!cfg.leaves) return;
      const username = member.user?.username ?? 'Unbekannt';
      const embed = new EmbedBuilder()
        .setColor(COLOR_LEAVE)
        .setAuthor({
          name: `${username} hat den Server verlassen`,
          iconURL: member.user?.displayAvatarURL() ?? undefined,
        })
        .setDescription(`<@${member.id}> · \`${member.id}\``)
        .setTimestamp();
      const joinedAt = member.joinedTimestamp;
      if (joinedAt) {
        embed.addFields({
          name: 'War seit',
          value: `<t:${Math.floor(joinedAt / 1000)}:R>`,
        });
      }
      await sendLog(member.guild, cfg, embed);
    } catch (err) {
      console.error('[logger] leave:', err);
    }
  });

  // ─── Message delete ─────────────────────────────────────────────
  client.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
    try {
      if (!message.guild) return;
      if (message.author?.bot) return;
      const cfg = await getLogConfig(message.guild.id);
      if (!cfg.messageDeletes) return;
      const embed = new EmbedBuilder()
        .setColor(COLOR_DELETE)
        .setAuthor({
          name: `Nachricht gelöscht in #${
            (message.channel as TextChannel).name ?? '?'
          }`,
          iconURL: message.author?.displayAvatarURL() ?? undefined,
        })
        .setDescription(
          message.content
            ? truncate(message.content)
            : '_(Inhalt nicht verfügbar — vermutlich vor Bot-Start gesendet oder Embed/Attachment)_',
        )
        .addFields({
          name: 'Autor',
          value: message.author
            ? `<@${message.author.id}> · \`${message.author.id}\``
            : 'unbekannt',
        })
        .setTimestamp();
      await sendLog(message.guild, cfg, embed);
    } catch (err) {
      console.error('[logger] message delete:', err);
    }
  });

  // ─── Message edit ───────────────────────────────────────────────
  client.on(
    Events.MessageUpdate,
    async (oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage) => {
      try {
        if (!newMsg.guild) return;
        if (newMsg.author?.bot) return;
        // Edits können auch nur Embeds sein (Link-Preview) — die wollen wir nicht.
        if (oldMsg.content === newMsg.content) return;
        const cfg = await getLogConfig(newMsg.guild.id);
        if (!cfg.messageEdits) return;
        const embed = new EmbedBuilder()
          .setColor(COLOR_EDIT)
          .setAuthor({
            name: `Nachricht bearbeitet in #${
              (newMsg.channel as TextChannel).name ?? '?'
            }`,
            iconURL: newMsg.author?.displayAvatarURL() ?? undefined,
          })
          .addFields(
            { name: 'Vorher', value: truncate(oldMsg.content ?? '_(unbekannt)_') },
            { name: 'Nachher', value: truncate(newMsg.content ?? '_(leer)_') },
            {
              name: 'Autor',
              value: newMsg.author
                ? `<@${newMsg.author.id}> · [Link](${newMsg.url})`
                : 'unbekannt',
            },
          )
          .setTimestamp();
        await sendLog(newMsg.guild, cfg, embed);
      } catch (err) {
        console.error('[logger] message update:', err);
      }
    },
  );

  // ─── Role changes ───────────────────────────────────────────────
  client.on(
    Events.GuildMemberUpdate,
    async (
      oldMember: GuildMember | PartialGuildMember,
      newMember: GuildMember,
    ) => {
      try {
        const cfg = await getLogConfig(newMember.guild.id);
        if (!cfg.roleChanges) return;

        const oldRoles = new Set(oldMember.roles?.cache.keys() ?? []);
        const newRoles = new Set(newMember.roles.cache.keys());
        const added = [...newRoles].filter((r) => !oldRoles.has(r));
        const removed = [...oldRoles].filter((r) => !newRoles.has(r));
        if (added.length === 0 && removed.length === 0) return;

        const fields = [];
        if (added.length > 0) {
          fields.push({
            name: '➕ Hinzugefügt',
            value: added.map((id) => `<@&${id}>`).join(', '),
          });
        }
        if (removed.length > 0) {
          fields.push({
            name: '➖ Entfernt',
            value: removed.map((id) => `<@&${id}>`).join(', '),
          });
        }

        const embed = new EmbedBuilder()
          .setColor(COLOR_ROLE)
          .setAuthor({
            name: `Rollen geändert · ${newMember.user.username}`,
            iconURL: newMember.user.displayAvatarURL(),
          })
          .setDescription(`<@${newMember.id}> · \`${newMember.id}\``)
          .addFields(fields)
          .setTimestamp();
        await sendLog(newMember.guild, cfg, embed);
      } catch (err) {
        console.error('[logger] role change:', err);
      }
    },
  );
}
