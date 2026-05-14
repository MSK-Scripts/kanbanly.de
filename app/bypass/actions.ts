'use server';

import { SUPPORTED_HOSTS } from './hosts';

export type BypassActionResult =
  | { ok: true; original: string; destination: string; via: string }
  | { ok: false; error: string; hint?: string };

type ProviderRaw = {
  status?: string;
  destination?: string;
  result?: string;
  url?: string;
  bypassed?: string;
  message?: string;
  error?: string;
};

function parseUrl(input: string): URL | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

// Werbe-/Shutdown-Texte, die manche „Free"-APIs als angebliches Ziel zurückliefern.
function isJunkDestination(dest: string): boolean {
  if (!parseUrl(dest)) return true;
  return /shut\s*down|leechers|join here for working|bypass\.vip\/discord|premium\s+required|api\s+disabled/i.test(
    dest,
  );
}

type Provider = {
  name: string;
  /** Liefert die Ziel-URL oder null/throws im Fehlerfall. */
  call: (input: string, signal: AbortSignal) => Promise<string | null>;
};

// Die kostenlose Bypass-Landschaft ist instabil — wir probieren mehrere
// Endpunkte hintereinander. Erster erfolgreicher gewinnt. Custom Endpunkte
// können per BYPASS_API_URLS (pipe-separated) ergänzt werden.
function buildProviders(): Provider[] {
  const list: Provider[] = [
    {
      name: 'bypass.vip',
      call: async (input, signal) => {
        const res = await fetch(
          `https://api.bypass.vip/bypass?url=${encodeURIComponent(input)}`,
          {
            signal,
            headers: { 'User-Agent': 'kanbanly-bypass/1.0' },
            cache: 'no-store',
          },
        );
        if (!res.ok) return null;
        const j = (await res.json().catch(() => null)) as ProviderRaw | null;
        return j?.destination ?? j?.result ?? j?.url ?? j?.bypassed ?? null;
      },
    },
    {
      name: 'bypass.city',
      call: async (input, signal) => {
        const res = await fetch(
          `https://api.bypass.city/bypass?url=${encodeURIComponent(input)}`,
          {
            signal,
            headers: { 'User-Agent': 'kanbanly-bypass/1.0' },
            cache: 'no-store',
          },
        );
        if (!res.ok) return null;
        const j = (await res.json().catch(() => null)) as ProviderRaw | null;
        return j?.destination ?? j?.result ?? j?.url ?? null;
      },
    },
    {
      name: 'adbypass',
      call: async (input, signal) => {
        const res = await fetch(
          `https://api.adbypass.org/api/v1/bypass?url=${encodeURIComponent(input)}`,
          {
            signal,
            headers: { 'User-Agent': 'kanbanly-bypass/1.0' },
            cache: 'no-store',
          },
        );
        if (!res.ok) return null;
        const j = (await res.json().catch(() => null)) as ProviderRaw | null;
        return j?.destination ?? j?.url ?? null;
      },
    },
  ];

  // Custom Endpoints — Format: BYPASS_API_URLS=name1|template1,name2|template2
  // Templates verwenden {url} als Platzhalter für die URL-encoded Quelle.
  const extra = process.env.BYPASS_API_URLS;
  if (extra) {
    for (const entry of extra.split(',')) {
      const [name, tpl] = entry.split('|');
      if (!name || !tpl || !tpl.includes('{url}')) continue;
      list.push({
        name: name.trim(),
        call: async (input, signal) => {
          const url = tpl.trim().replace('{url}', encodeURIComponent(input));
          const res = await fetch(url, {
            signal,
            headers: { 'User-Agent': 'kanbanly-bypass/1.0' },
            cache: 'no-store',
          });
          if (!res.ok) return null;
          const j = (await res.json().catch(() => null)) as ProviderRaw | null;
          return j?.destination ?? j?.result ?? j?.url ?? null;
        },
      });
    }
  }

  return list;
}

export async function bypassUrl(input: string): Promise<BypassActionResult> {
  const parsed = parseUrl(input);
  if (!parsed) {
    return {
      ok: false,
      error: 'Das sieht nicht nach einer gültigen URL aus.',
      hint: 'Die URL muss mit http:// oder https:// beginnen.',
    };
  }
  const target = parsed.toString();

  const providers = buildProviders();
  const tried: string[] = [];
  for (const p of providers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const dest = await p.call(target, controller.signal);
      if (dest && !isJunkDestination(dest)) {
        clearTimeout(timer);
        return { ok: true, original: target, destination: dest, via: p.name };
      }
      tried.push(p.name);
    } catch {
      tried.push(p.name);
    } finally {
      clearTimeout(timer);
    }
  }

  const hostSupported = SUPPORTED_HOSTS.some((d) => parsed.hostname.endsWith(d));
  return {
    ok: false,
    error:
      tried.length > 0
        ? `Keiner der Bypass-Provider hat geantwortet (versucht: ${tried.join(', ')}).`
        : 'Keine Bypass-Provider konfiguriert.',
    hint: hostSupported
      ? 'Die kostenlosen Bypass-APIs sind aktuell instabil — bitte später erneut versuchen.'
      : `${parsed.hostname} ist evtl. nicht unterstützt.`,
  };
}
