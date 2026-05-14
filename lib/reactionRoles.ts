import type { DiscordComponent, EmbedPayload } from './discordBot';

export type RrMode = 'reactions' | 'buttons' | 'select_menu';

export type ParsedEmoji =
  | { kind: 'unicode'; key: string; display: string; urlForm: string }
  | {
      kind: 'custom';
      key: string;
      display: string;
      id: string;
      name: string;
      animated: boolean;
      urlForm: string;
    };

export function parseEmoji(input: string): ParsedEmoji | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const customMatch = trimmed.match(/^<(a?):([\w~]+):(\d+)>$/);
  if (customMatch) {
    const [, animated, name, id] = customMatch;
    return {
      kind: 'custom',
      key: id,
      display: trimmed,
      id,
      name,
      animated: animated === 'a',
      urlForm: `${name}:${id}`,
    };
  }
  // Unicode-Emoji oder Text-Fallback.
  return { kind: 'unicode', key: trimmed, display: trimmed, urlForm: trimmed };
}

function emojiForApi(emojiDisplay: string): { id?: string; name?: string; animated?: boolean } | undefined {
  const parsed = parseEmoji(emojiDisplay);
  if (!parsed) return undefined;
  if (parsed.kind === 'custom') {
    return { id: parsed.id, name: parsed.name, animated: parsed.animated };
  }
  return { name: parsed.key };
}

export function buildRrComponents(
  mode: RrMode,
  messageId: string,
  rows: Array<{ emojiKey: string; emojiDisplay: string; roleId: string; label: string | null }>,
  roleNameById: Map<string, string>,
): DiscordComponent[] {
  if (rows.length === 0) return [];

  if (mode === 'buttons') {
    const sliced = rows.slice(0, 25);
    const components: DiscordComponent[] = [];
    for (let i = 0; i < sliced.length; i += 5) {
      const chunk = sliced.slice(i, i + 5);
      components.push({
        type: 1, // ActionRow
        components: chunk.map((r) => ({
          type: 2, // Button
          style: 2, // Secondary
          custom_id: `rr:btn:${messageId}:${r.roleId}`,
          label: (r.label || roleNameById.get(r.roleId) || 'Rolle').slice(0, 80),
          emoji: emojiForApi(r.emojiDisplay),
        })),
      });
    }
    return components;
  }

  if (mode === 'select_menu') {
    const sliced = rows.slice(0, 25);
    return [
      {
        type: 1,
        components: [
          {
            type: 3, // StringSelect
            custom_id: `rr:sel:${messageId}`,
            placeholder: 'Rollen wählen…',
            min_values: 0,
            max_values: sliced.length,
            options: sliced.map((r) => ({
              label: (r.label || roleNameById.get(r.roleId) || 'Rolle').slice(0, 100),
              value: r.roleId,
              emoji: emojiForApi(r.emojiDisplay),
            })),
          },
        ],
      },
    ];
  }

  return [];
}

export function buildReactionRoleEmbed(
  title: string | null,
  description: string | null,
  rows: { emojiDisplay: string; roleId: string; label: string | null }[],
): EmbedPayload {
  const body = rows.length
    ? rows
        .map(
          (r) =>
            `${r.emojiDisplay} → <@&${r.roleId}>${r.label ? ` · ${r.label}` : ''}`,
        )
        .join('\n')
    : '_Noch keine Rollen — füge welche im Dashboard hinzu._';
  const desc = [description, body].filter(Boolean).join('\n\n');
  return {
    title: title ?? 'Wähle deine Rollen',
    description: desc,
    color: 0x5865f2,
  };
}
