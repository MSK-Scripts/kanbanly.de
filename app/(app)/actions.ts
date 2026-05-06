'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { slugify, withRandomSuffix } from '@/lib/slug';

async function insertWithUniqueSlug<T extends { id: string; slug: string }>(
  supabase: SupabaseClient,
  table: 'workspaces' | 'boards',
  row: Record<string, unknown>,
  baseSlug: string
): Promise<{ data: T | null; error: unknown }> {
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from(table)
      .insert({ ...row, slug })
      .select('id, slug')
      .single();
    if (!error) return { data: data as T, error: null };
    const isUniqueViolation =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505';
    if (!isUniqueViolation) return { data: null, error };
    slug = withRandomSuffix(baseSlug);
  }
  return { data: null, error: new Error('slug_exhausted') };
}

export async function renameWorkspace(id: string, name: string) {
  const trimmed = name.trim();
  if (!id || !trimmed) return;
  const supabase = await createClient();
  await supabase.from('workspaces').update({ name: trimmed }).eq('id', id);
  revalidatePath('/dashboard');
}

export async function renameBoard(id: string, name: string) {
  const trimmed = name.trim();
  if (!id || !trimmed) return;
  const supabase = await createClient();
  await supabase.from('boards').update({ name: trimmed }).eq('id', id);
  revalidatePath('/dashboard');
}

export async function deleteBoard(id: string) {
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('boards').delete().eq('id', id);
  revalidatePath('/dashboard');
}

export async function deleteWorkspace(id: string) {
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('workspaces').delete().eq('id', id);
  revalidatePath('/dashboard');
}

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/dashboard?error=Name%20fehlt');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await insertWithUniqueSlug(
    supabase,
    'workspaces',
    { name, owner_id: user.id },
    slugify(name)
  );

  if (error) {
    const msg =
      error instanceof Error ? error.message : 'Workspace konnte nicht erstellt werden';
    redirect(`/dashboard?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function createBoard(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const workspace_id = String(formData.get('workspace_id') ?? '');
  if (!name || !workspace_id)
    redirect('/dashboard?error=Board-Daten%20unvollständig');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await insertWithUniqueSlug(
    supabase,
    'boards',
    { name, workspace_id, created_by: user.id },
    slugify(name)
  );

  if (error || !data) {
    const msg =
      error instanceof Error ? error.message : 'Board konnte nicht erstellt werden';
    redirect(`/dashboard?error=${encodeURIComponent(msg)}`);
  }

  const defaultLists = [
    { board_id: data.id, title: 'To do', position: 0 },
    { board_id: data.id, title: 'In Arbeit', position: 1 },
    { board_id: data.id, title: 'Erledigt', position: 2 },
  ];
  const { error: listsError } = await supabase
    .from('lists')
    .insert(defaultLists);
  if (listsError) console.error('createBoard defaultLists', listsError);

  revalidatePath('/dashboard');
  redirect(`/boards/${data.slug}`);
}

export async function restoreCard(cardId: string, boardSlug: string) {
  if (!cardId) return;
  const supabase = await createClient();
  const { data: card } = await supabase
    .from('cards')
    .select('list_id')
    .eq('id', cardId)
    .maybeSingle();
  if (!card) return;

  const { count } = await supabase
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('list_id', card.list_id)
    .is('archived_at', null);

  await supabase
    .from('cards')
    .update({ archived_at: null, position: count ?? 0 })
    .eq('id', cardId);
  revalidatePath(`/boards/${boardSlug}/archiv`);
  revalidatePath(`/boards/${boardSlug}`);
}

export async function permanentlyDeleteCard(cardId: string, boardSlug: string) {
  if (!cardId) return;
  const supabase = await createClient();
  await supabase.from('cards').delete().eq('id', cardId);
  revalidatePath(`/boards/${boardSlug}/archiv`);
}

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

export async function renameUsername(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const next = String(formData.get('username') ?? '').trim();
  if (!USERNAME_RE.test(next)) {
    return {
      ok: false,
      error: '3–20 Zeichen, nur Buchstaben, Ziffern, _ und -.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet.' };

  const { data: current } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  const cur = (current as { username: string | null } | null)?.username;
  if (cur && cur === next) return { ok: true };
  // Case-insensitive: gleicher Name nur Schreibweise ändern → erlaubt.
  if (cur && cur.toLowerCase() !== next.toLowerCase()) {
    const { data: taken } = await supabase.rpc('username_exists', { u: next });
    if (taken === true) {
      return { ok: false, error: 'Benutzername ist schon vergeben.' };
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ username: next })
    .eq('id', user.id);
  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Benutzername ist schon vergeben.' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/einstellungen');
  revalidatePath('/dashboard');
  return { ok: true };
}
