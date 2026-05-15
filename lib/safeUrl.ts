// Gibt die URL nur zurück, wenn sie absolute http(s) ist.
// Schützt <img src>, <a href> usw. vor javascript:/data:/file:-URLs aus User-Input.
export function safeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const u = new URL(value);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch {
    // fällt durch
  }
  return undefined;
}
