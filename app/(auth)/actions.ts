'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeCode,
} from '@/lib/recoveryCodes';
import {
  translateAuthError,
  validateEmail,
  validatePassword,
  validateUsername,
} from '@/lib/authErrors';

const CODES_COOKIE = 'kanbanly_one_time_codes';

function redirectLogin(message: string, next?: string) {
  const params = new URLSearchParams({ error: message });
  if (next) params.set('next', next);
  redirect(`/login?${params.toString()}`);
}

function redirectRegister(message: string) {
  redirect(`/register?error=${encodeURIComponent(message)}`);
}

function redirectReset(message: string, email?: string) {
  const params = new URLSearchParams({ error: message });
  if (email) params.set('email', email);
  redirect(`/reset-password?${params.toString()}`);
}

function safeNext(next: string): string {
  if (!next.startsWith('/')) return '/dashboard';
  if (next.startsWith('//') || next.startsWith('/\\')) return '/dashboard';
  return next;
}

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next =
    String(formData.get('next') ?? '/dashboard') || '/dashboard';

  const emailError = validateEmail(email);
  if (emailError) redirectLogin(emailError, next);
  if (!password) redirectLogin('Bitte gib dein Passwort ein.', next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirectLogin(translateAuthError(error.message), next);
  }
  redirect(safeNext(next));
}

export async function register(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const username = String(formData.get('username') ?? '').trim();

  const usernameError = validateUsername(username);
  if (usernameError) redirectRegister(usernameError);

  const emailError = validateEmail(email);
  if (emailError) redirectRegister(emailError);

  const passwordError = validatePassword(password);
  if (passwordError) redirectRegister(passwordError);

  const supabase = await createClient();

  const { data: taken } = await supabase.rpc('username_exists', {
    u: username,
  });
  if (taken) {
    redirectRegister(
      `Der Benutzername „${username}" ist schon vergeben. Wähl einen anderen.`
    );
  }

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });

  if (createErr || !created.user) {
    redirectRegister(
      translateAuthError(createErr?.message ?? 'Unbekannter Fehler')
    );
  }

  const userId = created!.user!.id;
  const codes = generateRecoveryCodes(8);
  const rows = codes.map((c) => ({
    user_id: userId,
    code_hash: hashRecoveryCode(c),
  }));
  const { error: codesErr } = await admin.from('recovery_codes').insert(rows);
  if (codesErr) {
    console.error('register recovery_codes insert', codesErr);
  }

  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    redirectRegister(translateAuthError(signInErr.message));
  }

  const store = await cookies();
  store.set(CODES_COOKIE, JSON.stringify(codes), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  redirect('/register/codes');
}

export async function readOneTimeCodes(): Promise<string[] | null> {
  const store = await cookies();
  const raw = store.get(CODES_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((x) => typeof x === 'string')
    ) {
      return parsed as string[];
    }
  } catch {}
  return null;
}

export async function consumeOneTimeCodes() {
  const store = await cookies();
  store.delete(CODES_COOKIE);
}

export async function resetPassword(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const rawCode = String(formData.get('code') ?? '');
  const newPassword = String(formData.get('password') ?? '');

  const emailError = validateEmail(email);
  if (emailError) redirectReset(emailError, email);

  const code = normalizeCode(rawCode);
  if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code)) {
    redirectReset(
      'Code hat das falsche Format. Erwartet: XXXXX-XXXXX.',
      email
    );
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) redirectReset(passwordError, email);

  const supabase = await createClient();
  const { data: userId, error: redeemErr } = await supabase.rpc(
    'redeem_recovery_code',
    { p_email: email, p_code_hash: hashRecoveryCode(code) }
  );

  if (redeemErr) {
    redirectReset(
      'Konnte den Code nicht prüfen. Versuch es nochmal.',
      email
    );
  }

  if (!userId) {
    redirectReset(
      'E-Mail oder Code stimmen nicht (oder der Code wurde schon benutzt).',
      email
    );
  }

  const admin = createAdminClient();
  const { error: updateErr } = await admin.auth.admin.updateUserById(
    userId as string,
    { password: newPassword }
  );
  if (updateErr) {
    redirectReset(translateAuthError(updateErr.message), email);
  }

  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password: newPassword,
  });
  if (signInErr) {
    redirectLogin(
      'Passwort geändert — bitte melde dich mit dem neuen Passwort an.'
    );
  }

  redirect('/dashboard');
}

export async function regenerateRecoveryCodes(): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet.' };

  const admin = createAdminClient();
  await admin.from('recovery_codes').delete().eq('user_id', user.id);

  const codes = generateRecoveryCodes(8);
  const rows = codes.map((c) => ({
    user_id: user.id,
    code_hash: hashRecoveryCode(c),
  }));
  const { error } = await admin.from('recovery_codes').insert(rows);
  if (error) return { ok: false, error: error.message };

  const store = await cookies();
  store.set(CODES_COOKIE, JSON.stringify(codes), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return { ok: true };
}

export async function completeUsername(formData: FormData) {
  const username = String(formData.get('username') ?? '').trim();
  const next = safeNext(String(formData.get('next') ?? '/dashboard'));

  const usernameError = validateUsername(username);
  if (usernameError) {
    redirect(
      `/register/username?error=${encodeURIComponent(usernameError)}&next=${encodeURIComponent(next)}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: taken } = await supabase.rpc('username_exists', {
    u: username,
  });
  if (taken) {
    redirect(
      `/register/username?error=${encodeURIComponent(`Der Benutzername „${username}" ist schon vergeben.`)}&next=${encodeURIComponent(next)}`
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ username })
    .eq('id', user.id);
  if (error) {
    redirect(
      `/register/username?error=${encodeURIComponent(translateAuthError(error.message))}&next=${encodeURIComponent(next)}`
    );
  }

  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
