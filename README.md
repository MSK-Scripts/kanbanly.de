# kanbanly

**Live:** https://kanbanly.de

Schlankes, deutschsprachiges Kanban-Tool für Selbstständige und kleine Teams — Trello-Alternative, kostenlos, DSGVO-konform. Plus ein optionaler Discord-Bot für Community-Server.

> *„Flow first. Build fast."*

---

## Stack

- **Next.js 16** (App Router, Server Components, Turbopack) · **React 19** · **TypeScript strict**
- **Supabase** — Auth, Postgres, Realtime, Storage; SSR-Integration via `@supabase/ssr`
- **Tailwind CSS v4** (Konfig via `@theme` in `app/globals.css`, kein `tailwind.config.*` mehr)
- **Zustand v5** — Client-State
- **@hello-pangea/dnd** — Drag & Drop
- **react-markdown + remark-gfm** — Karten-Beschreibungen und Kommentare
- **Google Gemini** — Board-Generation und Card-AI
- **discord.js v14** — Bot, separates Sub-Projekt unter `/bot`

---

## Features

### Boards & Karten
- Workspaces und Boards mit lesbaren Slug-URLs, Rollen pro Workspace und Board (Viewer/Editor/Admin)
- Drag & Drop zwischen Spalten und Boards · WIP-Limits pro Spalte · Swimlanes
- Karten mit Titel, Markdown-Beschreibung, Fälligkeit, Checklisten, 8-Farben-Labels, Member-Assignments
- Kommentare mit @mentions, Activity-Log pro Karte
- **Custom Fields** (Text, Zahl, Datum, Auswahl) pro Board
- **Linked Cards** — Verknüpfungen zwischen Karten
- **Auto-Archive** statt Hard-Delete, Wiederherstellung jederzeit

### Ansichten
- Kanban-Ansicht (klassisch) · **Kalender** · **Tabelle** · **Archiv** pro Board
- **Meine Karten** und **Diese Woche** als persönliche Übersichten
- **Stats** für Workspace-/Board-Statistiken
- **Templates** — Board-Vorlagen mit Emoji-Cover
- Filter, Bulk-Actions, Group-by, **Command-Palette (⌘K)**

### Realtime & Kollaboration
- Live-Sync zwischen Sessions (Cards, Listen, Kommentare)
- Live-Cursors und Presence-Avatare
- **Subscribe + Notification-Feed** mit Activity-Stream
- Webhook-Auslöser für externe Systeme (z. B. Discord-Channels)

### Komfort
- **AI-Hilfe** — KI generiert ganze Boards aus Beschreibungen, verbessert Card-Texte, schlägt Subtasks vor
- **Butler-Light** — Wenn-Dann-Automatisierungs-Regeln pro Board
- Light/Dark-Mode, Custom Board-Backgrounds
- 2FA-Recovery-Codes, Mitglieder-Einladungen per Token-Link

### Discord-Bot (optional)
Separates Node-Projekt unter `/bot`, konfigurierbar pro Server über das Web-Dashboard unter `/integrations/discord/[guildId]`. Welcome-Messages, Auto-/Reaction-Roles, Moderation, Logging, Leveling/XP, AutoMod, Tags, Polls, Custom-Commands, Reminders, Ticket-System, Server-Stats. Details: siehe [bot/README.md](bot/README.md).

---

## Setup für lokale Entwicklung

### 1. Repo klonen + Dependencies

```bash
git clone https://github.com/MSK-Scripts/kanbanly.de.git
cd kanbanly.de
npm install
```

### 2. Supabase-Projekt anlegen

Im [Supabase Dashboard](https://supabase.com/dashboard) ein Projekt erstellen. Im SQL-Editor alle Dateien aus `supabase/migrations/` **in numerischer Reihenfolge** ausführen.

### 3. `.env.local` anlegen

```env
NEXT_PUBLIC_SUPABASE_URL=https://<dein-projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_… aus Supabase API-Settings>
SUPABASE_SERVICE_ROLE_KEY=<sb_secret_… aus Supabase API-Settings>
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional: AI-Board-Generation + KI in Karten
GEMINI_API_KEY=<aus Google AI Studio>

# Optional: Discord-Bot-Integration (Web-Dashboard)
DISCORD_CLIENT_ID=<deine Discord-App-ID>
DISCORD_CLIENT_SECRET=<dein Discord-OAuth2-Secret>
DISCORD_BOT_TOKEN=<dein Bot-Token>
```

### 4. Dev-Server starten

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000).

---

## Deployment

**Kein Auto-Deploy** — wir laufen auf einem eigenen VPS mit **PM2**. Nach jedem Push muss der Server aktiv `git pull && npm install && npm run build && pm2 restart kanbanly` ausführen. Empfohlen: ein `deploy.sh`-Skript dafür.

Für die Bot-Komponente analog: siehe [bot/README.md](bot/README.md).

---

## Projekt-Struktur

```
kanbanly.de/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Login, Register, Reset-Password (public)
│   ├── (app)/                    # Eingeloggter Bereich (Auth-Guard via proxy.ts)
│   │   ├── dashboard/
│   │   ├── boards/[id]/          # Hauptansicht + Kalender, Tabelle, Archiv,
│   │   │                         # Automation (Butler-Light), Felder (Custom Fields)
│   │   ├── workspaces/[id]/
│   │   ├── templates/
│   │   ├── meine-karten/         # Persönlich zugewiesene Karten
│   │   ├── woche/                # Diese-Woche-Übersicht
│   │   ├── stats/
│   │   ├── einstellungen/
│   │   ├── admin/                # Admin-Tools (Ghost-Boards etc.)
│   │   ├── integrations/discord/ # Bot-Dashboard pro Server
│   │   └── *-actions.ts          # Server Actions (eine Datei pro Feature)
│   ├── api/discord/              # Bot-OAuth-Callback, Connect, Disconnect
│   ├── auth/                     # Supabase-OAuth-Callback
│   ├── datenschutz/, impressum/, invite/, trello-alternative/
│   ├── layout.tsx, page.tsx, robots.ts, sitemap.ts, globals.css
├── components/                   # React-Komponenten (Client + Server)
├── lib/
│   ├── supabase/                 # client.ts, server.ts, admin.ts, middleware.ts
│   ├── ai.ts                     # Gemini-Integration
│   ├── discord.ts                # OAuth, Bot-Invite, Channel-/Role-Fetches
│   ├── useMounted.ts             # SSR-sicherer Client-Hydration-Hook
│   └── …                         # Helper für Automations, Mentions, Filter, Slugs etc.
├── store/                        # Zustand-Stores (boardStore, confirmStore, presenceStore)
├── supabase/migrations/          # SQL-Migrations, numerisch nummeriert
├── bot/                          # Discord-Bot (eigenes Node-Projekt, eigener PM2-Prozess)
├── proxy.ts                      # Next-Middleware: Supabase-Session-Refresh + Auth-Guard
└── CLAUDE.md                     # Projekt-Kontext für KI-Pair-Programming
```

---

## Lizenz

Kein offizielle Lizenz — der Code steht hier zu Lern- und Audit-Zwecken offen. Bei Interesse an einer Verwendung bitte vorab fragen.

## Kontakt

Discord-Community: [discord.gg/BA8uB6yNUU](https://discord.gg/BA8uB6yNUU)
