'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type CreateInviteResult =
  | { ok: true; token: string; url: string }
  | { ok: false; error: string };

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export async function createInvite(
  _prev: CreateInviteResult | null,
  formData: FormData
): Promise<CreateInviteResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'editor');
  const board_id = String(formData.get('board_id') ?? '');

  if (!email || !board_id) {
    return { ok: false, error: 'E-Mail und Board-ID erforderlich.' };
  }
  if (!['viewer', 'editor', 'admin'].includes(role)) {
    return { ok: false, error: 'Ungültige Rolle.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet.' };

  const { data, error } = await supabase
    .from('invitations')
    .insert({ email, role, board_id, invited_by: user.id })
    .select('token')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Fehler beim Erstellen.' };
  }

  return {
    ok: true,
    token: data.token,
    url: `${siteUrl()}/invite/${data.token}`,
  };
}

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  if (!token) redirect('/login');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const { data, error } = await supabase.rpc('accept_invitation', { t: token });

  if (error) {
    redirect(
      `/invite/${token}?error=${encodeURIComponent(error.message)}`
    );
  }

  if (!data) redirect('/dashboard');

  const { data: board } = await supabase
    .from('boards')
    .select('slug')
    .eq('id', data)
    .maybeSingle();

  redirect(board?.slug ? `/boards/${board.slug}` : `/boards/${data}`);
}

export async function switchAccountForInvite(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
}

export async function updateBoardMemberRole(
  boardId: string,
  userId: string,
  role: 'viewer' | 'editor' | 'admin'
): Promise<{ ok: boolean; error?: string }> {
  if (!['viewer', 'editor', 'admin'].includes(role)) {
    return { ok: false, error: 'Ungültige Rolle.' };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('board_members')
    .update({ role })
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeBoardMember(
  boardId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('board_members')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function revokeInvite(
  inviteId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!inviteId) return { ok: false, error: 'Einladung fehlt.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', inviteId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function translateInviteError(raw: string): string {
  if (raw.includes('email_mismatch'))
    return 'Diese Einladung wurde an eine andere E-Mail-Adresse geschickt. Melde dich mit der Adresse an, an die die Einladung ging.';
  if (raw.includes('invitation_invalid_or_expired'))
    return 'Diese Einladung ist abgelaufen oder wurde widerrufen.';
  if (raw.includes('not_authenticated')) return 'Bitte melde dich an.';
  return raw;
}

export async function acceptInviteByToken(
  token: string
): Promise<{ ok: true; boardSlug: string | null } | { ok: false; error: string }> {
  if (!token) return { ok: false, error: 'Token fehlt.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet.' };

  const { data, error } = await supabase.rpc('accept_invitation', { t: token });
  if (error) return { ok: false, error: translateInviteError(error.message) };

  if (!data) return { ok: true, boardSlug: null };

  const { data: board } = await supabase
    .from('boards')
    .select('slug')
    .eq('id', data)
    .maybeSingle();
  return { ok: true, boardSlug: (board as { slug?: string } | null)?.slug ?? null };
}
