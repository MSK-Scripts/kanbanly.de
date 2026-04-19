'use client';
import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder?: string;
};

export function DescriptionEditor({
  value,
  onChange,
  onBlur,
  placeholder,
}: Props) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasContent = value.trim().length > 0;

  const startEdit = () => {
    setEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(value.length, value.length);
    }, 0);
  };

  const finishEdit = () => {
    onBlur();
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="w-full min-h-[5rem] rounded-lg bg-elev/40 hover:bg-elev/70 border border-line-strong px-3 py-2 text-sm text-left transition-colors"
        aria-label="Beschreibung bearbeiten"
      >
        {hasContent ? (
          <div className="prose-markdown text-fg-soft">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          </div>
        ) : (
          <span className="text-subtle">
            {placeholder ??
              'Details, Links, Notizen… Klicken zum Bearbeiten (Markdown unterstützt).'}
          </span>
        )}
      </button>
    );
  }

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={finishEdit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            (e.currentTarget as HTMLTextAreaElement).blur();
          }
        }}
        placeholder={placeholder}
        rows={6}
        className="w-full rounded-lg bg-elev/80 border border-accent-hover/50 px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60 resize-y font-mono"
      />
      <div className="mt-1 flex items-center justify-between text-[10px] text-faint font-mono">
        <span>Markdown: **fett**, *kursiv*, - Liste, [link](url)</span>
        <span>Esc beendet</span>
      </div>
    </div>
  );
}
