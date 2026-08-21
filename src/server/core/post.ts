import { reddit, redis } from '@devvit/web/server';
import { EntrypointHeight } from '@devvit/protos/json/reddit/devvit/post/v1/post.js';
import { cavsBotApi, type BoxScoreResponse, type ScheduleGameResponse } from './cavs-api';
import { SEASON_TYPES, seasonTypeLabel } from './season';
import { testBoxScore, testGame } from './test-game';

const THREADS_HASH = 'cavsbot:game-threads';
const easternDateTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});
const easternDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});

const formatParts = (formatter: Intl.DateTimeFormat, date: Date) => {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return formatter === easternDate
    ? `${parts.month}/${parts.day}/${parts.year}`
    : `${parts.month}/${parts.day}/${parts.year} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
};

const seasonLabel = (seasonType: number) => ` - ${seasonTypeLabel(seasonType)}`;

const formatMinutes = (minutes: string) => {
  const match = minutes.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  return match ? `${Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)}:${minutes.match(/PT(?:\d+H)?(?:\d+M)?(?:([\d.]+)S)?/)?.[1]?.split('.')[0]?.padStart(2, '0') ?? '00'}` : minutes;
};

const formatGameClock = (duration: string | null | undefined) => {
  if (!duration) return '-';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return duration;
  const totalSeconds = Math.round(Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
};

const statValue = (value: number | undefined) => String(value ?? 0);
const attempts = (made: number | undefined, attempted: number | undefined) => `${made ?? 0}-${attempted ?? 0}`;
const percentage = (value: number | undefined) => value == null ? '' : `${(value * 100).toFixed(1)}%`;

const teamBoxScoreMarkdown = (team: BoxScoreResponse['visitor']) => {
  const rows = (team.players ?? []).map((player) => {
    const stats = player.statistics;
    const role = !player.played ? 'DNP' : player.starter ? player.position ?? 'G' : 'B';
    return `| ${role} | ${player.firstName.charAt(0)}. ${player.familyName} | ${statValue(stats.points)} | ${statValue(stats.reboundsTotal)} | ${statValue(stats.assists)} | ${statValue(stats.plusMinusPoints)} | ${attempts(stats.fieldGoalsMade, stats.fieldGoalsAttempted)} (${percentage(stats.fieldGoalsPercentage)}) | ${attempts(stats.threePointersMade, stats.threePointersAttempted)} (${percentage(stats.threePointersPercentage)}) | ${attempts(stats.freeThrowsMade, stats.freeThrowsAttempted)} (${percentage(stats.freeThrowsPercentage)}) | ${statValue(stats.steals)} | ${statValue(stats.blocks)} | ${statValue(stats.foulsPersonal)} | ${statValue(stats.turnovers)} | ${formatMinutes(stats.minutes)} |`;
  });
  return [
    `### ${team.team.fullName ?? team.team.name ?? team.team.abbreviation ?? 'Team'} - ${team.score ?? '-'}`,
    '',
    '| Role | Player | PTS | REB | AST | +/- | FG | 3P | FT | STL | BLK | PF | TO | MIN |',
    '| :-- | :-- | --: | --: | --: | --: | :--: | :--: | :--: | --: | --: | --: | --: | :--: |',
    ...rows,
    '',
  ].join('\n');
};

