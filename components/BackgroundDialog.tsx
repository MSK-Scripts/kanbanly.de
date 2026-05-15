'use client';
import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useBoard } from '@/store/boardStore';
import { useMounted } from '@/lib/useMounted';
import { safeHttpUrl } from '@/lib/safeUrl';

type Props = {
  onClose: () => void;
};

const PRESETS: Array<{ label: string; url: string }> = [
  {
    label: 'Lila Welle',
    url: 'https://images.unsplash.com/photo-1557682257-2f9c37a3a5f3?w=1920&q=80',
  },
  {
    label: 'Sternennacht',
    url: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=1920&q=80',
  },
  {
    label: 'Bergsee',
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
  },
  {
    label: 'Studio-Matt',
    url: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1920&q=80',
  },
];

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function BackgroundDialog({ onClose }: Props) {
  const mounted = useMounted();
  const current = useBoard((s) => s.backgroundUrl);
  const update = useBoard((s) => s.updateBoardBackground);
  const [input, setInput] = useState(current ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  const preview = input.trim();
  const previewSrc = safeHttpUrl(preview);

  const save = () => {
    setError(null);
    const trimmed = input.trim();
    if (trimmed && !isValidHttpUrl(trimmed)) {
      setError('Das ist keine gültige http(s)-URL.');
      return;
    }
    startTransition(async () => {
      await update(trimmed || null);
      onClose();
    });
  };

  const clear = () => {
    startTransition(async () => {
      await update(null);
      onClose();
    });
  };

  const applyPreset = (url: string) => {
    setInput(url);
    setError(null);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-md bg-surface border border-line shadow-md flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-fg">
              Board-Hintergrund
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Füge einen Bildlink ein — alle Board-Mitglieder sehen das gleiche
              Bild.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="text-subtle hover:text-fg-soft text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="bg-url">
              Bild-URL
            </label>
            <input
              id="bg-url"
              type="url"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-1.5 text-xs font-mono text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
            />
            <p className="text-[11px] text-subtle mt-1 leading-relaxed">
              Tipp: Unsplash, eigener CDN, oder öffentliche Bild-URLs. Bild
              bleibt bei Unsplash/CDN gehostet — kein Upload nötig.
            </p>
          </div>

          <div>
            <p className="text-[11px] text-muted mb-1.5">Vorschläge</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.url}
                  type="button"
                  onClick={() => applyPreset(p.url)}
                  className={`relative aspect-video rounded-md overflow-hidden border transition-colors ${
                    input === p.url
                      ? 'border-accent-hover ring-2 ring-accent-hover/50'
                      : 'border-line-strong hover:border-fg-soft'
                  }`}
                  title={p.label}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.label}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>

          {previewSrc && (
            <div>
              <p className="text-[11px] text-muted mb-1.5">Vorschau</p>
              <div className="aspect-video rounded-md overflow-hidden border border-line-strong">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc}
                  alt="Vorschau"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-line flex gap-2 shrink-0">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex-1 rounded-md bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-xs font-medium py-2"
          >
            {pending ? 'Speichere…' : 'Speichern'}
          </button>
          {current && (
            <button
              type="button"
              onClick={clear}
              disabled={pending}
              className="rounded-md text-xs text-muted hover:text-rose-600 dark:hover:text-rose-300 px-3 py-2 disabled:opacity-50"
            >
              Entfernen
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
