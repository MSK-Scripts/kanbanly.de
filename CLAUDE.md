# CLAUDE.md — kanbanly.de

> Projektspezifischer Kontext. Die globale `CLAUDE.md` im Eltern-Verzeichnis (Moritz' Profil, Server-Infra-Übersicht, MSK-Brand) gilt zusätzlich.

---

## ⚠️ Wichtiger Hinweis zu Next.js 16

Dieses Projekt nutzt **Next.js 16** (`16.2.4`) mit **React 19** und **Turbopack**. Vieles davon kennst du aus deinem Training so noch nicht:

- App-Router-Konventionen können von älteren Mustern abweichen
- Server Components sind Default, Client-Components brauchen `"use client"`
- Server Actions statt klassischer API-Routes für Mutations
- Lies im Zweifel die Docs in `node_modules/next/dist/docs/` bevor du Next-spezifische APIs nutzt
- **Tailwind CSS v4** (kein `tailwind.config.ts` mehr — Konfig in `globals.css`)

---

## 🧭 Projektüberblick

**kanbanly** = deutschsprachiges Kanban-Tool (Trello-Alternative) + Discord-Bot, beides aus einem Repo.

| Komponente | Pfad | Beschreibung |
|---|---|---|
| **Web-App** | Root (`/app`, `/components`, `/lib`, …) | Next.js 16, Supabase, Realtime-Kanban |
| **Discord-Bot** | `/bot` | Eigenständiges Node-Projekt (eigener `package.json`, eigener PM2-Prozess) |
| **DB-Migrations** | `/supabase/migrations` | SQL, nummeriert (`001_*.sql` … `044_*.sql`), in Reihenfolge anwenden |

---

## 🛠️ Stack

### Web-App
- **Next.js 16.2.4** (App Router, Turbopack) · **React 19.2.4** · **TypeScript strict**
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) — Auth, Postgres, Realtime, Storage
- **Tailwind CSS v4** (Config via `@theme` in `app/globals.css`, nicht `tailwind.config.*`)
- **Zustand v5** — Client-State (`/store`)
- **@hello-pangea/dnd** — Drag & Drop (Fork von react-beautiful-dnd)
- **react-markdown + remark-gfm** — Markdown in Karten-Descriptions/Kommentaren
- **canvas-confetti** — UI-Polish

### Bot (`/bot`)
- **discord.js v14.16** · **TypeScript** (`tsx` für Dev, `tsc` für Build) · **dotenv**
- **Supabase Service-Role-Client** (umgeht RLS — Bot ist Server-Side)
- ESM (`"type": "module"`, `.js`-Endung in Imports beachten!)

---

## 📁 Projektstruktur

```
kanbanly.de/
├── app/
│   ├── (auth)/                    # login, register, reset-password (Public)
│   ├── (app)/                     # eingeloggter Bereich — alle Seiten hier brauchen Auth
│   │   ├── dashboard/
│   │   ├── boards/[id]/           # Board-Detail
│   │   │   ├── page.tsx           # Hauptansicht
│   │   │   ├── kalender/          # Kalender-Ansicht
│   │   │   ├── tabelle/           # Tabellen-Ansicht
│   │   │   ├── archiv/            # Archivierte Karten
│   │   │   ├── automation/        # Butler-Light-Regeln
│   │   │   └── felder/            # Custom-Fields-Config
│   │   ├── integrations/discord/[guildId]/   # Bot-Dashboard pro Server
│   │   ├── workspaces/, templates/, meine-karten/, woche/, stats/, einstellungen/, admin/
│   │   ├── *-actions.ts           # Server Actions (eine Datei pro Feature-Bereich)
│   │   └── layout.tsx
│   ├── api/discord/               # Bot-OAuth-Callback, Connect, Disconnect
│   ├── auth/                      # OAuth-Callback für Supabase
│   ├── datenschutz, impressum, invite, trello-alternative
│   ├── layout.tsx, page.tsx, robots.ts, sitemap.ts, globals.css, icon.png
├── components/                    # ~55 React-Komponenten (Client + Server gemischt)
├── lib/
│   ├── supabase/                  # client.ts, server.ts, admin.ts, middleware.ts
│   ├── ai.ts                      # Gemini-Integration (Board-Generation, Card-AI)
│   ├── discord.ts                 # OAuth, Bot-Invite, Channel/Role-Fetches (server-only)
│   ├── automations.ts, boardData.ts, mentions.tsx, notifications.ts, slug.ts, …
├── store/                         # Zustand-Stores (boardStore, confirmStore, presenceStore)
├── supabase/migrations/           # 001 … 044 SQL-Dateien (Bot-Tabellen ab 035)
├── bot/
│   ├── src/
│   │   ├── index.ts               # Bot-Bootstrap
│   │   ├── deploy-commands.ts     # Slash-Command-Registrierung bei Discord
│   │   ├── env.ts                 # Geprüfte Env-Vars
│   │   ├── db.ts                  # Service-Role-Supabase-Client
│   │   ├── types.ts
│   │   ├── commands/              # ping, help, welcome, reactionroles, warn, kick, ban,
│   │   │                          # timeout, clear, rank, leaderboard, tag, poll, customcmd
│   │   ├── events/                # guildCreate, guildMemberAdd, reactions, logger,
│   │   │                          # xp, customCommands, automod
│   │   └── db/                    # Tabellen-Wrapper: automod, customCommands, guilds,
│   │                              # reactionRoles, tags, warnings, xp
│   ├── package.json, tsconfig.json, README.md
├── proxy.ts                       # Next-Middleware (Supabase-Session-Refresh + Auth-Guard)
├── next.config.ts, tsconfig.json, eslint.config.mjs, postcss.config.mjs
└── package.json, README.md, CLAUDE.md (diese Datei)
```

