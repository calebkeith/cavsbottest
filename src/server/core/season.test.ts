import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScheduleGameResponse } from './cavs-api.ts';
import { nextScheduledGame } from './season.ts';

const game = (gameId: string, startTime: string) => ({ gameId, startTime } as ScheduleGameResponse);

void test('selects the next scheduled game using Eastern schedule timestamps', () => {
  const selected = nextScheduledGame([
    game('later', '2026-10-23T19:00:00+00:00'),
    game('next', '2026-10-22T19:00:00+00:00'),
    game('past', '2026-10-21T19:00:00+00:00'),
  ], Date.parse('2026-10-22T22:00:00Z'));

  assert.equal(selected?.gameId, 'next');
});
