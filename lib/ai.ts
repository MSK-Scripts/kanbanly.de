import 'server-only';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/**
 * fetch wrapper with retry for transient Gemini errors (503/500/504).
 * Throws a user-friendly Error with a translated message for the
 * non-retryable HTTP statuses we know.
 */
async function geminiFetch(body: unknown, key: string): Promise<Response> {
  const url = `${ENDPOINT}?key=${encodeURIComponent(key)}`;
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };

  const transient = new Set([500, 502, 503, 504]);
  const delays = [800, 2200];

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    if (attempt < delays.length && transient.has(res.status)) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
      continue;
    }

    if (res.status === 429) {
      throw new Error(
        'KI-Kontingent erreicht. Probier es in ein paar Minuten nochmal.'
      );
    }
    if (res.status === 403) {
      throw new Error('KI-Zugang blockiert. Der API-Key ist ungültig.');
    }
    if (transient.has(res.status)) {
      throw new Error(
        'Gemini ist gerade überlastet. Versuch es in einer Minute nochmal.'
      );
    }
    const errText = await res.text();
    throw new Error(`KI-Fehler (${res.status}): ${errText.slice(0, 200)}`);
  }
}

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

export async function generateBoard(
  userPrompt: string,
  workspaceContext?: string
): Promise<GeneratedBoard> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY fehlt.');

  const trimmed = userPrompt.trim();
  if (!trimmed || trimmed.length < 3) {
    throw new Error('Beschreib dein Projekt in mindestens ein paar Worten.');
  }
  if (trimmed.length > 2000) {
    throw new Error('Beschreibung ist zu lang (max 2000 Zeichen).');
  }

  const ctx = workspaceContext?.trim().slice(0, 200) ?? '';
  const promptText = ctx
    ? `Workspace-Kontext: "${ctx}"\nDie Projekt-Idee gehört zu diesem Workspace — interpretiere sie in dessen Domäne (z.B. "Tuning" in einem FiveM-Workspace = FiveM-Script-Tuning, NICHT Auto-Tuning oder Musik).\n\nProjekt-Idee: ${trimmed}\n\nGeneriere die Board-Struktur.`
    : `Projekt-Idee: ${trimmed}\n\nGeneriere die Board-Struktur.`;

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: promptText }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.8,
    },
  };

  const res = await geminiFetch(body, key);

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

async function callGeminiText(
  systemInstruction: string,
  userPrompt: string,
  temperature = 0.6
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY fehlt.');

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: { temperature },
  };

  const res = await geminiFetch(body, key);

  type R = {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const json = (await res.json()) as R;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Leere Antwort von Gemini.');
  return text.trim();
}

const IMPROVE_DESC_INSTRUCTION = `Du hilfst, Kanban-Kartenbeschreibungen klarer und actionable zu machen. Schreibe auf Deutsch. Behalte Tonfall und Information bei, mach es nur lesbarer und strukturierter. Markdown ist erlaubt (kurze Überschriften, Listen, **fett**). Keine Floskeln, keine Wiederholung des Titels. Maximal 6 Zeilen.`;

export async function improveCardDescription(
  title: string,
  currentDescription: string
): Promise<string> {
  const t = title.trim();
  if (!t) throw new Error('Karte hat keinen Titel.');

  const userPrompt =
    currentDescription.trim().length > 0
      ? `Karten-Titel: "${t}"\n\nAktuelle Beschreibung:\n${currentDescription}\n\nÜberarbeite die Beschreibung.`
      : `Karten-Titel: "${t}"\n\nDie Karte hat noch keine Beschreibung. Schreibe eine kurze, sinnvolle (1-3 Sätze, optional 2-4 Bullet-Stichpunkte) basierend auf dem Titel.`;

  return callGeminiText(IMPROVE_DESC_INSTRUCTION, userPrompt, 0.4);
}

const SUGGEST_TASKS_INSTRUCTION = `Du brichst Kanban-Karten in 3-6 konkrete, abhakbare Subtasks runter. Schreibe auf Deutsch. Eine Aufgabe pro Zeile, ohne Aufzählungszeichen, ohne Nummerierung, ohne Fließtext drumrum. Jede Zeile beginnt mit einem Verb. Keine Wiederholungen.`;

export async function suggestCardSubtasks(
  title: string,
  description: string
): Promise<string[]> {
  const t = title.trim();
  if (!t) throw new Error('Karte hat keinen Titel.');

  const userPrompt = `Karten-Titel: "${t}"\n\n${
    description.trim() ? `Beschreibung:\n${description}\n\n` : ''
  }Schlage konkrete Subtasks vor.`;

  const raw = await callGeminiText(SUGGEST_TASKS_INSTRUCTION, userPrompt, 0.5);

  return raw
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*•\d.\s]+/, '').trim())
    .filter((line) => line.length > 0 && line.length <= 200)
    .slice(0, 8);
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
