<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Deployment

Live: **https://kanbanly.de**

There is **no auto-deploy** — `git push origin main` only updates GitHub, not the server. Code changes only go live after a manual deploy.

## Setup

- **Host:** Avoro VPS S, Ubuntu 24.04, IP `185.254.96.144`
- **Process manager:** PM2, app name `kanbanly` (id 0)
- **Run user:** `deploy` (NOT root — `pm2 list` as root will be empty)
- **Project path on server:** `/home/deploy/kanbanly.de`
- **Env file:** `/home/deploy/kanbanly.de/.env.local` (lives only on server, gitignored)

## Connecting to the server

SSH `root@185.254.96.144` with password is often refused (sshd usually has `PermitRootLogin prohibit-password`). If `ssh` fails, use the **noVNC web console** in the Avoro client area (cp.avoro.eu → VPS S → "Konsole"). Login as `root`, then `su - deploy`.

If SSH host key changed (server reinstall): `ssh-keygen -R 185.254.96.144` locally, then reconnect.

## Deploy workflow

1. Make and commit changes locally.
2. `git push origin main`.
3. Connect to server, become `deploy`:
   ```bash
   ssh root@185.254.96.144   # or noVNC fallback
   su - deploy
   ```
4. On the server:
   ```bash
   cd ~/kanbanly.de
   git pull
   npm install            # only if package.json changed
   npm run build
   pm2 restart kanbanly
   pm2 logs kanbanly --lines 20 --nostream   # sanity check
   ```
5. Hard-refresh the browser (Ctrl+Shift+R) — the user's browser caches aggressively.

## Verification

- `pm2 list` should show `kanbanly` as `online` with a fresh uptime.
- If the build fails or the process crashes, `pm2 logs kanbanly` shows the error.

## Things that will trip you up

- SSH password rejected even after Avoro password reset → it's the sshd config, not the password. Use noVNC console.
- `pm2 list` empty as root → wrong user, switch to `deploy` first.
- The user's local `.env.local` was historically wrong (contained another project's vars). Don't copy it to the server blindly. The server's `.env.local` is authoritative.
- After deploy, browser may show cached old version. Always tell the user to hard-refresh.

# Discord-Bot (`/bot`)

Separates Node-Projekt unter `/bot/` mit eigenem `package.json`, eigenem PM2-Prozess `kanbanly-bot`, eigener `.env`. Stack: discord.js v14, TypeScript, Supabase via Service-Role-Key.

- **PM2-App:** `kanbanly-bot` (parallel zu `kanbanly`)
- **Pfad auf Server:** `/home/deploy/kanbanly.de/bot`
- **Env-Datei:** `/home/deploy/kanbanly.de/bot/.env` (eigenständig, nicht die der Next.js-App)
- **Discord App ID:** `1495358990622920704` ([Developer Portal](https://discord.com/developers/applications/1495358990622920704))

## Bot-Deploy-Workflow

Zusätzlich zum normalen Deploy oben — wenn `bot/` geändert wurde:

```bash
cd ~/kanbanly.de/bot
npm install                      # nur wenn bot/package.json geändert
npm run build
npm run deploy-commands          # nur wenn Slash-Commands geändert/hinzugefügt
pm2 restart kanbanly-bot
pm2 logs kanbanly-bot --lines 20 --nostream
```

Beim allerersten Deploy stattdessen `pm2 start dist/index.js --name kanbanly-bot && pm2 save`.

## Bot-Verification

- `pm2 list` sollte `kanbanly-bot` als `online` zeigen.
- Logs müssen `[bot] eingeloggt als <Botname>#<discrim>` enthalten.
- `/ping` im Test-Server muss antworten.

## Bot-Stolperfallen

- Globale Slash-Commands brauchen bis zu 1h Propagation. Beim Entwickeln `DEV_GUILD_ID` setzen → sofort sichtbar.
- Privileged Intents (Server Members, Message Content) müssen im Developer Portal aktiviert sein, sonst crasht der Bot beim Login.
- Der Bot nutzt den **Service-Role-Key** für Supabase und umgeht damit RLS. Niemals diesen Key in die Next.js-App oder in den Browser bringen.
