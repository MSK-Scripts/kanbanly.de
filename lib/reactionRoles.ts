import type { EmbedPayload } from './discordBot';

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
