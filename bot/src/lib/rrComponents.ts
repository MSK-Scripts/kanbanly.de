import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { parseEmoji } from '../db/reactionRoles.js';

export type RrMode = 'reactions' | 'buttons' | 'select_menu';

export type RrRow = {
  emojiKey: string;
  emojiDisplay: string;
  roleId: string;
  label: string | null;
};

const CUSTOM_ID_PREFIX = 'rr';

export function buildButtonCustomId(messageId: string, roleId: string): string {
  return `${CUSTOM_ID_PREFIX}:btn:${messageId}:${roleId}`;
}

export function buildSelectCustomId(messageId: string): string {
  return `${CUSTOM_ID_PREFIX}:sel:${messageId}`;
}

export function parseCustomId(
  raw: string,
):
  | { kind: 'btn'; messageId: string; roleId: string }
  | { kind: 'sel'; messageId: string }
  | null {
  const parts = raw.split(':');
  if (parts[0] !== CUSTOM_ID_PREFIX) return null;
  if (parts[1] === 'btn' && parts.length === 4) {
    return { kind: 'btn', messageId: parts[2], roleId: parts[3] };
  }
  if (parts[1] === 'sel' && parts.length === 3) {
    return { kind: 'sel', messageId: parts[2] };
  }
  return null;
}

function applyEmojiToButton(btn: ButtonBuilder, emojiDisplay: string): void {
  const parsed = parseEmoji(emojiDisplay);
  if (!parsed) return;
  if (parsed.kind === 'custom') {
    btn.setEmoji({ id: parsed.id, name: parsed.name, animated: parsed.animated });
  } else {
    btn.setEmoji(parsed.key);
  }
}

function applyEmojiToOption(
  opt: StringSelectMenuOptionBuilder,
  emojiDisplay: string,
): void {
  const parsed = parseEmoji(emojiDisplay);
  if (!parsed) return;
  if (parsed.kind === 'custom') {
    opt.setEmoji({ id: parsed.id, name: parsed.name, animated: parsed.animated });
  } else {
    opt.setEmoji(parsed.key);
  }
}

export function buildRrComponents(
  mode: RrMode,
  messageId: string,
  rows: RrRow[],
  roleNameById: Map<string, string>,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  if (rows.length === 0) return [];

  if (mode === 'buttons') {
    // Max 25 Buttons: 5 Buttons pro Row, 5 Rows.
    const sliced = rows.slice(0, 25);
    const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
    for (let i = 0; i < sliced.length; i += 5) {
      const chunk = sliced.slice(i, i + 5);
      const row = new ActionRowBuilder<MessageActionRowComponentBuilder>();
      for (const r of chunk) {
        const btn = new ButtonBuilder()
          .setCustomId(buildButtonCustomId(messageId, r.roleId))
          .setStyle(ButtonStyle.Secondary)
          .setLabel((r.label || roleNameById.get(r.roleId) || 'Rolle').slice(0, 80));
        applyEmojiToButton(btn, r.emojiDisplay);
        row.addComponents(btn);
      }
      components.push(row);
    }
    return components;
  }

  if (mode === 'select_menu') {
    const sliced = rows.slice(0, 25);
    const select = new StringSelectMenuBuilder()
      .setCustomId(buildSelectCustomId(messageId))
      .setPlaceholder('Rollen wählen…')
      .setMinValues(0)
      .setMaxValues(sliced.length);
    for (const r of sliced) {
      const opt = new StringSelectMenuOptionBuilder()
        .setValue(r.roleId)
        .setLabel((r.label || roleNameById.get(r.roleId) || 'Rolle').slice(0, 100));
      applyEmojiToOption(opt, r.emojiDisplay);
      select.addOptions(opt);
    }
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      select,
    );
    return [row];
  }

  // 'reactions' → keine Components, der User klickt auf Reactions.
  return [];
}
