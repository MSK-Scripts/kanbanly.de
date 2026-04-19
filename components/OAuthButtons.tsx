'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Provider = 'github' | 'discord';

export function OAuthButtons() {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (provider: Provider) => {
    setError(null);
    setPending(provider);
    const supabase = createClient();
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_SITE_URL ?? '');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setPending(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 my-4">
        <div className="flex-1 h-px bg-line" />
        <span className="text-[10px] text-subtle uppercase tracking-wide">
          oder
        </span>
        <div className="flex-1 h-px bg-line" />
      </div>
      {error && (
        <div className="mb-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs px-3 py-2">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => signIn('github')}
          disabled={pending !== null}
          className="flex items-center justify-center gap-2 rounded-lg border border-line-strong hover:border-fg-soft bg-elev/60 hover:bg-elev text-fg-soft hover:text-fg text-xs font-medium py-2 transition-colors disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
            <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.8 10.9.6.1.8-.2.8-.6v-2.2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2.9-.3 2-.4 3-.4s2 .1 3 .4C17.1 4.6 18 4.9 18 4.9c.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.7-5.8 7.7-10.9C23.5 5.7 18.3.5 12 .5z" />
          </svg>
          {pending === 'github' ? 'Öffne…' : 'GitHub'}
        </button>
        <button
          type="button"
          onClick={() => signIn('discord')}
          disabled={pending !== null}
          className="flex items-center justify-center gap-2 rounded-lg border border-line-strong hover:border-fg-soft bg-elev/60 hover:bg-elev text-fg-soft hover:text-fg text-xs font-medium py-2 transition-colors disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
            <path d="M20.317 4.37A19.79 19.79 0 0 0 16.558 3c-.207.369-.449.865-.615 1.26a18.27 18.27 0 0 0-5.487 0A12.64 12.64 0 0 0 9.834 3 19.74 19.74 0 0 0 6.073 4.37C2.38 9.5 1.373 14.55 1.876 19.53a19.93 19.93 0 0 0 6.03 3c.487-.66.92-1.363 1.292-2.104a12.86 12.86 0 0 1-2.034-.971c.17-.125.337-.255.5-.388 4.096 1.898 8.53 1.898 12.57 0 .164.133.33.263.499.388-.65.385-1.33.711-2.036.972.374.741.806 1.443 1.292 2.103a19.9 19.9 0 0 0 6.032-3c.59-5.74-1.01-10.743-4.203-15.16zM8.02 16.4c-1.182 0-2.157-1.09-2.157-2.42s.956-2.42 2.157-2.42 2.177 1.09 2.157 2.42c0 1.33-.956 2.42-2.157 2.42zm7.963 0c-1.183 0-2.157-1.09-2.157-2.42s.956-2.42 2.157-2.42c1.2 0 2.177 1.09 2.156 2.42 0 1.33-.955 2.42-2.156 2.42z" />
          </svg>
          {pending === 'discord' ? 'Öffne…' : 'Discord'}
        </button>
      </div>
    </div>
  );
}
