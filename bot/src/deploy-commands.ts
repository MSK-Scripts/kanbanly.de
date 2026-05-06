import { REST, Routes } from 'discord.js';
import { env } from './env.js';
import { commands } from './commands/index.js';

const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);
const body = commands.map((c) => c.data.toJSON());

async function main() {
  if (env.DEV_GUILD_ID) {
    const data = (await rest.put(
      Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DEV_GUILD_ID),
      { body },
    )) as unknown[];
    console.log(
      `[deploy] ${data.length} Guild-Commands registriert (Guild ${env.DEV_GUILD_ID}) — sofort sichtbar`,
    );
  } else {
    const data = (await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
      body,
    })) as unknown[];
    console.log(
      `[deploy] ${data.length} Global-Commands registriert — Propagation bis zu 1h`,
    );
  }
}

main().catch((err) => {
  console.error('[deploy] Fehler:', err);
  process.exit(1);
});
