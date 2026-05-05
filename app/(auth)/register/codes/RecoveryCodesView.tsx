'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { consumeOneTimeCodes } from '../../actions';

export function RecoveryCodesView({ codes }: { codes: string[] }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const joined = codes.join('\n');

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(joined);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const download = () => {
    const blob = new Blob(
      [
        `kanbanly Recovery-Codes\n` +
          `Erstellt am ${new Date().toLocaleString('de-DE')}\n\n` +
          `Jeden Code kannst du genau einmal nutzen, um dein Passwort\n` +
          `zurückzusetzen. Bewahre sie sicher auf.\n\n` +
          codes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
          '\n',
      ],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kanbanly-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const proceed = () => {
    startTransition(async () => {
      await consumeOneTimeCodes();
      router.replace('/dashboard');
    });
  };

  return (
    <div className="rounded-md bg-surface border border-line p-6 shadow-md">
      <h2 className="text-xl font-semibold text-fg mb-1">
        Deine Recovery-Codes
      </h2>
      <p className="text-sm text-muted mb-4">
        Ohne E-Mail-Bestätigung musst du diese Codes selbst aufbewahren. Sie
        sind das einzige, womit du dein Passwort zurücksetzen kannst.
      </p>

      <div className="mb-4 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs px-3 py-2">
        Speichere die Codes jetzt. Nach dem Weiter siehst du sie nie wieder.
        Jeder Code gilt genau einmal.
      </div>

      <div className="grid grid-cols-2 gap-2 font-mono text-sm tabular-nums mb-4">
        {codes.map((c, i) => (
          <div
            key={i}
            className="rounded-md bg-elev border border-line-strong px-3 py-2 text-fg text-center tracking-wider"
          >
            {c}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={copyAll}
          className="flex-1 rounded-md border border-line-strong hover:border-fg-soft bg-elev hover:bg-elev text-fg-soft hover:text-fg text-xs px-3 py-2 transition-colors"
        >
          {copied ? 'Kopiert ✓' : 'Alle kopieren'}
        </button>
        <button
          type="button"
          onClick={download}
          className="flex-1 rounded-md border border-line-strong hover:border-fg-soft bg-elev hover:bg-elev text-fg-soft hover:text-fg text-xs px-3 py-2 transition-colors"
        >
          Als .txt speichern
        </button>
      </div>

      <label className="flex items-start gap-2 cursor-pointer mb-4">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-accent"
        />
        <span className="text-xs text-fg-soft">
          Ich habe die Codes sicher aufbewahrt. Mir ist klar, dass ich ohne sie
          mein Passwort nicht mehr zurücksetzen kann.
        </span>
      </label>

      <button
        type="button"
        disabled={!confirmed || isPending}
        onClick={proceed}
        className="w-full rounded-md bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 transition-colors"
      >
        {isPending ? 'Einen Moment…' : 'Weiter zum Dashboard'}
      </button>
    </div>
  );
}
