'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toggleCardSubscription } from '@/app/(app)/subscription-actions';

type Props = {
  cardId: string;
};

export function CardSubscribeButton({ cardId }: Props) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setSubscribed(false);
        return;
      }
      const { data } = await supabase
        .from('card_subscribers')
        .select('user_id')
        .eq('card_id', cardId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) setSubscribed(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const click = async () => {
    if (subscribed === null || busy) return;
    setBusy(true);
    const next = !subscribed;
    setSubscribed(next);
    const res = await toggleCardSubscription(cardId, next);
    setSubscribed(res.subscribed);
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={click}
      disabled={subscribed === null || busy}
      className={`text-xs px-2 py-1 rounded-md border transition-colors disabled:opacity-50 ${
        subscribed
          ? 'bg-accent/15 border-accent text-accent-soft'
          : 'border-line-strong text-fg-soft hover:bg-elev hover:text-fg'
      }`}
      title={subscribed ? 'Du wirst über Änderungen informiert.' : 'Auf Updates abonnieren'}
    >
      {subscribed === null
        ? '…'
        : subscribed
        ? '🔔 Abonniert'
        : '🔕 Abonnieren'}
    </button>
  );
}
