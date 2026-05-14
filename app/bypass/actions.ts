'use server';

import { SUPPORTED_HOSTS } from './hosts';

export type BypassActionResult =
  | { ok: true; original: string; destination: string }
  | { ok: false; error: string; hint?: string };

type BypassResponse = {
  status?: string;
  destination?: string;
  result?: string;
  url?: string;
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

export async function bypassUrl(input: string): Promise<BypassActionResult> {
  const parsed = parseUrl(input);
  if (!parsed) {
    return {
      ok: false,
      error: 'Das sieht nicht nach einer gültigen URL aus.',
      hint: 'Die URL muss mit http:// oder https:// beginnen.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(
      `https://api.bypass.vip/bypass?url=${encodeURIComponent(parsed.toString())}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'kanbanly-bypass/1.0 (+https://kanbanly.de/bypass)' },
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      return { ok: false, error: `Der Bypass-Service antwortete mit HTTP ${res.status}.` };
    }
    const json = (await res.json()) as BypassResponse;
    const dest = json.destination ?? json.result ?? json.url;
    if (json.status && json.status.toLowerCase() !== 'success' && !dest) {
      const hostSupported = SUPPORTED_HOSTS.some((d) => parsed.hostname.endsWith(d));
      return {
        ok: false,
        error: json.message ?? json.error ?? 'Bypass fehlgeschlagen.',
        hint: hostSupported
          ? undefined
          : `${parsed.hostname} ist evtl. nicht unterstützt.`,
      };
    }
    if (!dest) {
      return { ok: false, error: 'Der Bypass-Service hat kein Ziel zurückgegeben.' };
    }
    // bypass.vip retourniert seit 2026 Shutdown-Werbung als „Ziel" für die
    // kostenlose API. Abfangen, sonst landet das im Ergebnis.
    const looksLikeShutdownNotice =
      /shut\s*down|leechers|join here|working bypasses|bypass\.vip\/discord/i.test(dest);
    if (looksLikeShutdownNotice || !parseUrl(dest)) {
      return {
        ok: false,
        error: 'Die Free-API von bypass.vip ist abgeschaltet.',
        hint: 'Aktuell gibt es keinen kostenlosen Bypass-Provider, der zuverlässig läuft. Wir suchen einen Ersatz.',
      };
    }
    return { ok: true, original: parsed.toString(), destination: dest };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { ok: false, error: 'Timeout — der Bypass-Service ist gerade nicht erreichbar (15s).' };
    }
    return { ok: false, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

