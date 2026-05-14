'use client';

import { useState, useTransition } from 'react';
import { bypassUrl, type BypassActionResult } from './actions';

export function BypassClient({ supportedHosts }: { supportedHosts: string[] }) {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<BypassActionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setResult(null);
    setCopied(false);
    startTransition(async () => {
      const res = await bypassUrl(url);
      setResult(res);
    });
  }

  async function copyDestination() {
    if (result?.ok) {
      try {
        await navigator.clipboard.writeText(result.destination);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-3">
        <label
          htmlFor="bypass-url"
          className="block text-sm font-medium text-fg"
        >
          Shortener-URL
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="bypass-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://linkvertise.com/…"
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-faint focus:outline-none focus:border-line-strong focus:ring-2 focus:ring-[#5865F2]/30"
            disabled={isPending}
          />
          <button
            type="submit"
            disabled={isPending || !url.trim()}
            className="rounded-lg bg-fg text-bg px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isPending ? 'Löse auf…' : 'Bypassen'}
          </button>
        </div>
      </form>

      {result?.ok && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted mb-1">
            Original
          </div>
          <div className="text-xs text-subtle font-mono break-all mb-3">
            {result.original}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted mb-1">
            Ziel
          </div>
          <div className="flex items-start gap-2">
            <a
              href={result.destination}
              target="_blank"
              rel="noopener noreferrer ugc"
              className="flex-1 text-sm text-[#5865F2] hover:underline break-all font-mono"
            >
              {result.destination}
            </a>
            <button
              type="button"
              onClick={copyDestination}
              className="shrink-0 rounded-md border border-line bg-elev px-2.5 py-1 text-[11px] text-muted hover:text-fg hover:border-line-strong transition-colors"
            >
              {copied ? 'Kopiert ✓' : 'Kopieren'}
            </button>
          </div>
        </div>
      )}

      {result && !result.ok && (
        <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-4">
          <div className="text-sm font-medium text-[var(--danger)] mb-1">
            Bypass fehlgeschlagen
          </div>
          <div className="text-xs text-fg">{result.error}</div>
          {result.hint && (
            <div className="text-xs text-muted mt-2">{result.hint}</div>
          )}
        </div>
      )}

      <details className="rounded-xl border border-line bg-surface p-4 text-sm">
        <summary className="cursor-pointer text-fg font-medium">
          Unterstützte Dienste
        </summary>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {supportedHosts.map((h) => (
            <span
              key={h}
              className="rounded-md bg-elev border border-line px-2 py-0.5 text-[11px] text-muted font-mono"
            >
              {h}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted">
          Liste ist nicht abschließend — der Bypass-Service unterstützt noch
          weitere Dienste. Probier es einfach aus.
        </p>
      </details>
    </div>
  );
}
