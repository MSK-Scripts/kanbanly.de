import 'server-only';

const MODEL = 'gemini-2.0-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const LABEL_COLORS = [
  'rose',
  'orange',
  'amber',
  'emerald',
  'teal',
  'sky',
  'violet',
  'pink',
] as const;

export type GeneratedBoard = {
  name: string;
  emoji: string;
  description: string;
  labels: Array<{ name: string; color: (typeof LABEL_COLORS)[number] }>;
  lists: Array<{
    title: string;
    cards: Array<{
      title: string;
      description: string;
      tasks: string[];
      labels: string[];
    }>;
  }>;
};

const SYSTEM_INSTRUCTION = `Du bist ein erfahrener Projekt-Manager. Basierend auf der Beschreibung des Users erstellst du eine sinnvolle Kanban-Board-Struktur auf Deutsch.

Regeln:
- 3-5 Listen. Typisch: "Backlog" / "Ideen", "In Arbeit", ggf. "Review", "Erledigt".
- 4-8 Labels passend zum Projekt-Kontext (Farben aus: rose, orange, amber, emerald, teal, sky, violet, pink).
- 2-4 Beispielkarten pro Liste — spezifisch und umsetzbar, KEINE Platzhalter wie "Beispiel".
- Jede Karte hat eine Beschreibung (1-2 Sätze, Markdown erlaubt) und optional 2-5 Tasks (als Checkliste).
- Karten können 0-2 Label-Namen referenzieren (müssen exakt zu den definierten Labels passen).
- Board-Name: kurz, prägnant (max 40 Zeichen).
- Board-Emoji: ein passendes Unicode-Emoji.
- Board-Description: 1 Satz, was das Board vorhat.
- Alles in der du-Form, auf Deutsch.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    emoji: { type: 'string' },
    description: { type: 'string' },
    labels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          color: { type: 'string', enum: [...LABEL_COLORS] },
        },
        required: ['name', 'color'],
      },
    },
    lists: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          cards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                tasks: { type: 'array', items: { type: 'string' } },
                labels: { type: 'array', items: { type: 'string' } },
              },
              required: ['title', 'description', 'tasks', 'labels'],
            },
          },
        },
        required: ['title', 'cards'],
      },
    },
  },
  required: ['name', 'emoji', 'description', 'labels', 'lists'],
};

export async function generateBoard(userPrompt: string): Promise<GeneratedBoard> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY fehlt.');

  const trimmed = userPrompt.trim();
  if (!trimmed || trimmed.length < 3) {
    throw new Error('Beschreib dein Projekt in mindestens ein paar Worten.');
  }
  if (trimmed.length > 2000) {
    throw new Error('Beschreibung ist zu lang (max 2000 Zeichen).');
  }

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Projekt-Idee: ${trimmed}\n\nGeneriere die Board-Struktur.`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.8,
    },
  };

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Gemini-Fehler (${res.status}): ${errText.slice(0, 200)}`
    );
  }

  type GeminiResponse = {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const json = (await res.json()) as GeminiResponse;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Leere Antwort von Gemini.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini-Antwort war kein gültiges JSON.');
  }

  return normalize(parsed);
}

function normalize(raw: unknown): GeneratedBoard {
  const r = raw as Record<string, unknown>;
  const labels = Array.isArray(r.labels) ? r.labels : [];
  const lists = Array.isArray(r.lists) ? r.lists : [];

  const validLabels = labels
    .map((l) => {
      const row = l as Record<string, unknown>;
      const name =
        typeof row.name === 'string' ? row.name.trim().slice(0, 30) : '';
      const color =
        typeof row.color === 'string' &&
        (LABEL_COLORS as readonly string[]).includes(row.color)
          ? (row.color as (typeof LABEL_COLORS)[number])
          : 'violet';
      if (!name) return null;
      return { name, color };
    })
    .filter((x): x is { name: string; color: (typeof LABEL_COLORS)[number] } =>
      Boolean(x)
    );

  const labelNames = new Set(validLabels.map((l) => l.name));

  const validLists = lists
    .map((l) => {
      const row = l as Record<string, unknown>;
      const title =
        typeof row.title === 'string' ? row.title.trim().slice(0, 40) : '';
      if (!title) return null;
      const cards = Array.isArray(row.cards) ? row.cards : [];
      const validCards = cards
        .map((c) => {
          const cr = c as Record<string, unknown>;
          const cTitle =
            typeof cr.title === 'string' ? cr.title.trim().slice(0, 120) : '';
          if (!cTitle) return null;
          const desc =
            typeof cr.description === 'string'
              ? cr.description.trim().slice(0, 2000)
              : '';
          const tasks = Array.isArray(cr.tasks)
            ? cr.tasks
                .filter((t): t is string => typeof t === 'string')
                .map((t) => t.trim())
                .filter((t) => t.length > 0)
                .slice(0, 10)
            : [];
          const cLabels = Array.isArray(cr.labels)
            ? cr.labels
                .filter((n): n is string => typeof n === 'string')
                .map((n) => n.trim())
                .filter((n) => labelNames.has(n))
                .slice(0, 3)
            : [];
          return { title: cTitle, description: desc, tasks, labels: cLabels };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .slice(0, 8);
      return { title, cards: validCards };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 6);

  const name =
    typeof r.name === 'string' && r.name.trim()
      ? r.name.trim().slice(0, 40)
      : 'Neues Board';
  const emoji =
    typeof r.emoji === 'string' && r.emoji.trim() ? r.emoji.trim().slice(0, 8) : '📋';
  const description =
    typeof r.description === 'string' ? r.description.trim().slice(0, 200) : '';

  return {
    name,
    emoji,
    description,
    labels: validLabels,
    lists: validLists,
  };
}
