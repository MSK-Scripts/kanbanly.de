'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function renameWorkspace(id: string, name: string) {
  const trimmed = name.trim();
  if (!id || !trimmed) return;
  const supabase = await createClient();
  await supabase.from('workspaces').update({ name: trimmed }).eq('id', id);
  revalidatePath('/');
  revalidatePath(`/workspaces/${id}`);
}

export async function renameBoard(id: string, name: string) {
  const trimmed = name.trim();
  if (!id || !trimmed) return;
  const supabase = await createClient();
  await supabase.from('boards').update({ name: trimmed }).eq('id', id);
  revalidatePath(`/boards/${id}`);
  revalidatePath('/');
}

export async function deleteBoard(id: string) {
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('boards').delete().eq('id', id);
  revalidatePath('/');
}

export async function deleteWorkspace(id: string) {
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('workspaces').delete().eq('id', id);
  revalidatePath('/');
}

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/?error=Name%20fehlt');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('workspaces')
    .insert({ name, owner_id: user.id });

  if (error) redirect(`/?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/');
  redirect('/');
}

export async function createBoard(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const workspace_id = String(formData.get('workspace_id') ?? '');
  if (!name || !workspace_id) redirect('/?error=Board-Daten%20unvollständig');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('boards')
    .insert({ name, workspace_id, created_by: user.id })
    .select('id')
    .single();

  if (error) redirect(`/?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/');
  redirect(`/boards/${data.id}`);
}
