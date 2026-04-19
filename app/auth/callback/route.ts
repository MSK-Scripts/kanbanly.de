import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

function safeNext(next: string): string {
  if (!next.startsWith('/')) return '/dashboard';
  if (next.startsWith('//') || next.startsWith('/\\')) return '/dashboard';
  return next;
}

export async function GET(request: NextRequest) {
  const base = siteBase();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next') ?? '/dashboard');
  const errorDescription = searchParams.get('error_description');

  if (errorDescription) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(errorDescription)}`,
        base
      )
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=Kein+Code+empfangen', base)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, base)
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle();
    const hasUsername =
      !!(profile as { username?: string | null } | null)?.username;
    if (!hasUsername) {
      return NextResponse.redirect(
        new URL(`/register/username?next=${encodeURIComponent(next)}`, base)
      );
    }
  }

  return NextResponse.redirect(new URL(next, base));
}
