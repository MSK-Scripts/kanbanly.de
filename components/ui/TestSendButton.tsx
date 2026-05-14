'use client';

import { useTransition } from 'react';
import { Button } from './Button';
import { toast } from '@/store/toastStore';

type Props = {
  onSend: () => Promise<{ ok: boolean; error?: string }>;
  label?: string;
  size?: 'sm' | 'md';
  successMsg?: string;
};

export function TestSendButton({
  onSend,
  label = 'Test senden',
  size = 'sm',
  successMsg = 'Test-Embed gepostet',
}: Props) {
  const [pending, startTransition] = useTransition();
  const onClick = () => {
    startTransition(async () => {
      const r = await onSend();
      if (r.ok) toast.success(successMsg);
      else toast.error('Konnte nicht senden', r.error);
    });
  };
  return (
    <Button type="button" size={size} variant="secondary" onClick={onClick} loading={pending}>
      {label}
    </Button>
  );
}
