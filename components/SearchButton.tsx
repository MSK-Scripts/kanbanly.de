'use client';
import { useMounted } from '@/lib/useMounted';

function detectMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function SearchButton() {
  const mounted = useMounted();
  const isMac = mounted && detectMac();

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('open-palette'))}
      aria-label="Suche öffnen"
      className="hidden sm:flex items-center gap-2 rounded-md border border-line-strong hover:border-fg-soft bg-elev hover:bg-elev text-muted hover:text-fg text-xs px-2.5 py-1.5 transition-colors"
    >
      <span>Suche</span>
      <kbd className="text-[10px] font-mono border border-line-strong bg-bg px-1 rounded">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}
