import type { SlashCommand } from '../types.js';
import ping from './ping.js';
import help from './help.js';

export const commands: SlashCommand[] = [ping, help];
export const commandMap = new Map(commands.map((c) => [c.data.name, c]));
