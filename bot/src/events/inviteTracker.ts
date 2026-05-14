import {
  Events,
  type Client,
  type Guild,
  type GuildMember,
  type Invite,
} from 'discord.js';
import { getDb } from '../db.js';

async function isEnabled(guildId: string): Promise<boolean> {
  const db = getDb();
  const { data } = await db
    .from('bot_guilds')
    .select('invite_tracker_enabled')
    .eq('guild_id', guildId)
    .maybeSingle();
  return Boolean(data?.invite_tracker_enabled);
}

async function snapshotInvites(guild: Guild): Promise<void> {
  try {
    const invites = await guild.invites.fetch();
    const db = getDb();
    // Upsert: alle aktuellen Codes mit aktuellen uses speichern.
    const rows = Array.from(invites.values()).map((inv) => ({
      guild_id: guild.id,
      code: inv.code,
      inviter_user_id: inv.inviter?.id ?? null,
      uses: inv.uses ?? 0,
    }));
    if (rows.length > 0) {
      await db.from('bot_invites').upsert(rows, { onConflict: 'guild_id,code' });
    }
  } catch (err) {
    console.error('[invite-tracker] snapshot:', err);
  }
}

async function findUsedInvite(
  guild: Guild,
): Promise<{ code: string; inviterUserId: string | null } | null> {
  try {
    const current = await guild.invites.fetch();
    const db = getDb();
    const { data: stored } = await db
      .from('bot_invites')
      .select('code, uses, inviter_user_id')
      .eq('guild_id', guild.id);
    const storedMap = new Map<
      string,
      { uses: number; inviter: string | null }
    >();
    for (const r of stored ?? []) {
      storedMap.set(r.code as string, {
        uses: (r.uses as number) ?? 0,
        inviter: (r.inviter_user_id as string | null) ?? null,
      });
    }

    let foundInvite: Invite | null = null;
    for (const inv of current.values()) {
      const prev = storedMap.get(inv.code);
      if (prev && (inv.uses ?? 0) > prev.uses) {
        foundInvite = inv;
        break;
      }
      if (!prev && (inv.uses ?? 0) > 0) {
        // Neuer Code mit bereits Uses — wahrscheinlich der.
        foundInvite = inv;
      }
    }

    // Snapshot aktualisieren.
    const rows = Array.from(current.values()).map((inv) => ({
      guild_id: guild.id,
      code: inv.code,
      inviter_user_id: inv.inviter?.id ?? null,
      uses: inv.uses ?? 0,
    }));
    if (rows.length > 0) {
      await db.from('bot_invites').upsert(rows, { onConflict: 'guild_id,code' });
    }

    if (!foundInvite) return null;
    return {
      code: foundInvite.code,
      inviterUserId: foundInvite.inviter?.id ?? null,
    };
  } catch (err) {
    console.error('[invite-tracker] findUsed:', err);
    return null;
  }
}

export function registerInviteTracker(client: Client): void {
  // Initial Snapshot bei Bot-Ready.
  client.once(Events.ClientReady, async (c) => {
    for (const guild of c.guilds.cache.values()) {
      if (!(await isEnabled(guild.id).catch(() => false))) continue;
      snapshotInvites(guild).catch(() => {});
    }
  });

  // Bei neuem Server: Snapshot.
  client.on(Events.GuildCreate, (guild) => {
    isEnabled(guild.id)
      .then((en) => {
        if (en) snapshotInvites(guild).catch(() => {});
      })
      .catch(() => {});
  });

  // Bei neu erstellten/gelöschten Invites: Snapshot aktualisieren.
  client.on(Events.InviteCreate, (invite) => {
    if (!invite.guild) return;
    isEnabled(invite.guild.id)
      .then((en) => {
        if (en) snapshotInvites(invite.guild as Guild).catch(() => {});
      })
      .catch(() => {});
  });
  client.on(Events.InviteDelete, (invite) => {
    if (!invite.guild) return;
    isEnabled(invite.guild.id)
      .then(async (en) => {
        if (!en) return;
        const db = getDb();
        await db
          .from('bot_invites')
          .delete()
          .eq('guild_id', invite.guild!.id)
          .eq('code', invite.code);
      })
      .catch(() => {});
  });

  // Bei Join: rausfinden welcher Invite benutzt wurde.
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    try {
      if (member.user.bot) return;
      if (!(await isEnabled(member.guild.id))) return;
      const used = await findUsedInvite(member.guild);
      if (!used) return;
      const db = getDb();
      await db.from('bot_invite_attributions').insert({
        guild_id: member.guild.id,
        joined_user_id: member.id,
        inviter_user_id: used.inviterUserId,
        invite_code: used.code,
      });
    } catch (err) {
      console.error('[invite-tracker] member-add:', err);
    }
  });
}
