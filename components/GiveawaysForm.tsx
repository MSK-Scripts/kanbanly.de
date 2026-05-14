'use client';

import { useState, useTransition } from 'react';
import {
  createGiveawayFromWeb,
  endGiveawayFromWeb,
  rerollGiveawayFromWeb,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';
import { Button } from './ui/Button';
import { ColorPicker } from './ui/ColorPicker';
import { FormSection, FormRow } from './ui/FormSection';
import { StatusPill, StatusBanner } from './ui/Status';

type GwButtonStyle = 'primary' | 'secondary' | 'success' | 'danger';

const GW_BUTTON_STYLES: Array<{
  value: GwButtonStyle;
  label: string;
  classes: string;
}> = [
  { value: 'primary', label: 'Blurple', classes: 'bg-[#5865F2] text-white' },
  { value: 'secondary', label: 'Grau', classes: 'bg-[#4E5058] text-white' },
  { value: 'success', label: 'Grün', classes: 'bg-[#248046] text-white' },
  { value: 'danger', label: 'Rot', classes: 'bg-[#DA373C] text-white' },
];

type Giveaway = {
  id: string;
  channelId: string;
  messageId: string | null;
  prize: string;
  winnersCount: number;
  endsAt: string;
  ended: boolean;
  winnerUserIds: string[] | null;
  entriesCount: number;
};

type Props = {
  guildId: string;
  channels: { id: string; name: string }[];
  initial: Giveaway[];
};

const DURATION_PRESETS: Array<{ label: string; ms: number }> = [
  { label: '10 Min', ms: 10 * 60_000 },
  { label: '1 Stunde', ms: 60 * 60_000 },
  { label: '6 Stunden', ms: 6 * 60 * 60_000 },
  { label: '1 Tag', ms: 24 * 60 * 60_000 },
  { label: '3 Tage', ms: 3 * 24 * 60 * 60_000 },
  { label: '1 Woche', ms: 7 * 24 * 60 * 60_000 },
];

function relativeFromNow(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const m = Math.floor(abs / 60_000);
  if (m < 60) return diff > 0 ? `in ${m}min` : `vor ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return diff > 0 ? `in ${h}h` : `vor ${h}h`;
  const d = Math.floor(h / 24);
  return diff > 0 ? `in ${d}d` : `vor ${d}d`;
}

export function GiveawaysForm({ guildId, channels, initial }: Props) {
  const [giveaways, setGiveaways] = useState(initial);
  const [newPrize, setNewPrize] = useState('');
  const [newChannelId, setNewChannelId] = useState(channels[0]?.id ?? '');
  const [newWinners, setNewWinners] = useState(1);
  const [newDurationMs, setNewDurationMs] = useState(DURATION_PRESETS[1].ms);
  const [showDesign, setShowDesign] = useState(false);
  const [embedColor, setEmbedColor] = useState('#A855F7');
  const [embedTitle, setEmbedTitle] = useState('🎉  {prize}');
  const [embedDescription, setEmbedDescription] = useState(
    'Endet: {ends}\nGewinner: **{winners}**\nTeilnehmer: **{entries}**\n\nKlick auf den Button, um mitzumachen.',
  );
  const [buttonLabel, setButtonLabel] = useState('Teilnehmen');
  const [buttonEmoji, setButtonEmoji] = useState('🎉');
  const [buttonStyle, setButtonStyle] = useState<GwButtonStyle>('primary');
  const [pending, startTransition] = useTransition();

  const channelById = new Map(channels.map((c) => [c.id, c.name]));
  const active = giveaways.filter((g) => !g.ended);
  const ended = giveaways.filter((g) => g.ended);

  const create = () => {
    if (!newPrize.trim() || !newChannelId) return;
    const colorInt = /^#?[0-9a-f]{6}$/i.test(embedColor)
      ? parseInt(embedColor.replace('#', ''), 16)
      : null;
    startTransition(async () => {
      const r = await createGiveawayFromWeb(guildId, {
        prize: newPrize.trim(),
        channelId: newChannelId,
        winnersCount: newWinners,
        durationMs: newDurationMs,
        embedColor: colorInt,
        embedTitle: embedTitle.trim() || null,
        embedDescription: embedDescription.trim() || null,
        buttonLabel: buttonLabel.trim() || null,
        buttonEmoji: buttonEmoji.trim() || null,
        buttonStyle,
      });
      if (r.ok && r.id) {
        toast.success('Giveaway gestartet 🎉');
        setNewPrize('');
        // refresh
        setGiveaways((prev) => [
          {
            id: r.id!,
            channelId: newChannelId,
            messageId: null,
            prize: newPrize.trim(),
            winnersCount: newWinners,
            endsAt: new Date(Date.now() + newDurationMs).toISOString(),
            ended: false,
            winnerUserIds: null,
            entriesCount: 0,
          },
          ...prev,
        ]);
      } else {
        toast.error('Anlegen fehlgeschlagen', r.error);
      }
    });
  };

  const end = async (g: Giveaway) => {
    const ok = await confirm({
      title: 'Giveaway sofort beenden?',
      description: `„${g.prize}" wird beendet und Gewinner werden gezogen.`,
      confirmLabel: 'Beenden',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await endGiveawayFromWeb(guildId, g.id);
      if (r.ok) {
        toast.success('Giveaway endet in <30s');
        setGiveaways((prev) =>
          prev.map((x) =>
            x.id === g.id ? { ...x, endsAt: new Date().toISOString() } : x,
          ),
        );
      } else {
        toast.error('Beenden fehlgeschlagen', r.error);
      }
    });
  };

  const reroll = async (g: Giveaway) => {
    const ok = await confirm({
      title: 'Reroll?',
      description: `Neue Gewinner aus dem Pool von „${g.prize}" auslosen?`,
      confirmLabel: 'Reroll',
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await rerollGiveawayFromWeb(guildId, g.id);
      if (r.ok) {
        toast.success(`Reroll: ${r.winners?.length ?? 0} neue Gewinner`);
        setGiveaways((prev) =>
          prev.map((x) =>
            x.id === g.id ? { ...x, winnerUserIds: r.winners ?? [] } : x,
          ),
        );
      } else {
        toast.error('Reroll fehlgeschlagen', r.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      <FormSection
        title="Neues Giveaway"
        description="Prize, Channel, Gewinner-Anzahl und Dauer wählen. Der Bot postet das Embed mit Teilnehmen-Button."
      >
        <FormRow label="Preis / Prize" required>
          <input
            type="text"
            value={newPrize}
            onChange={(e) => setNewPrize(e.target.value.slice(0, 200))}
            placeholder="z.B. Discord Nitro Classic, Steam-Key, …"
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </FormRow>

        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Channel" required>
            <select
              value={newChannelId}
              onChange={(e) => setNewChannelId(e.target.value)}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            >
              <option value="">— wählen —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Gewinner">
            <input
              type="number"
              min={1}
              max={20}
              value={newWinners}
              onChange={(e) =>
                setNewWinners(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))
              }
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </FormRow>
        </div>

        <FormRow label="Dauer">
          <div className="flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map((p) => {
              const active = newDurationMs === p.ms;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setNewDurationMs(p.ms)}
                  className={`rounded-md border px-3 py-1.5 text-[12px] transition-all ${
                    active
                      ? 'bg-accent text-white border-accent'
                      : 'bg-elev text-fg-soft border-line-strong hover:border-accent/40'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </FormRow>

        <div className="rounded-lg border border-line bg-elev/30">
          <button
            type="button"
            onClick={() => setShowDesign((v) => !v)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-elev/50 transition-colors"
          >
            <div>
              <div className="text-[12.5px] font-medium text-fg">
                Embed anpassen
              </div>
              <div className="text-[11px] text-subtle">
                Titel, Farbe, Button-Style — alles optional
              </div>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 text-subtle transition-transform ${
                showDesign ? 'rotate-180' : ''
              }`}
              aria-hidden
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showDesign && (
            <div className="px-3.5 py-3 border-t border-line space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormRow label="Titel-Template">
                  <input
                    type="text"
                    value={embedTitle}
                    onChange={(e) => setEmbedTitle(e.target.value.slice(0, 200))}
                    placeholder="🎉  {prize}"
                    className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  />
                </FormRow>
                <FormRow label="Embed-Farbe">
                  <ColorPicker value={embedColor} onChange={setEmbedColor} />
                </FormRow>
              </div>
              <FormRow
                label="Beschreibung"
                hint="Platzhalter: {prize} {winners} {entries} {ends} {ends_long}"
              >
                <textarea
                  value={embedDescription}
                  onChange={(e) =>
                    setEmbedDescription(e.target.value.slice(0, 2000))
                  }
                  rows={4}
                  className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
                />
              </FormRow>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormRow label="Button-Label">
                  <input
                    type="text"
                    value={buttonLabel}
                    onChange={(e) => setButtonLabel(e.target.value.slice(0, 80))}
                    placeholder="Teilnehmen"
                    className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  />
                </FormRow>
                <FormRow label="Button-Emoji" hint="Unicode oder <:name:id>">
                  <input
                    type="text"
                    value={buttonEmoji}
                    onChange={(e) => setButtonEmoji(e.target.value.slice(0, 80))}
                    placeholder="🎉"
                    className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  />
                </FormRow>
              </div>
              <FormRow label="Button-Farbe">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {GW_BUTTON_STYLES.map((s) => {
                    const active = buttonStyle === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setButtonStyle(s.value)}
                        className={`text-left rounded-lg border p-2.5 transition-all ${
                          active
                            ? 'border-accent bg-accent/10'
                            : 'border-line bg-surface hover:border-line-strong'
                        }`}
                      >
                        <div
                          className={`inline-block px-2.5 py-1 rounded text-[11px] font-semibold ${s.classes}`}
                        >
                          {buttonLabel || 'Button'}
                        </div>
                        <div className="text-[11px] text-muted mt-1">
                          {s.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </FormRow>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={create}
            loading={pending}
            disabled={!newPrize.trim() || !newChannelId}
            variant="primary"
          >
            🎉 Giveaway starten
          </Button>
        </div>
      </FormSection>

      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-wider text-fg-soft">
              Aktiv
            </h3>
            <span className="text-[10.5px] font-mono tabular-nums text-subtle">
              {active.length}
            </span>
          </div>
          <ul className="space-y-2">
            {active.map((g) => (
              <GiveawayRow
                key={g.id}
                giveaway={g}
                channelName={channelById.get(g.channelId) ?? g.channelId}
                onEnd={() => end(g)}
                onReroll={() => reroll(g)}
                pending={pending}
              />
            ))}
          </ul>
        </div>
      )}

      {ended.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-wider text-fg-soft">
              Beendet
            </h3>
            <span className="text-[10.5px] font-mono tabular-nums text-subtle">
              {ended.length}
            </span>
          </div>
          <ul className="space-y-2">
            {ended.map((g) => (
              <GiveawayRow
                key={g.id}
                giveaway={g}
                channelName={channelById.get(g.channelId) ?? g.channelId}
                onEnd={() => end(g)}
                onReroll={() => reroll(g)}
                pending={pending}
              />
            ))}
          </ul>
        </div>
      )}

      {active.length === 0 && ended.length === 0 && (
        <StatusBanner kind="info">
          Noch keine Giveaways. Leg oben deins erstes an — `/giveaway start` im
          Server geht auch.
        </StatusBanner>
      )}
    </div>
  );
}

function GiveawayRow({
  giveaway: g,
  channelName,
  onEnd,
  onReroll,
  pending,
}: {
  giveaway: Giveaway;
  channelName: string;
  onEnd: () => void;
  onReroll: () => void;
  pending: boolean;
}) {
  return (
    <li className="rounded-xl border border-line bg-surface p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0 flex-1 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-elev border border-line grid place-items-center shrink-0">
          🎉
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-fg truncate max-w-[280px]">
              {g.prize}
            </span>
            {g.ended ? (
              <StatusPill kind="neutral" dot>
                Beendet
              </StatusPill>
            ) : (
              <StatusPill kind="success" dot>
                Aktiv
              </StatusPill>
            )}
          </div>
          <div className="text-[11.5px] text-muted mt-0.5">
            <span className="text-accent">#{channelName}</span> ·{' '}
            {g.winnersCount} Gewinner · {g.entriesCount} Teilnehmer · {relativeFromNow(g.endsAt)}
          </div>
          {g.ended && g.winnerUserIds && g.winnerUserIds.length > 0 && (
            <div className="text-[11.5px] text-fg-soft mt-1">
              Gewinner:{' '}
              {g.winnerUserIds.map((u) => (
                <code key={u} className="rounded bg-elev px-1 mr-1">
                  &lt;@{u}&gt;
                </code>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {g.ended ? (
          <Button
            type="button"
            onClick={onReroll}
            disabled={pending || g.entriesCount === 0}
            size="sm"
            variant="secondary"
          >
            Reroll
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onEnd}
            disabled={pending}
            size="sm"
            variant="ghost"
          >
            Beenden
          </Button>
        )}
      </div>
    </li>
  );
}
