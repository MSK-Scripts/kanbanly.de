# kanbanly

**Live:** https://kanbanly.de

Schlankes, deutschsprachiges Kanban-Tool für Selbstständige und kleine Teams — Trello-Alternative, kostenlos, DSGVO-konform. Plus ein Discord-Bot für Community-Server (Welcome, Reaction-Roles, Moderation, Leveling).

> *„Flow first. Build fast."*

---

## Stack

- **Next.js 16** (App Router, Server Components, Turbopack)
- **React 19**
- **Supabase** — Auth, Postgres, Realtime, Storage
- **TypeScript** strict
- **Tailwind CSS v4**
- **Zustand** (Client-State)
- **@hello-pangea/dnd** (Drag & Drop)
- **Google Gemini** (Board-Generation + Card-AI)
- **Discord.js v14** (Bot, separates Sub-Projekt unter `/bot`)

## Features

### Kanbanly (Web-App)

- Workspaces + Boards mit lesbaren Slug-URLs
- Drag & Drop zwischen Spalten und Boards
- Karten mit Titel, Beschreibung (Markdown), Fälligkeit, Checklisten
- 8-Farben-Labels, Member-Assignments
- @mentions in Kommentaren, Activity-Log pro Karte
- Realtime-Sync zwischen Sessions (Live-Cursors, Presence)
- Rollen: Viewer, Editor, Admin pro Workspace und Board
- **Kalender-Ansicht** und **Tabellen-Ansicht** pro Board
- **Custom Fields** (Text, Zahl, Datum, Auswahl)
- **Linked Cards** — Verknüpfungen zwischen Karten
- **Auto-Archive** statt Hard-Delete, Wiederherstellung möglich
- **WIP-Limits** pro Spalte (klassisches Kanban)
- **Butler-Light Automation** — Wenn-Dann-Regeln
- **AI-Hilfe** — KI baut Boards aus Beschreibungen, verbessert Card-Beschreibungen, schlägt Subtasks vor
- **Subscribe + Notification-Feed** — Aktivitäts-Stream
- **Filter, Bulk-Actions, Swimlanes, Command-Palette (⌘K)**
- Light/Dark-Mode, Custom Board-Backgrounds
- **Discord-Webhooks** für Board-Events

### Discord-Bot

Konfigurierbar pro Server über das Web-Dashboard unter `/integrations/discord/[guildId]`:

- Welcome-Messages mit Variablen (`{user}`, `{mention}`, `{server}`, `{members}`)
- Auto-Roles beim Server-Beitritt
- Reaction-Roles (Self-Service-Rollen über Emoji-Reaktionen)
- Moderation: `/warn` (mit Historie), `/kick`, `/ban`, `/timeout`, `/clear`
- Logging in Audit-Channel: Joins, Leaves, Edits, Deletes, Rollen-Änderungen
- XP / Leveling wie MEE6 — `/rank`, `/leaderboard`, Level-Rewards (Rollen)

---

## Setup für lokale Entwicklung

### 1. Repo klonen + Dependencies

```bash
git clone https://github.com/cmdscripts/kanbanly.de.git
cd kanbanly.de
npm install
```

### 2. Supabase-Projekt anlegen

Im [Supabase Dashboard](https://supabase.com/dashboard) ein Projekt erstellen. Im SQL-Editor alle Dateien aus `supabase/migrations/` in numerischer Reihenfolge ausführen.

### 3. `.env.local` anlegen

```env
NEXT_PUBLIC_SUPABASE_URL=https://<dein-projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_… aus Supabase API-Settings>
SUPABASE_SERVICE_ROLE_KEY=<sb_secret_… aus Supabase API-Settings>
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional: AI-Board-Generation + KI in Cards
GEMINI_API_KEY=<aus Google AI Studio>

# Optional: Discord-Bot-Integration
DISCORD_CLIENT_ID=<dein Discord-App-ID>
DISCORD_CLIENT_SECRET=<dein Discord-OAuth2-Secret>
DISCORD_BOT_TOKEN=<dein Bot-Token>
```

### 4. Dev-Server starten

```bash
npm run dev
```

Öffne http://localhost:3000.

---

## Discord-Bot lokal starten

Der Bot liegt unter `/bot` und ist ein separates Node-Projekt.

```bash
cd bot
npm install
cp .env.example .env
# .env mit deinen Werten füllen
npm run deploy-commands   # registriert Slash-Commands bei Discord
npm run dev               # startet den Bot
```

Im Discord Developer Portal müssen **Privileged Intents** aktiv sein:
- **Server Members Intent** (für Welcome, Auto-Roles, Member-Logs)
- **Message Content Intent** (für Edit/Delete-Logs)

Redirect-URIs unter OAuth2 → Redirects:
- `http://localhost:3000/api/discord/callback`
- `https://<deine-domain>/api/discord/callback`

---

## Deployment

Kein Auto-Deploy — wir laufen auf einem eigenen VPS mit PM2. Nach jedem Push muss der Server aktiv `git pull && npm run build && pm2 restart kanbanly` ausführen. Empfohlen: ein `deploy.sh`-Skript dafür.

Für die Bot-Komponente analog: `cd bot && npm install && npm run build && pm2 restart kanbanly-bot`.

---

## Projekt-Struktur

```
kanbanly.de/
├── app/                   # Next.js App Router
│   ├── (auth)/            # Login, Register, OAuth
│   ├── (app)/             # Eingeloggter Bereich
│   │   ├── dashboard/
│   │   ├── boards/[id]/   # Board, Kalender, Tabelle, Archiv, Automation, Felder
│   │   └── integrations/discord/  # Bot-Dashboard
│   └── api/discord/       # Bot-OAuth + Webhooks
├── components/            # React-Komponenten (Client + Server)
├── lib/                   # Helper (Supabase, AI, Mentions, Discord)
├── store/                 # Zustand-Stores
├── supabase/migrations/   # SQL-Migrations (in numerischer Reihenfolge anwenden)
└── bot/                   # Discord-Bot (eigenes Node-Projekt)
    ├── src/commands/      # Slash-Commands
    ├── src/events/        # Discord-Event-Handler
    └── src/db/            # Bot-DB-Layer (Service-Role-Key)
```

---

## Lizenz

Kein offizielle Lizenz — der Code steht hier zu Lern- und Audit-Zwecken offen. Bei Interesse an einer Verwendung bitte vorab fragen.

## Kontakt

Discord-Community: https://discord.gg/BA8uB6yNUU