const boxScoreMarkdown = (boxScore: BoxScoreResponse) => {
  const periods = boxScore.visitor.periods ?? [];
  const periodLabels = periods.map((period, index) => period.periodType === 'OVERTIME' ? `OT${index + 1}` : `Q${period.period}`);
  const periodScores = (team: BoxScoreResponse['visitor']) => periods.map((_, index) => team.periods?.[index]?.score ?? '-');
  const visitorPeriodScores = periodScores(boxScore.visitor);
  const homePeriodScores = periodScores(boxScore.home);
  const periodHeader = `| Team | ${periodLabels.join(' | ')} | Total |`;
  const periodDivider = `| :-- | ${periodLabels.map(() => '--:').join(' | ')} | --: |`;
  const periodRows = [
    `| ${boxScore.visitor.team.abbreviation ?? 'Away'} | ${visitorPeriodScores.join(' | ')} | **${boxScore.visitor.score ?? '-'}** |`,
    `| ${boxScore.home.team.abbreviation ?? 'Home'} | ${homePeriodScores.join(' | ')} | **${boxScore.home.score ?? '-'}** |`,
  ];
  const officials = (boxScore.officials ?? []).map((official) => `- ${String(official.name ?? official.displayName ?? 'Official')}${official.number ? ` (#${official.number})` : ''}`);
  return [
    '## Box Score',
    '',
    `Status: ${boxScore.gameStatusText ?? boxScore.gameState ?? 'Unavailable'} | Game clock: ${formatGameClock(boxScore.gameClock)}`,
    '',
    periodHeader,
    periodDivider,
    ...periodRows,
    '',
    teamBoxScoreMarkdown(boxScore.visitor),
    teamBoxScoreMarkdown(boxScore.home),
    '### Game Details',
    '',
    `- Arena: ${[boxScore.arena.name, boxScore.arena.city, boxScore.arena.state].filter(Boolean).join(', ') || 'Not available'}`,
    `- Attendance: ${boxScore.arena.attendance || 'Not available'}`,
    officials.length ? ['', '**Officials**', ...officials].join('\n') : '',
  ].join('\n');
};

const scoreLine = (boxScore?: BoxScoreResponse) => {
  const clevelandScore = boxScore?.home.team.abbreviation === 'CLE' ? boxScore.home.score : boxScore?.visitor.score;
  const opponentScore = boxScore?.home.team.abbreviation === 'CLE' ? boxScore.visitor.score : boxScore?.home.score;
  if (clevelandScore == null || opponentScore == null) return 'Score: Not available yet';
  return `Score: Cleveland ${clevelandScore}, opponent ${opponentScore}`;
};

const gameThreadText = (game: ScheduleGameResponse, boxScore?: BoxScoreResponse) => [
  `# Live Cavaliers Game Thread${seasonLabel(game.seasonType)}`,
  '',
  `**${matchup(game)}**`,
  '',
  `Status: ${boxScore?.gameStatusText ?? game.gameStatusText ?? 'Scheduled'}`,
  '',
  scoreLine(boxScore),
  '',
  'This is the live discussion thread for tonight\'s Cavaliers game.',
  boxScore ? ['', boxScoreMarkdown(boxScore)].join('\n') : '',
].join('\n');

const postGameText = (game: ScheduleGameResponse, boxScore: BoxScoreResponse) => [
  `# Post-Game Cavaliers Discussion${seasonLabel(game.seasonType)}`,
  '',
  `**${matchup(game)}**`,
  '',
  `Final: ${boxScore.gameStatusText ?? 'Final'}`,
  scoreLine(boxScore),
  '',
  'Share your thoughts on the game, the key moments, and what comes next.',
  '',
  boxScoreMarkdown(boxScore),
].join('\n');

const nextDayText = (game: ScheduleGameResponse, boxScore: BoxScoreResponse) => [
  `# Next-Day Cavaliers Discussion${seasonLabel(game.seasonType)}`,
  '',
  `**${matchup(game)}**`,
  '',
  scoreLine(boxScore),
  '',
  'What stood out from the game? Discuss the performances, adjustments, and takeaways.',
  '',
  boxScoreMarkdown(boxScore),
].join('\n');

const gameDayText = (game: ScheduleGameResponse) => [
  `# Cavaliers Game Day${seasonLabel(game.seasonType)}`,
  '',
  `**${matchup(game)}**`,
  '',
  '- Players and breakout candidates',
  '- Matchups and keys to the game',
  '- Predictions and final score picks',
  '- Lineup, rotation, and coaching decisions',
  '- Anything else on your mind, as always, keep it civil.',
  '',
  'Go Cavs and #LetEmKnow!',
].join('\n');

const matchup = (game: ScheduleGameResponse) => {
  const isHome = game.homeTeam.abbreviation === 'CLE';
  const opponent = isHome ? game.visitingTeam : game.homeTeam;
  const opponentName = [opponent.city, opponent.name].filter(Boolean).join(' ') || opponent.fullName || 'Other Team';
  return `Cleveland Cavaliers ${isHome ? 'vs.' : '@'} ${opponentName}`;
};

type AutomatedThreadKind = 'game' | 'post-game' | 'next-day' | 'game-day';
export type TestThreadKind = AutomatedThreadKind;

const reserveThread = async (gameId: string, kind: AutomatedThreadKind) => {
  const key = `${gameId}:${kind}`;
  const reserved = await redis.hSetNX(THREADS_HASH, key, 'pending');
  if (reserved !== 1) return false;
  return true;
};

const markAsAnnouncement = async (post: Awaited<ReturnType<typeof reddit.submitCustomPost>>) => {
  await Promise.all([post.sticky(1), post.distinguish()]);
};

const easternDateKey = (date: Date) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const addDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const easternHour = (date: Date) => Number(new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hour: 'numeric', hour12: false,
}).format(date));

