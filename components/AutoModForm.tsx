'use client';
import { useState, useTransition } from 'react';
import { updateAutoModConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';

type Props = {
  guildId: string;
  initial: {
    enabled: boolean;
    blockLinks: boolean;
    linkAllowlist: string[];
    maxCapsPct: number | null;
    maxMentions: number | null;
    bannedWords: string[];
  };
};

export function AutoModForm({ guildId, initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [blockLinks, setBlockLinks] = useState(initial.blockLinks);
  const [capsEnabled, setCapsEnabled] = useState(initial.maxCapsPct !== null);
  const [mentionsEnabled, setMentionsEnabled] = useState(initial.maxMentions !== null);
  const [bannedWordsText, setBannedWordsText] = useState(initial.bannedWords.join('\n'));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const submit = (formData: FormData) => {
    setMsg(null);
    startTransition(async () => {
      const res = await updateAutoModConfig(guildId, formData);
      if (res.ok) setMsg({ kind: 'ok', text: 'Gespeichert.' });
      else setMsg({ kind: 'err', text: res.error ?? 'Fehler.' });
    });
  };

  const bannedWordsCount = bannedWordsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean).length;
  const activeFilters = [
    blockLinks,
    capsEnabled,
    mentionsEnabled,
    bannedWordsCount > 0,
  ].filter(Boolean).length;

  return (
    <form action={submit} className="space-y-5">
      <div className="flex items-center justify-between rounded-md border border-line bg-elev/40 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-fg">AutoMod aktiv</span>
            {enabled && (
              <span className="text-[10px] font-mono uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
                {activeFilters} Filter
              </span>
            )}
          </div>
          <div className="text-[11px] text-subtle mt-0.5">
            Moderatoren (Manage Messages) werden nie gefiltert.
          </div>
        </div>
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="sr-only"
        />
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
            enabled ? 'bg-accent border-accent' : 'bg-elev border-line-strong'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className={enabled ? 'space-y-4' : 'space-y-4 opacity-60 pointer-events-none'}>
        <FilterCard
          title="Link-Filter"
          icon="🔗"
          active={blockLinks}
          summary={blockLinks ? 'Links blockiert (außer Whitelist)' : 'Aus'}
        >
          <label className="flex items-center gap-2 text-sm text-fg-soft cursor-pointer">
            <input
              type="checkbox"
              name="block_links"
              checked={blockLinks}
              onChange={(e) => setBlockLinks(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Alle Links blockieren (außer Whitelist)
          </label>
          {blockLinks && (
            <div className="mt-3">
              <label className="block text-[11px] text-subtle mb-1">
                Whitelist (eine Domain pro Zeile)
              </label>
              <textarea
                name="link_allowlist"
                rows={3}
                defaultValue={initial.linkAllowlist.join('\n')}
                placeholder={'youtube.com\ngithub.com\nkanbanly.de'}
                className="w-full rounded-md bg-surface border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent font-mono"
              />
              <p className="text-[11px] text-subtle mt-1">
                Subdomains werden mit gematcht (z. B. erlaubt „youtube.com&quot; auch
                „www.youtube.com&quot;).
              </p>
            </div>
          )}
        </FilterCard>

        <FilterCard
          title="Caps-Filter"
          icon="🔠"
          active={capsEnabled}
          summary={capsEnabled ? 'Großbuchstaben begrenzt' : 'Aus'}
        >
          <label className="flex items-center gap-2 text-sm text-fg-soft cursor-pointer">
            <input
              type="checkbox"
              checked={capsEnabled}
              onChange={(e) => setCapsEnabled(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Aktiv — bei Messages ≥ 10 Zeichen
          </label>
          {capsEnabled && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-muted">Max</span>
              <input
                type="number"
                name="max_caps_pct"
                min="50"
                max="100"
                defaultValue={initial.maxCapsPct ?? 70}
                className="w-20 rounded-md bg-surface border border-line-strong px-2 py-1 text-sm text-fg"
              />
              <span className="text-xs text-muted">% Großbuchstaben</span>
            </div>
          )}
          {!capsEnabled && <input type="hidden" name="max_caps_pct" value="" />}
        </FilterCard>

        <FilterCard
          title="Mention-Spam"
          icon="📣"
          active={mentionsEnabled}
          summary={mentionsEnabled ? 'Mention-Limit aktiv' : 'Aus'}
        >
          <label className="flex items-center gap-2 text-sm text-fg-soft cursor-pointer">
            <input
              type="checkbox"
              checked={mentionsEnabled}
              onChange={(e) => setMentionsEnabled(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Aktiv — User-Mentions pro Nachricht begrenzen
          </label>
          {mentionsEnabled && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-muted">Max</span>
              <input
                type="number"
                name="max_mentions"
                min="1"
                max="50"
                defaultValue={initial.maxMentions ?? 5}
                className="w-20 rounded-md bg-surface border border-line-strong px-2 py-1 text-sm text-fg"
              />
              <span className="text-xs text-muted">User-Mentions</span>
            </div>
          )}
          {!mentionsEnabled && <input type="hidden" name="max_mentions" value="" />}
        </FilterCard>

        <FilterCard
          title="Verbotene Wörter"
          icon="🚫"
          active={bannedWordsCount > 0}
          summary={
            bannedWordsCount > 0
              ? `${bannedWordsCount} Wort${bannedWordsCount === 1 ? '' : 'e'}`
              : 'Aus'
          }
        >
          <textarea
            name="banned_words"
            rows={4}
            value={bannedWordsText}
            onChange={(e) => setBannedWordsText(e.target.value)}
            placeholder={'spam\ndiscord.gg/scam'}
            className="w-full rounded-md bg-surface border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent font-mono"
          />
          <p className="text-[11px] text-subtle mt-1">
            Ein Eintrag pro Zeile. Match ist case-insensitive auf Wort-Grenzen
            (kein Teil-Match in anderen Wörtern).
          </p>
        </FilterCard>
      </div>

      <div className="flex items-center gap-3 border-t border-line pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors disabled:opacity-50"
        >
          {pending ? 'Speichert…' : 'Speichern'}
        </button>
        {msg && (
          <span
            className={`text-xs ${
              msg.kind === 'ok'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {msg.text}
          </span>
        )}
      </div>

      <p className="text-[11px] text-subtle">
        Bei Treffer wird die Nachricht gelöscht und der User per DM informiert.
      </p>
    </form>
  );
}

function FilterCard({
  title,
  icon,
  active,
  summary,
  children,
}: {
  title: string;
  icon: string;
  active: boolean;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-md border bg-elev/40 transition-colors ${
        active ? 'border-emerald-500/30' : 'border-line'
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none" aria-hidden>
            {icon}
          </span>
          <span className="text-sm font-medium text-fg">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              active ? 'bg-emerald-500' : 'bg-muted/40'
            }`}
          />
          <span className="text-[11px] text-subtle">{summary}</span>
        </div>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}
