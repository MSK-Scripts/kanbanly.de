'use client';
import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  viewClassName?: string;
  inputClassName?: string;
  placeholder?: string;
  ariaLabel?: string;
};

export function InlineEditableText({
  value,
  onSave,
  viewClassName = '',
  inputClassName = '',
  placeholder,
  ariaLabel,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const t = draft.trim();
    if (t && t !== value) void onSave(t);
    else setDraft(value);
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={inputClassName}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={viewClassName}
      aria-label={ariaLabel}
    >
      {value}
    </button>
  );
}
