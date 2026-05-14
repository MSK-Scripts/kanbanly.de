import { getDb } from '../db.js';

export type HelpdeskItem = {
  id: string;
  panelId: string;
  label: string;
  emoji: string | null;
  style: 'primary' | 'secondary' | 'success' | 'danger';
  answer: string;
  answerColor: number | null;
  position: number;
};

export async function getHelpdeskItem(itemId: string): Promise<HelpdeskItem | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_helpdesk_items')
    .select('id, panel_id, label, emoji, style, answer, answer_color, position')
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    panelId: data.panel_id as string,
    label: data.label as string,
    emoji: (data.emoji as string | null) ?? null,
    style: (data.style as HelpdeskItem['style']) ?? 'secondary',
    answer: data.answer as string,
    answerColor: (data.answer_color as number | null) ?? null,
    position: (data.position as number) ?? 0,
  };
}
