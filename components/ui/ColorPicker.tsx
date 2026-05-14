'use client';

import { useRef } from 'react';

type Props = {
  value: string; // hex incl. '#'
  onChange: (next: string) => void;
  presets?: string[];
  disabled?: boolean;
};

const DEFAULT_PRESETS = [
  '#5865F2', // Blurple
  '#10b981', // Emerald
  '#eab308', // Yellow
  '#f97316', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink
  '#a855f7', // Purple
  '#06b6d4', // Cyan
];

function isValidHex(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

export function ColorPicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const normalized = isValidHex(value) ? value : '#5865F2';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Großer klickbarer Swatch — öffnet native Color-Picker */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="relative h-9 w-9 rounded-lg border border-line-strong shadow-sm overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50"
        title="Farbe wählen"
        aria-label="Farbe wählen"
        style={{ backgroundColor: normalized }}
      >
        <input
          ref={inputRef}
          type="color"
          value={normalized}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="absolute inset-0 opacity-0 cursor-pointer"
          tabIndex={-1}
        />
      </button>

      {/* Hex-Input direkt editierbar */}
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v.length <= 7) onChange(v);
        }}
        onBlur={(e) => {
          if (!isValidHex(e.target.value)) onChange(normalized);
        }}
        disabled={disabled}
        maxLength={7}
        className="w-24 rounded-md bg-elev border border-line-strong px-2 py-1.5 text-xs text-fg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-50"
        placeholder="#5865F2"
      />

      {/* Presets */}
      <div className="flex items-center gap-1">
        {presets.map((p) => {
          const active = p.toLowerCase() === normalized.toLowerCase();
          return (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p)}
              className={`h-5 w-5 rounded-full border transition-all ${
                active
                  ? 'border-fg scale-110 ring-2 ring-fg/20'
                  : 'border-line-strong hover:scale-105'
              } disabled:opacity-50`}
              style={{ backgroundColor: p }}
              title={p}
              aria-label={`Farbe ${p}`}
            />
          );
        })}
      </div>
    </div>
  );
}
