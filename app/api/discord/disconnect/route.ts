import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));

  const admin = createAdminClient();
  await admin.from('bot_user_connections').delete().eq('user_id', user.id);

  return NextResponse.redirect(new URL('/integrations/discord', request.url), { status: 303 });
}