**Hinweis zur `proxy.ts`:** Liegt im Root (nicht `middleware.ts`!) und wird über `export const config.matcher` aktiviert. Der `bot/`-Ordner ist via `tsconfig.json` aus dem Next-TS-Check **ausgenommen** (sonst Build-Konflikte wegen ESM-Imports).

---

## 🔑 Env-Variablen

### Web-App (`.env.local` im Root)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY    # sb_publishable_…
SUPABASE_SERVICE_ROLE_KEY               # sb_secret_… (server-only!)
NEXT_PUBLIC_SITE_URL                    # https://kanbanly.de oder http://localhost:3000

# Optional
GEMINI_API_KEY                          # AI-Features
DISCORD_CLIENT_ID                       # OAuth + Bot-Invite
DISCORD_CLIENT_SECRET                   # OAuth-Token-Exchange
DISCORD_BOT_TOKEN                       # Channel/Role-Lookups in lib/discord.ts
```

### Bot (`bot/.env` — eigenständig!)
```
DISCORD_BOT_TOKEN
DISCORD_CLIENT_ID
DISCORD_PUBLIC_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DEV_GUILD_ID                            # optional, für schnelle Slash-Command-Propagation
```

> Beide `.env*` sind gitignored. `.env.example` darf committet werden.

---

## 🚀 Deployment

**Kein Auto-Deploy.** Eigener VPS mit **PM2** für beide Prozesse:

- `pm2 restart kanbanly` — Next.js-App
- `pm2 restart kanbanly-bot` — Discord-Bot

Workflow (high-level):
1. Lokal committen + `git push origin main`
2. Auf dem Server: `git pull && npm install && npm run build && pm2 restart kanbanly`
3. Bei Bot-Änderungen analog in `/bot`, **mit `npm run deploy-commands`**, wenn Slash-Commands geändert wurden
4. Browser danach hart neu laden (Ctrl+Shift+R)

> Konkrete Server-Details (Host, User, Pfade, IP) stehen **nicht** in dieser Datei — die liegen in einer lokalen, gitignored privaten Notiz.

---

## 🤖 Discord-Bot — Konventionen

- **Slash-Commands** werden in `bot/src/commands/index.ts` registriert. Neuen Command anlegen → dort importieren → `npm run deploy-commands` ausführen.
- **Globale** Commands brauchen bis zu 1h Propagation bei Discord. Während Dev: `DEV_GUILD_ID` setzen → sofort sichtbar.
- **Privileged Intents** im Developer Portal **müssen aktiviert** sein:
  - Server Members Intent (Welcome, AutoRoles, Member-Logs)
  - Message Content Intent (Edit/Delete-Logs, AutoMod, CustomCommands)
- **DB-Zugriff im Bot** = Service-Role-Key → **umgeht RLS**. Niemals diesen Key in die Web-App oder den Browser bringen.
- **ESM-Imports im Bot:** Endung `.js` an Imports anhängen (`from './env.js'`), auch wenn die Datei `.ts` ist. Sonst crasht der gebaute Bot.

Bot-Tabellen: `supabase/migrations/035_bot_schema.sql` und Folgende (036–044).

---

## 📋 Konventionen & Präferenzen

- **Antwortsprache:** Deutsch (siehe globale CLAUDE.md)
- **Code-Kommentare:** Deutsch oder Englisch je nach Kontext — sparsam
- **Server Actions** statt API-Routes, wo möglich (Pattern: `lib/foo-actions.ts` in `app/(app)/`)
- **RLS-First:** Alle Web-App-DB-Zugriffe gehen über `lib/supabase/server.ts` oder `client.ts` mit dem **Publishable-Key** → RLS greift. `admin.ts` (Service-Role) **nur** in begründeten Server-only-Fällen.
- **Security-Mindset:** Session-Refresh in `proxy.ts`, Auth-Guards für `(app)`-Routes, niemals Service-Role-Key in Client-Code, OAuth-State-Param immer prüfen.
- **Nach Code-Änderungen:** Geänderte Dateien mit vollem Pfad auflisten (gilt insbesondere für `/bot`, da getrennt deployed).
- **Fragen vor größeren Refactorings** — gerade beim Realtime-/Presence-Code und an der Supabase-RLS-Grenze.

---

## 🗺️ Wichtige Pfade in der Code-Basis

| Konzept | Datei(en) |
|---|---|
| Auth-Middleware | `proxy.ts` → `lib/supabase/middleware.ts` |
| Supabase Server-Client | `lib/supabase/server.ts` |
| Supabase Browser-Client | `lib/supabase/client.ts` |
| Supabase Admin/Service-Role | `lib/supabase/admin.ts` |
| Discord OAuth + Bot-Invite | `lib/discord.ts` (server-only) |
| Realtime / Board-Sync | `lib/useBoardSync.ts`, `store/presenceStore.ts` |
| AI-Calls (Gemini) | `lib/ai.ts` |
| Board-State (Client) | `store/boardStore.ts` |
| Bot-Bootstrap | `bot/src/index.ts` |
| Bot-Commands-Registry | `bot/src/commands/index.ts` |

---

*Letztes Update: 2026-05-13 — Re-write nach AGENTS.md-Verlust; Stand: Migrations bis 044, Bot-Features bis AutoMod.*
