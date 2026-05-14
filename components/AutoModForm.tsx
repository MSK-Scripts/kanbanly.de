'use client';
import { useState, useTransition } from 'react';
import { updateAutoModConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { FormSection } from './ui/FormSection';
import { StatusPill, StatusBanner } from './ui/Status';

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

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const res = await updateAutoModConfig(guildId, formData);
      if (res.ok) toast.success('AutoMod gespeichert');
      else toast.error('Speichern fehlgeschlagen', res.error);
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
      <FormSection
        title="AutoMod"
        description="Spam-, Link-, Caps- und Mention-Filter. Moderatoren (Manage Messages) werden nie gefiltert."
        badge={
          enabled ? (
            <StatusPill kind="success" dot>
              {activeFilters} Filter
            </StatusPill>
          ) : (
            <StatusPill kind="neutral" dot>
              Aus
            </StatusPill>
          )
        }
        action={
          <Switch checked={enabled} onChange={setEnabled} ariaLabel="AutoMod aktiv" />
        }
      >
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="sr-only"
        />

        <div
          className={enabled ? 'space-y-3' : 'space-y-3 opacity-50 pointer-events-none'}
        >
          <FilterCard
            title="Link-Filter"
            active={blockLinks}
            summary={blockLinks ? 'Links blockiert (außer Whitelist)' : 'Aus'}
          >
            <label className="flex items-center gap-2.5 text-[13.5px] text-fg-soft cursor-pointer">
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
              <div className="mt-3 pt-3 border-t border-line/60">
                <label className="block text-[11.5px] font-medium text-muted mb-1.5">
                  Whitelist (eine Domain pro Zeile)
                </label>
                <textarea
                  name="link_allowlist"
                  rows={3}
                  defaultValue={initial.linkAllowlist.join('\n')}
                  placeholder={'youtube.com\ngithub.com\nkanbanly.de'}
                  className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
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
            active={capsEnabled}
            summary={capsEnabled ? 'Großbuchstaben begrenzt' : 'Aus'}
          >
            <label className="flex items-center gap-2.5 text-[13.5px] text-fg-soft cursor-pointer">
              <input
                type="checkbox"
                checked={capsEnabled}
                onChange={(e) => setCapsEnabled(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Aktiv — bei Messages ≥ 10 Zeichen
            </label>
            {capsEnabled && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line/60">
                <span className="text-xs text-muted">Max</span>
                <input
                  type="number"
                  name="max_caps_pct"
                  min="50"
                  max="100"
                  defaultValue={initial.maxCapsPct ?? 70}
                  className="w-20 rounded-md bg-surface border border-line-strong px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                />
                <span className="text-xs text-muted">% Großbuchstaben</span>
              </div>
            )}
            {!capsEnabled && <input type="hidden" name="max_caps_pct" value="" />}
          </FilterCard>

          <FilterCard
            title="Mention-Spam"
            active={mentionsEnabled}
            summary={mentionsEnabled ? 'Mention-Limit aktiv' : 'Aus'}
          >
            <label className="flex items-center gap-2.5 text-[13.5px] text-fg-soft cursor-pointer">
              <input
                type="checkbox"
                checked={mentionsEnabled}
                onChange={(e) => setMentionsEnabled(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Aktiv — User-Mentions pro Nachricht begrenzen
            </label>
            {mentionsEnabled && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line/60">
                <span className="text-xs text-muted">Max</span>
                <input
                  type="number"
                  name="max_mentions"
                  min="1"
                  max="50"
                  defaultValue={initial.maxMentions ?? 5}
                  className="w-20 rounded-md bg-surface border border-line-strong px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                />
                <span className="text-xs text-muted">User-Mentions</span>
              </div>
            )}
            {!mentionsEnabled && <input type="hidden" name="max_mentions" value="" />}
          </FilterCard>

          <FilterCard
            title="Verbotene Wörter"
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
              className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
            <p className="text-[11px] text-subtle mt-1">
              Ein Eintrag pro Zeile. Match ist case-insensitive auf Wort-Grenzen
              (kein Teil-Match in anderen Wörtern).
            </p>
          </FilterCard>
        </div>
      </FormSection>

      <StatusBanner kind="info">
        Bei Treffer wird die Nachricht gelöscht und der User per DM informiert.
      </StatusBanner>

      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-bg/80 backdrop-blur-sm border-t border-line flex items-center justify-end">
        <Button type="submit" loading={pending} variant="primary">
          {pending ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}

function FilterCard({
  title,
  active,
  summary,
  children,
}: {
  title: string;
  active: boolean;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border bg-surface transition-colors overflow-hidden ${
        active ? 'border-[var(--success-line)]' : 'border-line'
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-line bg-elev/30">
        <span className="text-[13.5px] font-semibold text-fg">{title}</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              active ? 'bg-[var(--success)]' : 'bg-muted/40'
            }`}
          />
          <span
            className={`text-[11px] ${active ? 'text-[var(--success)]' : 'text-subtle'}`}
          >
            {summary}
          </span>
        </div>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}
