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

  return (
    <form action={submit} className="space-y-5">
      <label className="flex items-center gap-2 text-sm text-fg-soft cursor-pointer">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        AutoMod aktiv (Moderatoren mit „Nachrichten verwalten&quot; werden nie gefiltert)
      </label>

      <fieldset className="border-t border-line pt-4">
        <legend className="text-xs text-muted">Link-Filter</legend>
        <label className="flex items-center gap-2 text-sm text-fg-soft cursor-pointer mt-2">
          <input
            type="checkbox"
            name="block_links"
            checked={blockLinks}
            onChange={(e) => setBlockLinks(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Alle Links blockieren (außer Whitelist)
        </label>
        <textarea
          name="link_allowlist"
          rows={3}
          defaultValue={initial.linkAllowlist.join('\n')}
          placeholder={'youtube.com\ngithub.com\nkanbanly.de'}
          className="w-full mt-2 rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent font-mono"
        />
        <p className="text-[11px] text-subtle mt-1">
          Eine Domain pro Zeile. Subdomains werden mit gematcht (z. B.
          erlaubt „youtube.com&quot; auch „www.youtube.com&quot;).
        </p>
      </fieldset>

      <fieldset className="border-t border-line pt-4">
        <legend className="text-xs text-muted">Caps-Filter (Großbuchstaben)</legend>
        <label className="flex items-center gap-2 text-sm text-fg-soft cursor-pointer mt-2">
          <input
            type="checkbox"
            checked={capsEnabled}
            onChange={(e) => setCapsEnabled(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Aktiv
        </label>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted">Max</span>
          <input
            type="number"
            name="max_caps_pct"
            min="50"
            max="100"
            defaultValue={initial.maxCapsPct ?? 70}
            disabled={!capsEnabled}
            className="w-20 rounded-md bg-elev border border-line-strong px-2 py-1 text-sm text-fg disabled:opacity-50"
          />
          <span className="text-xs text-muted">
            % Großbuchstaben (nur bei Messages ≥ 10 Zeichen)
          </span>
        </div>
        {!capsEnabled && (
          <input type="hidden" name="max_caps_pct" value="" />
        )}
      </fieldset>

      <fieldset className="border-t border-line pt-4">
        <legend className="text-xs text-muted">Mention-Spam</legend>
        <label className="flex items-center gap-2 text-sm text-fg-soft cursor-pointer mt-2">
          <input
            type="checkbox"
            checked={mentionsEnabled}
            onChange={(e) => setMentionsEnabled(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Aktiv
        </label>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted">Max</span>
          <input
            type="number"
            name="max_mentions"
            min="1"
            max="50"
            defaultValue={initial.maxMentions ?? 5}
            disabled={!mentionsEnabled}
            className="w-20 rounded-md bg-elev border border-line-strong px-2 py-1 text-sm text-fg disabled:opacity-50"
          />
          <span className="text-xs text-muted">User-Mentions pro Nachricht</span>
        </div>
        {!mentionsEnabled && (
          <input type="hidden" name="max_mentions" value="" />
        )}
      </fieldset>

      <fieldset className="border-t border-line pt-4">
        <legend className="text-xs text-muted">Verbotene Wörter</legend>
        <textarea
          name="banned_words"
          rows={4}
          defaultValue={initial.bannedWords.join('\n')}
          placeholder={'spam\ndiscord.gg/scam'}
          className="w-full mt-2 rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent font-mono"
        />
        <p className="text-[11px] text-subtle mt-1">
          Ein Eintrag pro Zeile. Match ist case-insensitive auf Wort-Grenzen
          (kein Teil-Match in anderen Wörtern).
        </p>
      </fieldset>

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
        Hierarchie: Mods (ManageMessages-Permission) werden nie gefiltert.
      </p>
    </form>
  );
}
