import type { ScheduleGameResponse } from './cavs-api';
import { parseEasternTime } from '../../shared/time';

export const PRESEASON = 2;
export const REGULAR_SEASON = 3;
export const POSTSEASON = 1;
export const SEASON_TYPES = [PRESEASON, REGULAR_SEASON, POSTSEASON] as const;

const validGames = (schedule: ScheduleGameResponse[]) => schedule
  .filter((game) => game.gameId && Number.isFinite(parseEasternTime(game.startTime).getTime()))
  .sort((left, right) => parseEasternTime(left.startTime).getTime() - parseEasternTime(right.startTime).getTime());

export const currentSeasonType = (schedule: ScheduleGameResponse[], now = Date.now()) => {
  const sorted = validGames(schedule);
  const nextGame = sorted.find((game) => parseEasternTime(game.startTime).getTime() >= now);
  return nextGame?.seasonType ?? sorted.at(-1)?.seasonType ?? REGULAR_SEASON;
};

export const seasonTypeLabel = (seasonType: number) => {
  if (seasonType === PRESEASON) return 'Preseason';
  if (seasonType === POSTSEASON) return 'Postseason';
  return 'Regular Season';
};