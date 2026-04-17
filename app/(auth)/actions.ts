'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/') || '/';

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect(next.startsWith('/') ? next : '/');
}

const USERNAME_RE = /^[a-z0-9_-]{3,20}$/;

export async function register(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const username = String(formData.get('username') ?? '').trim().toLowerCase();

  if (!USERNAME_RE.test(username)) {
    redirect(
      `/register?error=${encodeURIComponent(
        'Benutzername: 3–20 Zeichen, nur a–z, 0–9, _ und -'
      )}`
    );
  }

  const supabase = await createClient();

  const { data: taken } = await supabase.rpc('username_exists', {
    u: username,
  });
  if (taken) {
    redirect(
      `/register?error=${encodeURIComponent('Benutzername ist bereits vergeben')}`
    );
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${siteUrl()}/auth/confirm`,
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }
  redirect('/register?sent=1');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
