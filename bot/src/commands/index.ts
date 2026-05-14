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
import remind from './remind.js';
import serverstats from './serverstats.js';
import ticket from './ticket.js';
import slowmode from './slowmode.js';
import roleall from './roleall.js';
import giveaway from './giveaway.js';
import birthday from './birthday.js';
import suggest from './suggest.js';
import guess from './guess.js';
import bypass from './bypass.js';

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
  remind,
  serverstats,
  ticket,
  slowmode,
  roleall,
  giveaway,
  birthday,
  suggest,
  guess,
  bypass,
];
export const commandMap = new Map(commands.map((c) => [c.data.name, c]));
