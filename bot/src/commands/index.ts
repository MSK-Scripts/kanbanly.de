import type { SlashCommand } from '../types.js';
import ping from './ping.js';
import help from './help.js';
import welcome from './welcome.js';
import reactionroles from './reactionroles.js';
import warn from './warn.js';
import kick from './kick.js';
import ban from './ban.js';
import timeout from './timeout.js';
import clear from './clear.js';
import rank from './rank.js';
import leaderboard from './leaderboard.js';
import tag from './tag.js';
import poll from './poll.js';
import customcmd from './customcmd.js';

export const commands: SlashCommand[] = [
  ping,
  help,
  welcome,
  reactionroles,
  warn,
  kick,
  ban,
  timeout,
  clear,
  rank,
  leaderboard,
  tag,
  poll,
  customcmd,
];
export const commandMap = new Map(commands.map((c) => [c.data.name, c]));
