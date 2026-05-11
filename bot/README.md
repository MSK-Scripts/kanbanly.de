# Kanbanly Discord Bot

Standalone Node-Service. Läuft als eigener PM2-Prozess parallel zur Next.js-App.

## Setup (lokal)

1. Token besorgen im [Discord Developer Portal](https://discord.com/developers/applications/1503486800146993203)
   – Bot → "Reset Token" → speichern
   – General Information → Public Key
   – Privileged Gateway Intents: **Server Members Intent** und **Message Content Intent** aktivieren
2. `cp .env.example .env`, Werte eintragen (Supabase-URL und Service-Role-Key aus eurem Supabase-Projekt)
3. `npm install`
4. `npm run deploy-commands` (einmal nach jeder Command-Änderung; mit `DEV_GUILD_ID` sofort sichtbar)
5. `npm run dev`

Bot zum Testen einladen — OAuth2 URL Generator im Developer Portal:
- Scopes: `bot`, `applications.commands`
- Bot-Permissions: zunächst Administrator (später feiner)

## Production (Avoro VPS)

```bash
# einmalig nach erstem Deploy
cd ~/kanbanly.de/bot
cp .env.example .env   # und Werte eintragen
npm install
npm run build
npm run deploy-commands
pm2 start dist/index.js --name kanbanly-bot
pm2 save

# bei Updates (siehe AGENTS.md "Bot-Deploy")
git pull
cd bot && npm install && npm run build && npm run deploy-commands && pm2 restart kanbanly-bot
```

## Architektur

- `src/index.ts` — Bot-Bootstrap, Event-Handler
- `src/commands/` — ein File pro Slash-Command, registriert in `commands/index.ts`
- `src/deploy-commands.ts` — registriert Slash-Commands bei Discord
- `src/db.ts` — Supabase-Client mit Service-Role-Key (DB-Zugriff vorbei an RLS — der Bot ist Server-Side, kein Endnutzer)
- `src/env.ts` — geprüfte Env-Variablen, Crash bei fehlenden Werten

DB-Schema: `supabase/migrations/035_bot_*.sql` und folgende.

## Roadmap

- [x] **Phase 1:** Skelett, `/ping`, `/help`, Deploy-Pipeline
- [ ] **Phase 2:** Welcome-Messages, Reaction Roles
- [ ] **Phase 3:** Leveling/XP
- [ ] **Phase 4:** Auto-Moderation (Spam, Links, Caps)
- [ ] **Phase 5:** AI-Features — `/catchup`, kontextuelle Auto-Mod (Gemini)
- [ ] **Phase 6:** Web-Dashboard in der Next.js-App unter `/bot/dashboard`
