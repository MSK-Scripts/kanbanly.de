'use client';

import { useMemo, useState } from 'react';
import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';

type Props = {
  clientSecret: string;
  stripeAccountId: string;
  publishableKey: string;
};

export function CheckoutClient({ clientSecret, stripeAccountId, publishableKey }: Props) {
  // Stripe.js muss mit `stripeAccount` initialisiert werden — Connect Direct Charge.
  const stripePromise = useMemo<Promise<StripeJs | null>>(() => {
    if (!publishableKey) return Promise.resolve(null);
    return loadStripe(publishableKey, { stripeAccount: stripeAccountId });
  }, [publishableKey, stripeAccountId]);

  if (!publishableKey) {
    return (
      <div className="text-sm text-rose-500">
        Stripe Publishable Key fehlt — bitte beim Plattform-Betreiber melden.
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: 'night', labels: 'floating' },
      }}
    >
      <PaymentForm />
    </Elements>
  );
}

function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
    });
    if (stripeError) {
      setError(stripeError.message ?? 'Zahlung fehlgeschlagen.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <PaymentElement />
      {error && (
        <div className="text-sm text-rose-500 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full rounded-md bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-semibold px-4 py-3 transition-colors"
      >
        {submitting ? 'Verarbeitung…' : 'Jetzt bezahlen'}
      </button>
    </form>
  );
}
