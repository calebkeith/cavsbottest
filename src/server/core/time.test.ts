import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEasternTime } from '../../shared/time.ts';

void test('interprets NBA schedule timestamps as Eastern wall-clock time', () => {
  const date = parseEasternTime('2026-10-22T19:00:00+00:00');

  assert.equal(date.toISOString(), '2026-10-22T23:00:00.000Z');
  assert.equal(date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  }), '7:00 PM');
});

void test('uses the correct Eastern offset across daylight saving time', () => {
  assert.equal(parseEasternTime('2026-01-10T19:00:00+00:00').toISOString(), '2026-01-11T00:00:00.000Z');
  assert.equal(parseEasternTime('2026-07-10T19:00:00+00:00').toISOString(), '2026-07-10T23:00:00.000Z');
});
