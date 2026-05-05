'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { AutomationActionKind, AutomationTriggerKind } from '@/lib/automations';

export async function createAutomation(
  boardId: string,
  boardSlug: string,
  payload: {
    name: string;
    triggerKind: AutomationTriggerKind;
    triggerConfig: Record<string, unknown>;
    actionKind: AutomationActionKind;
    actionConfig: Record<string, unknown>;
  }
) {
  if (!boardId || !payload.name.trim()) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('board_automations').insert({
    board_id: boardId,
    name: payload.name.trim(),
    trigger_kind: payload.triggerKind,
    trigger_config: payload.triggerConfig,
    action_kind: payload.actionKind,
    action_config: payload.actionConfig,
    created_by: user.id,
  });

  revalidatePath(`/boards/${boardSlug}/automation`);
  revalidatePath(`/boards/${boardSlug}`);
}

export async function deleteAutomation(id: string, boardSlug: string) {
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('board_automations').delete().eq('id', id);
  revalidatePath(`/boards/${boardSlug}/automation`);
  revalidatePath(`/boards/${boardSlug}`);
}

export async function toggleAutomation(
  id: string,
  enabled: boolean,
  boardSlug: string
) {
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('board_automations').update({ enabled }).eq('id', id);
  revalidatePath(`/boards/${boardSlug}/automation`);
  revalidatePath(`/boards/${boardSlug}`);
}