export const createGameThread = async (game: ScheduleGameResponse, testFixture = false) => {
  if (!game.gameId || !(await reserveThread(game.gameId, 'game'))) return null;
  try {
    const initialBoxScore = testFixture
      ? testBoxScore
      : await cavsBotApi.boxScore(game.gameId).catch(() => undefined);
    const post = await reddit.submitCustomPost({
      title: `[Game Thread${seasonLabel(game.seasonType)}] ${matchup(game)} [${formatParts(easternDateTime, new Date(game.startTime))} ET]`,
      entry: 'default',
      postData: { gameId: game.gameId, threadType: 'game', seasonType: game.seasonType, testFixture },
      textFallback: { text: gameThreadText(game, initialBoxScore) },
      styles: {
        backgroundColor: '#FFFFFFFF',
        backgroundColorDark: '#041E42FF',
        height: EntrypointHeight.TALL,
      },
    });
    await markAsAnnouncement(post);
    await post.setSuggestedCommentSort('NEW');
    await redis.hSet(THREADS_HASH, { [`${game.gameId}:game`]: post.id });
    return post;
  } catch (error) {
    await redis.hDel(THREADS_HASH, [`${game.gameId}:game`]);
    throw error;
  }
};

export const createPostGameThread = async (game: ScheduleGameResponse, boxScore: BoxScoreResponse, testFixture = false) => {
  if (!game.gameId || !(await reserveThread(game.gameId, 'post-game'))) return null;
  try {
    const post = await reddit.submitCustomPost({
      title: `[Post Game Thread${seasonLabel(game.seasonType)}] ${matchup(game)} [${formatParts(easternDate, new Date(game.startTime))}]`,
      entry: 'default',
      postData: { gameId: game.gameId, threadType: 'post-game', seasonType: game.seasonType, isAvailable: boxScore.isAvailable, testFixture },
      textFallback: { text: postGameText(game, boxScore) },
      styles: {
        backgroundColor: '#FFFFFFFF',
        backgroundColorDark: '#041E42FF',
        height: EntrypointHeight.TALL,
      },
    });
    await markAsAnnouncement(post);
    await redis.hSet(THREADS_HASH, { [`${game.gameId}:post-game`]: post.id });
    return post;
  } catch (error) {
    await redis.hDel(THREADS_HASH, [`${game.gameId}:post-game`]);
    throw error;
  }
};

export const createNextDayDiscussionThread = async (game: ScheduleGameResponse, boxScore: BoxScoreResponse, testFixture = false) => {
  if (!game.gameId || !(await reserveThread(game.gameId, 'next-day'))) return null;
  try {
    const post = await reddit.submitCustomPost({
      title: `[Next Day Discussion${seasonLabel(game.seasonType)}] ${matchup(game)} [${formatParts(easternDate, new Date(game.startTime))}]`,
      entry: 'default',
      postData: { gameId: game.gameId, threadType: 'next-day', seasonType: game.seasonType, isAvailable: boxScore.isAvailable, testFixture },
      textFallback: { text: nextDayText(game, boxScore) },
      styles: {
        backgroundColor: '#FFFFFFFF',
        backgroundColorDark: '#041E42FF',
        height: EntrypointHeight.TALL,
      },
    });
    await markAsAnnouncement(post);
    await redis.hSet(THREADS_HASH, { [`${game.gameId}:next-day`]: post.id });
    return post;
  } catch (error) {
    await redis.hDel(THREADS_HASH, [`${game.gameId}:next-day`]);
    throw error;
  }
};

export const createGameDayThread = async (game: ScheduleGameResponse, testFixture = false) => {
  if (!game.gameId || !(await reserveThread(game.gameId, 'game-day'))) return null;
  try {
    const post = await reddit.submitCustomPost({
      title: `[Game Day Thread${seasonLabel(game.seasonType)}] ${matchup(game)} [${formatParts(easternDateTime, new Date(game.startTime))} ET]`,
      entry: 'default',
      postData: { gameId: game.gameId, threadType: 'game-day', seasonType: game.seasonType, testFixture },
      textFallback: { text: gameDayText(game) },
      styles: {
        backgroundColor: '#FFFFFFFF',
        backgroundColorDark: '#041E42FF',
        height: EntrypointHeight.TALL,
      },
    });
    await markAsAnnouncement(post);
    await redis.hSet(THREADS_HASH, { [`${game.gameId}:game-day`]: post.id });
    return post;
  } catch (error) {
    await redis.hDel(THREADS_HASH, [`${game.gameId}:game-day`]);
    throw error;
  }
};

