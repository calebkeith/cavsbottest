import { Hono } from 'hono';
import type { Context } from 'hono';
import { cavsBotApi } from '../core/cavs-api';

export const nba = new Hono();

const proxy = async <T>(handler: () => Promise<T>, c: Context) => {
  try {
    return c.json(await handler());
  } catch (error) {
    console.error('NBA API request failed:', error);
    const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : 502;
    return c.json({ status: 'error', message: 'NBA API request failed' }, status === 404 ? 404 : 502);
  }
};

nba.get('/teams', (c) => proxy(() => cavsBotApi.teams(), c));
nba.get('/teams/:team/schedule', (c) => proxy(() => cavsBotApi.teamSchedule(c.req.param('team'), c.req.query()), c));
nba.get('/teams/:team/next-game', (c) => proxy(() => cavsBotApi.nextGame(c.req.param('team')), c));
nba.get('/teams/:team/previous-game', (c) => proxy(() => cavsBotApi.previousGame(c.req.param('team')), c));
nba.get('/scoreboard/today', (c) => proxy(() => cavsBotApi.scoreboardToday(), c));
nba.get('/scoreboard', (c) => proxy(() => cavsBotApi.scoreboard(c.req.query('date')), c));
nba.get('/games/:gameId/boxscore', (c) => proxy(() => cavsBotApi.boxScore(c.req.param('gameId')), c));
nba.get('/games/:gameId/playbyplay', (c) => proxy(() => cavsBotApi.playByPlay(c.req.param('gameId')), c));
