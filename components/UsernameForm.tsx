'use client';
import { useState, useTransition } from 'react';
import { renameUsername } from '@/app/(app)/actions';

type Props = {
  currentUsername: string | null;
};

export function UsernameForm({ currentUsername }: Props) {
  const [value, setValue] = useState(currentUsername ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await renameUsername(formData);
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(res.error);
      }
    });
  };

  const dirty = value.trim() !== (currentUsername ?? '');

  return (
    <form action={submit}>
      <label className="block text-xs text-muted mb-1" htmlFor="username">
        Benutzername
      </label>
      <div className="flex items-center gap-2">
        <input
          id="username"
          name="username"
          type="text"
          required
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
            setSuccess(false);
          }}
          minLength={3}
          maxLength={20}
          pattern="[a-zA-ZäöüÄÖÜß0-9_ -]{3,20}"
          placeholder="z. B. Felix Müller"
          className="flex-1 rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={!dirty || pending}
          className="rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-medium px-4 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
      <p className="text-[11px] text-subtle mt-1">
        3–20 Zeichen: Buchstaben (auch ä/ö/ü/ß), Ziffern, Leerzeichen, _ und -.
        Mit Leerzeichen funktionieren @mentions in Kommentaren nicht.
      </p>
      {error && (
        <div className="mt-2 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs px-3 py-1.5">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs px-3 py-1.5">
          Benutzername geändert.
        </div>
      )}
    </form>
  );
}