export const createTestThread = async (kind: TestThreadKind) => {
  await redis.hDel(THREADS_HASH, [`${testGame.gameId}:${kind}`]);
  if (kind === 'game') return createGameThread(testGame, true);
  if (kind === 'game-day') return createGameDayThread(testGame, true);
  if (kind === 'next-day') return createNextDayDiscussionThread(testGame, testBoxScore, true);
  return createPostGameThread(testGame, testBoxScore, true);
};

const isCompleted = (boxScore: BoxScoreResponse) => {
  const state = `${boxScore.gameState ?? ''} ${boxScore.gameStatusText ?? ''}`.toLowerCase();
  return boxScore.isAvailable && (state.includes('final') || state.includes('complete'));
};

const updateGameThreadFallback = async (game: ScheduleGameResponse, existingBoxScore?: BoxScoreResponse) => {
  if (!game.gameId) return;
  const postId = await redis.hGet(THREADS_HASH, `${game.gameId}:game`);
  if (!postId || postId === 'pending') return;
  try {
    const boxScore = existingBoxScore ?? await cavsBotApi.boxScore(game.gameId);
    const post = await reddit.getPostById(postId as `t3_${string}`);
    await post.setTextFallback({ text: gameThreadText(game, boxScore) });
  } catch (error) {
    console.warn(`Live game fallback update failed for game ${game.gameId}:`, error);
  }
};

const updateCompletedThreadFallback = async (game: ScheduleGameResponse, boxScore: BoxScoreResponse, kind: 'post-game' | 'next-day') => {
  if (!game.gameId) return;
  const postId = await redis.hGet(THREADS_HASH, `${game.gameId}:${kind}`);
  if (!postId || postId === 'pending') return;
  try {
    const post = await reddit.getPostById(postId as `t3_${string}`);
    await post.setTextFallback({ text: kind === 'post-game' ? postGameText(game, boxScore) : nextDayText(game, boxScore) });
  } catch (error) {
    console.warn(`${kind} fallback update failed for game ${game.gameId}:`, error);
  }
};

export const createScheduledThreads = async () => {
  const teams = await cavsBotApi.teams();
  const cavaliers = teams.find((team) => team.abbreviation === 'CLE' || team.fullName?.toLowerCase() === 'cleveland cavaliers');
  if (!cavaliers) throw new Error('Cleveland Cavaliers team was not returned by the NBA API');

  const scheduleResults = await Promise.all(SEASON_TYPES.map((seasonType) => cavsBotApi.teamSchedule(String(cavaliers.id), { seasonType })));
  const schedule = scheduleResults.flat()
    .filter((game) => game.gameId && Number.isFinite(new Date(game.startTime).getTime()))
    .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime());
  const now = Date.now();
  const nextGame = schedule.find((game) => new Date(game.startTime).getTime() >= now);
  if (nextGame && new Date(nextGame.startTime).getTime() - now <= 2 * 60 * 60 * 1000) {
    await createGameThread(nextGame);
    await updateGameThreadFallback(nextGame);
  }

  const todayKey = easternDateKey(new Date(now));
  for (const game of schedule) {
    const gameDate = easternDateKey(new Date(game.startTime));
    if (gameDate === todayKey && easternHour(new Date(now)) >= 10 && new Date(game.startTime).getTime() > now) {
      await createGameDayThread(game);
    }
    if (new Date(game.startTime).getTime() >= now) continue;

    const boxScore = await cavsBotApi.boxScore(game.gameId!);
    if (!isCompleted(boxScore)) continue;
    await updateGameThreadFallback(game, boxScore);
    if (new Date(game.startTime).getTime() < now) {
      await createPostGameThread(game, boxScore);
      await updateCompletedThreadFallback(game, boxScore, 'post-game');
    }
    if (addDays(gameDate, 1) === todayKey && easternHour(new Date(now)) >= 7) {
      await createNextDayDiscussionThread(game, boxScore);
      await updateCompletedThreadFallback(game, boxScore, 'next-day');
    }
  }
};

export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: 'Cavs Community Discussion',
    entry: 'default',
    postData: { threadType: 'manual' },
    textFallback: { text: 'Cavaliers community discussion.' },
    styles: {
      backgroundColor: '#FFFFFFFF',
      backgroundColorDark: '#041E42FF',
      height: EntrypointHeight.TALL,
    },
  });
};
