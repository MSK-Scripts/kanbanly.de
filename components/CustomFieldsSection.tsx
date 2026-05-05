'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  setCardFieldValue,
  type CustomFieldKind,
} from '@/app/(app)/custom-field-actions';

type Field = {
  id: string;
  name: string;
  kind: CustomFieldKind;
  options: string[];
  position: number;
};

type Props = {
  cardId: string;
  boardId: string;
};

export function CustomFieldsSection({ cardId, boardId }: Props) {
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const [{ data: fs }, { data: vs }] = await Promise.all([
        supabase
          .from('custom_fields')
          .select('id, name, kind, options, position')
          .eq('board_id', boardId)
          .order('position'),
        supabase
          .from('card_field_values')
          .select('field_id, value')
          .eq('card_id', cardId),
      ]);
      if (cancelled) return;
      setFields((fs ?? []) as Field[]);
      const valueMap: Record<string, string> = {};
      for (const row of (vs ?? []) as Array<{
        field_id: string;
        value: unknown;
      }>) {
        if (row.value === null || row.value === undefined) continue;
        valueMap[row.field_id] =
          typeof row.value === 'string'
            ? row.value
            : typeof row.value === 'number'
            ? String(row.value)
            : '';
      }
      setValues(valueMap);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [cardId, boardId]);

  function commit(fieldId: string, kind: CustomFieldKind, raw: string) {
    if (raw === '') {
      setCardFieldValue(cardId, fieldId, null);
      return;
    }
    if (kind === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      setCardFieldValue(cardId, fieldId, n);
      return;
    }
    setCardFieldValue(cardId, fieldId, raw);
  }

  if (loading) return null;
  if (fields.length === 0) return null;

  return (
    <section className="px-5 pb-5">
      <h3 className="text-xs font-semibold text-fg-soft uppercase tracking-wide mb-2">
        Felder
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => {
          const v = values[f.id] ?? '';
          const onSave = (next: string) => {
            setValues((prev) => ({ ...prev, [f.id]: next }));
            commit(f.id, f.kind, next);
          };
          return (
            <div key={f.id}>
              <label className="block text-[11px] text-muted mb-1">
                {f.name}
              </label>
              {f.kind === 'dropdown' ? (
                <select
                  value={v}
                  onChange={(e) => onSave(e.target.value)}
                  className="w-full rounded-md bg-elev border border-line-strong px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">—</option>
                  {f.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : f.kind === 'date' ? (
                <input
                  type="date"
                  value={v}
                  onChange={(e) => onSave(e.target.value)}
                  className="w-full rounded-md bg-elev border border-line-strong px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
                />
              ) : f.kind === 'number' ? (
                <input
                  type="number"
                  value={v}
                  onChange={(e) => onSave(e.target.value)}
                  className="w-full rounded-md bg-elev border border-line-strong px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent font-mono"
                />
              ) : (
                <input
                  type="text"
                  defaultValue={v}
                  onBlur={(e) => onSave(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-full rounded-md bg-elev border border-line-strong px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
