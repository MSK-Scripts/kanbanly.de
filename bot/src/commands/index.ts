import type { SlashCommand } from '../types.js';
import ping from './ping.js';
import help from './help.js';
import welcome from './welcome.js';
import reactionroles from './reactionroles.js';

export const commands: SlashCommand[] = [ping, help, welcome, reactionroles];
export const commandMap = new Map(commands.map((c) => [c.data.name, c]));
