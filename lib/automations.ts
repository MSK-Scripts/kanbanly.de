import type { SupabaseClient } from '@supabase/supabase-js';
import { notifySubscribers } from '@/lib/notifications';

export type AutomationTriggerKind = 'card_moved_to_list';

export type AutomationActionKind =
  | 'archive_card'
  | 'clear_due_date'
  | 'add_label'
  | 'remove_label'
  | 'clear_assignees';

export type Automation = {
  id: string;
  board_id: string;
  name: string;
  enabled: boolean;
  trigger_kind: AutomationTriggerKind;
  trigger_config: Record<string, unknown>;
  action_kind: AutomationActionKind;
  action_config: Record<string, unknown>;
};

export type RunResult = {
  archived: boolean;
  dueCleared: boolean;
  labelsAdded: string[];
  labelsRemoved: string[];
  assigneesCleared: boolean;
};

/**
 * Run any matching automation actions against a card. Used after a card
 * has moved into a list. Returns what happened so callers can update
 * client-side state without a full refetch.
 *
 * `actorId` ist der User der den Move ausgelöst hat — die durch eine
 * Automation entstehende Card-Archivierung soll Subscriber/Assignees
 * benachrichtigen, aber nicht den Auslöser selbst.
 */
export async function runMoveAutomations(
  supabase: SupabaseClient,
  cardId: string,
  targetListId: string,
  rules: Automation[],
  actorId: string | null = null,
  cardTitle: string | null = null
): Promise<RunResult> {
  const result: RunResult = {
    archived: false,
    dueCleared: false,
    labelsAdded: [],
    labelsRemoved: [],
    assigneesCleared: false,
  };

  const matching = rules.filter(
    (r) =>
      r.enabled &&
      r.trigger_kind === 'card_moved_to_list' &&
      (r.trigger_config as { listId?: string }).listId === targetListId
  );

  for (const rule of matching) {
    switch (rule.action_kind) {
      case 'archive_card': {
        const { error } = await supabase
          .from('cards')
          .update({ archived_at: new Date().toISOString() })
          .eq('id', cardId);
        if (!error) {
          result.archived = true;
          if (actorId) {
            notifySubscribers(
              supabase,
              cardId,
              actorId,
              'card_archived',
              cardTitle ? { cardTitle, byAutomation: true } : { byAutomation: true }
            ).catch(() => {});
          }
        }
        break;
      }
      case 'clear_due_date': {
        const { error } = await supabase
          .from('cards')
          .update({ due_date: null })
          .eq('id', cardId);
        if (!error) result.dueCleared = true;
        break;
      }
      case 'add_label': {
        const labelId = (rule.action_config as { labelId?: string }).labelId;
        if (!labelId) break;
        const { error } = await supabase
          .from('card_labels')
          .upsert(
            { card_id: cardId, label_id: labelId },
            { onConflict: 'card_id,label_id', ignoreDuplicates: true }
          );
        if (!error) result.labelsAdded.push(labelId);
        break;
      }
      case 'remove_label': {
        const labelId = (rule.action_config as { labelId?: string }).labelId;
        if (!labelId) break;
        const { error } = await supabase
          .from('card_labels')
          .delete()
          .eq('card_id', cardId)
          .eq('label_id', labelId);
        if (!error) result.labelsRemoved.push(labelId);
        break;
      }
      case 'clear_assignees': {
        const { error } = await supabase
          .from('card_assignees')
          .delete()
          .eq('card_id', cardId);
        if (!error) result.assigneesCleared = true;
        break;
      }
    }
  }

  return result;
}
