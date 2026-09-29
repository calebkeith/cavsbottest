import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import { cavsBotApi } from '../core/cavs-api';
import { testBoxScore, testGame } from '../core/test-game';
import { testPlayByPlay } from '../core/test-play-by-play';
import type {
  DecrementResponse,
  IncrementResponse,
  InitResponse,
} from '../../shared/api';

type ErrorResponse = {
  status: 'error';
  message: string;
};

const THREAD_DATA_CACHE_PREFIX = 'cavsbot:thread-data:v2:';
export const threadDataCacheKey = (gameId: string, threadType: string) => `${THREAD_DATA_CACHE_PREFIX}${gameId}:${threadType}`;
export const threadCoreCacheKey = (gameId: string, threadType: string) => `${threadDataCacheKey(gameId, threadType)}:core`;
export const threadPlayByPlayCacheKey = (gameId: string, threadType: string) => `${threadDataCacheKey(gameId, threadType)}:playbyplay`;
export const threadInsightsCacheKey = (gameId: string, threadType: string) => `${threadDataCacheKey(gameId, threadType)}:insights`;
export const threadInsightSectionCacheKey = (gameId: string, threadType: string, section: string) => `${threadDataCacheKey(gameId, threadType)}:insights:${section}`;
export const threadCacheGenerationKey = (gameId: string, threadType: string) => `${threadDataCacheKey(gameId, threadType)}:generation`;
const cacheTtlSeconds = (threadType: string) => threadType === 'game' ? 60 : 24 * 60 * 60;
const coreCacheTtlSeconds = (threadType: string) => threadType === 'game' ? 45 : 24 * 60 * 60;
const insightCacheTtlSeconds = (threadType: string) => threadType === 'game' ? 5 * 60 : 24 * 60 * 60;
const winProbabilityTimelineKey = (gameId: string) => `cavsbot:win-probability:${gameId}`;
const winProbabilityRefreshAt = new Map<string, number>();
const seasonFromStartTime = (startTime: string) => {
  const date = new Date(startTime);
  const startYear = date.getUTCMonth() >= 9 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};
const timed = async <T,>(label: string, task: Promise<T>) => {
  const startedAt = Date.now();
  try {
    return await task;
  } finally {
    console.log(`[thread-timing] ${label} ${Date.now() - startedAt}ms`);
  }
};

const durationSeconds = (duration: string | null) => {
  const match = duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  return match ? Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) : 0;
};

type WinProbabilitySample = {
  qtr: string;
  mintm: number;
  sectm: number;
  scr: number;
  poss: 'Y' | 'N';
  probability: number;
  recordedAt: string;
};

const saveWinProbabilityTimeline = async (gameId: string, timeline: WinProbabilitySample[]) => {
  if (!timeline.length) return;
  try {
    const timelineKey = winProbabilityTimelineKey(gameId);
    await redis.set(timelineKey, JSON.stringify(timeline.slice(-300)));
    await redis.expire(timelineKey, 7 * 24 * 60 * 60);
  } catch (error) {
    console.warn(`Win probability update failed for game ${gameId}:`, error);
  }
};

const recordWinProbability = async (gameId: string, boxScore: Awaited<ReturnType<typeof cavsBotApi.boxScore>>) => {
  const startedAt = Date.now();
  console.log(`[api-timing] win-probability start game=${gameId}`);
  try {
    const points = await cavsBotApi.winProbability(gameId);
    const clevelandIsHome = boxScore.home.team.abbreviation === 'CLE';
    const clevelandId = clevelandIsHome ? boxScore.home.team.id : boxScore.visitor.team.id;
    const timeline = points.map((point) => {
      const clock = Math.max(0, durationSeconds(point.clock));
      const probability = clevelandIsHome ? Number(point.homeWinProbability) : Number(point.awayWinProbability);
      return {
        qtr: point.period > 4 ? 'OT' : `Q${point.period}`,
        mintm: Math.floor(clock / 60),
        sectm: Math.floor(clock % 60),
        scr: clevelandIsHome ? point.homeScore - point.awayScore : point.awayScore - point.homeScore,
        poss: point.possessionTeamId === clevelandId ? 'Y' as const : 'N' as const,
        probability,
        recordedAt: new Date().toISOString(),
      } satisfies WinProbabilitySample;
    }).filter((sample) => Number.isFinite(sample.probability));
    console.log(`[win-probability] game=${gameId} points=${points.length} timeline=${timeline.length}`);
    await saveWinProbabilityTimeline(gameId, timeline);
  } catch (error) {
    console.warn(`Win probability update failed for game ${gameId}:`, error);
  } finally {
    console.log(`[api-timing] win-probability total=${Date.now() - startedAt}ms game=${gameId}`);
  }
};

const readWinProbabilityTimeline = async (gameId: string) => {
  const value = await redis.get(winProbabilityTimelineKey(gameId));
  return value ? JSON.parse(value) as Array<Record<string, unknown>> : [];
};

const refreshWinProbabilityInBackground = (gameId: string, boxScore: Awaited<ReturnType<typeof cavsBotApi.boxScore>>) => {
  const now = Date.now();
  if (now - (winProbabilityRefreshAt.get(gameId) ?? 0) < 30_000) return;
  winProbabilityRefreshAt.set(gameId, now);
  void recordWinProbability(gameId, boxScore);
};

export const api = new Hono();

const threadContext = () => {
  const postData = context.postData;
  const gameId = typeof postData?.gameId === 'string' ? postData.gameId : undefined;
  const threadType = typeof postData?.threadType === 'string' ? postData.threadType : 'game';
  return { postData, gameId, threadType, isTestFixture: postData?.testFixture === true || gameId === testBoxScore.gameId };
};

api.get('/thread/play-by-play', async (c) => {
  const startedAt = Date.now();
  const { gameId, threadType, isTestFixture } = threadContext();
  if (!gameId) return c.json<ErrorResponse>({ status: 'error', message: 'This post is not linked to a game' }, 400);
  const cacheKey = threadPlayByPlayCacheKey(gameId, threadType);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`[thread-cache] hit ${cacheKey}`);
      return c.json({ playByPlay: JSON.parse(cached) });
    }

    const cachedFull = await redis.get(threadDataCacheKey(gameId, threadType));
    if (cachedFull) {
      const cachedResponse = JSON.parse(cachedFull) as { playByPlay?: unknown };
      if (Array.isArray(cachedResponse.playByPlay) && cachedResponse.playByPlay.length > 0) {
        await redis.set(cacheKey, JSON.stringify(cachedResponse.playByPlay));
        await redis.expire(cacheKey, coreCacheTtlSeconds(threadType));
        return c.json({ playByPlay: cachedResponse.playByPlay });
      }
    }

    const playByPlay = isTestFixture
      ? testPlayByPlay
      : await timed('playbyplay-deferred', cavsBotApi.playByPlay(gameId));
    await redis.set(cacheKey, JSON.stringify(playByPlay));
    await redis.expire(cacheKey, coreCacheTtlSeconds(threadType));
    return c.json({ playByPlay });
  } catch (error) {
    console.error(`Deferred play-by-play error for game ${gameId}:`, error);
    return c.json<ErrorResponse>({ status: 'error', message: 'Unable to load play-by-play' }, 502);
  } finally {
    console.log(`[api-timing] thread/play-by-play total=${Date.now() - startedAt}ms game=${gameId} type=${threadType}`);
  }
});

api.get('/thread/core', async (c) => {
  const startedAt = Date.now();
  const { postData, gameId, threadType, isTestFixture } = threadContext();
  if (!gameId) return c.json<ErrorResponse>({ status: 'error', message: 'This post is not linked to a game' }, 400);
  const summaryOnly = c.req.query('summary') === '1';
  const fullCacheKey = threadDataCacheKey(gameId, threadType);
  const cacheKey = threadCoreCacheKey(gameId, threadType);
  const responseForClient = (response: Record<string, unknown>) => summaryOnly ? { ...response, playByPlay: [] } : response;

  try {
    const cacheReadStartedAt = Date.now();
    const [generation, cachedFull, cached] = await Promise.all([
      redis.get(threadCacheGenerationKey(gameId, threadType)),
      redis.get(fullCacheKey),
      redis.get(cacheKey),
    ]);
    console.log(`[api-timing] thread/core cache-read=${Date.now() - cacheReadStartedAt}ms game=${gameId} type=${threadType} full=${Boolean(cachedFull)} core=${Boolean(cached)}`);
    if (cachedFull) {
      console.log(`[thread-cache] hit ${fullCacheKey}`);
      const cachedResponse = JSON.parse(cachedFull) as Record<string, unknown>;
      if (!summaryOnly && (threadType === 'game' || threadType === 'post-game') && cachedResponse.boxScore) {
        const boxScore = cachedResponse.boxScore as Awaited<ReturnType<typeof cavsBotApi.boxScore>>;
        refreshWinProbabilityInBackground(gameId, boxScore);
      }
      const winProbability = summaryOnly ? [] : await readWinProbabilityTimeline(gameId);
      return c.json({ ...responseForClient(cachedResponse), winProbability, insightsReady: true });
    }
    if (cached) {
      console.log(`[thread-cache] hit ${cacheKey}`);
      const cachedResponse = JSON.parse(cached) as Record<string, unknown>;
      if (!summaryOnly && (threadType === 'game' || threadType === 'post-game') && cachedResponse.boxScore) {
        const boxScore = cachedResponse.boxScore as Awaited<ReturnType<typeof cavsBotApi.boxScore>>;
        refreshWinProbabilityInBackground(gameId, boxScore);
      }
      const winProbability = summaryOnly ? [] : await readWinProbabilityTimeline(gameId);
      return c.json({ ...responseForClient(cachedResponse), winProbability, insightsReady: false });
    }
    console.log(`[thread-cache] miss ${cacheKey}`);
    const [boxScore, playByPlay, game] = await Promise.all([
      timed('boxscore', isTestFixture ? cavsBotApi.boxScore(gameId).catch(() => testBoxScore) : cavsBotApi.boxScore(gameId)),
      summaryOnly ? Promise.resolve([] as typeof testPlayByPlay) : timed('playbyplay', isTestFixture ? cavsBotApi.playByPlay(gameId).catch(() => testPlayByPlay) : cavsBotApi.playByPlay(gameId)),
      timed('game', isTestFixture ? cavsBotApi.game(gameId).catch(() => testGame) : cavsBotApi.game(gameId)),
    ]);
    if (!summaryOnly && (threadType === 'game' || threadType === 'post-game')) refreshWinProbabilityInBackground(gameId, boxScore);
    const winProbability = await readWinProbabilityTimeline(gameId);
    const response = { gameId, threadType, seasonType: postData?.seasonType ?? 2, boxScore, playByPlay, game, records: { visitor: null, home: null }, standings: [], recentForm: [], matchups: [], fourFactors: null, winProbability, insightsReady: false, fetchedAt: new Date().toISOString() };
    try {
      if (await redis.get(threadCacheGenerationKey(gameId, threadType)) !== generation) {
        console.log(`[thread-cache] discarded stale core response ${cacheKey}`);
      } else {
        await redis.set(cacheKey, JSON.stringify(response));
        await redis.expire(cacheKey, coreCacheTtlSeconds(threadType));
      }
    } catch (error) {
      console.warn(`Thread core cache write failed for game ${gameId}:`, error);
    }
    return c.json(responseForClient(response));
  } catch (error) {
    console.error(`Thread core data error for game ${gameId}:`, error);
    return c.json<ErrorResponse>({ status: 'error', message: 'Unable to load game data' }, 502);
  } finally {
    console.log(`[thread-timing] total-core ${Date.now() - startedAt}ms`);
  }
});

api.get('/thread/insights', async (c) => {
  const startedAt = Date.now();
  const { postData, gameId, threadType, isTestFixture } = threadContext();
  if (!gameId) return c.json<ErrorResponse>({ status: 'error', message: 'This post is not linked to a game' }, 400);
  const visitorTeamId = Number(c.req.query('visitorTeamId'));
  const homeTeamId = Number(c.req.query('homeTeamId'));
  if (!Number.isInteger(visitorTeamId) || !Number.isInteger(homeTeamId)) return c.json<ErrorResponse>({ status: 'error', message: 'Team ids are required' }, 400);
  const cacheKey = threadInsightsCacheKey(gameId, threadType);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`[thread-cache] hit ${cacheKey}`);
      return c.json({ ...JSON.parse(cached), insightsReady: true });
    }
    console.log(`[thread-cache] miss ${cacheKey}`);
    const matchupSeasonType = postData?.seasonType === 2 || postData?.seasonType === 3 ? 3 : undefined;
    const pastMatchups = (team: number, opponent: number) => cavsBotApi.request<typeof testGame[]>(`/api/v1/teams/${encodeURIComponent(String(team))}/matchups/${encodeURIComponent(String(opponent))}/past`, { count: 10, seasonType: matchupSeasonType });
    const requestedClevelandTeamId = Number(c.req.query('clevelandTeamId'));
    const recentFormTeamId = Number.isInteger(requestedClevelandTeamId) ? requestedClevelandTeamId : visitorTeamId;
    const teams = [{ id: visitorTeamId, abbreviation: 'CLE' }, { id: homeTeamId, abbreviation: 'OPP' }];
    const gameSeason = c.req.query('season') ?? '2025-26';
    const enrichment = await Promise.allSettled([
      ...teams.map((team) => timed(`record-${team.abbreviation}`, isTestFixture ? cavsBotApi.record(String(team.id)).catch(() => ({ team: team.abbreviation, record: null, wins: '0', losses: '0' })) : cavsBotApi.record(String(team.id)))),
      timed('standings', isTestFixture ? cavsBotApi.standings().catch(() => []) : cavsBotApi.standings()),
      timed('recent-form', isTestFixture ? cavsBotApi.recentForm(String(recentFormTeamId), 5).catch(() => []) : cavsBotApi.recentForm(String(recentFormTeamId), 5)),
      isTestFixture ? timed('past-matchups', pastMatchups(visitorTeamId, homeTeamId).catch(() => [testGame])) : timed('past-matchups', pastMatchups(visitorTeamId, homeTeamId)),
      timed(`four-factors-${gameSeason}`, isTestFixture ? cavsBotApi.teamFourFactors(String(visitorTeamId), { season: gameSeason }).catch(() => null) : cavsBotApi.teamFourFactors(String(visitorTeamId), { season: gameSeason })),
    ]);
    const enrichmentValue = <T,>(index: number, fallback: T) => {
      const result = enrichment[index];
      return result?.status === 'fulfilled' ? result.value as T : fallback;
    };
    const response = { records: { visitor: enrichmentValue(0, null), home: enrichmentValue(1, null) }, standings: enrichmentValue(2, []), recentForm: enrichmentValue(3, []), matchups: enrichmentValue(4, [] as typeof testGame[]).filter((matchup) => matchup.seasonType !== 2), fourFactors: enrichmentValue(5, null), insightsReady: true };
    try {
      await redis.set(cacheKey, JSON.stringify(response));
      await redis.expire(cacheKey, insightCacheTtlSeconds(threadType));
    } catch (error) {
      console.warn(`Thread insights cache write failed for game ${gameId}:`, error);
    }
    return c.json(response);
  } catch (error) {
    console.error(`Thread insights error for game ${gameId}:`, error);
    return c.json<ErrorResponse>({ status: 'error', message: 'Unable to load game insights' }, 502);
  } finally {
    console.log(`[thread-timing] total-insights ${Date.now() - startedAt}ms`);
  }
});

api.get('/thread/insight', async (c) => {
  const startedAt = Date.now();
  const { postData, gameId, threadType, isTestFixture } = threadContext();
  if (!gameId) return c.json<ErrorResponse>({ status: 'error', message: 'This post is not linked to a game' }, 400);
  const section = c.req.query('section');
  const validSections = ['records', 'standings', 'recent-form', 'past-matchups', 'four-factors'] as const;
  if (!section || !validSections.includes(section as typeof validSections[number])) return c.json<ErrorResponse>({ status: 'error', message: 'Unknown insight section' }, 400);
  const visitorTeamId = Number(c.req.query('visitorTeamId'));
  const homeTeamId = Number(c.req.query('homeTeamId'));
  if (!Number.isInteger(visitorTeamId) || !Number.isInteger(homeTeamId)) return c.json<ErrorResponse>({ status: 'error', message: 'Team ids are required' }, 400);
  const cacheKey = threadInsightSectionCacheKey(gameId, threadType, section);
  const sectionCacheKey = section === 'four-factors'
    ? threadInsightSectionCacheKey(gameId, threadType, 'four-factors-v3')
    : section === 'recent-form'
      ? threadInsightSectionCacheKey(gameId, threadType, 'recent-form-v2')
    : cacheKey;

  try {
    const cached = await redis.get(sectionCacheKey);
    if (cached) {
      console.log(`[thread-cache] hit ${sectionCacheKey}`);
      return c.json(JSON.parse(cached));
    }
    console.log(`[thread-cache] miss ${sectionCacheKey}`);
    const generation = await redis.get(threadCacheGenerationKey(gameId, threadType));
    const matchupSeasonType = postData?.seasonType === 2 || postData?.seasonType === 3 ? 3 : undefined;
    const gameSeason = c.req.query('season') ?? '2025-26';
    const requestedClevelandTeamId = Number(c.req.query('clevelandTeamId'));
    const recentFormTeamId = Number.isInteger(requestedClevelandTeamId) ? requestedClevelandTeamId : visitorTeamId;
    let response: Record<string, unknown>;
    if (section === 'records') {
      const [visitor, home] = await Promise.all([
        timed('record-CLE', isTestFixture ? cavsBotApi.record(String(visitorTeamId)).catch(() => null) : cavsBotApi.record(String(visitorTeamId))),
        timed('record-OPP', isTestFixture ? cavsBotApi.record(String(homeTeamId)).catch(() => null) : cavsBotApi.record(String(homeTeamId))),
      ]);
      response = { records: { visitor, home } };
    } else if (section === 'standings') {
      response = { standings: await timed('standings', isTestFixture ? cavsBotApi.standings().catch(() => []) : cavsBotApi.standings()) };
    } else if (section === 'recent-form') {
      response = { recentForm: await timed('recent-form', isTestFixture ? cavsBotApi.recentForm(String(recentFormTeamId), 5).catch(() => []) : cavsBotApi.recentForm(String(recentFormTeamId), 5)) };
    } else if (section === 'past-matchups') {
      const matchups = await timed('past-matchups', isTestFixture
        ? cavsBotApi.request<typeof testGame[]>(`/api/v1/teams/${visitorTeamId}/matchups/${homeTeamId}/past`, { count: 10, seasonType: matchupSeasonType }).catch(() => [testGame])
        : cavsBotApi.request<typeof testGame[]>(`/api/v1/teams/${visitorTeamId}/matchups/${homeTeamId}/past`, { count: 10, seasonType: matchupSeasonType }));
      response = { matchups: matchups.filter((matchup) => matchup.seasonType !== 2) };
    } else {
      const clevelandTeamId = Number(c.req.query('clevelandTeamId'));
      if (!Number.isInteger(clevelandTeamId) || (clevelandTeamId !== visitorTeamId && clevelandTeamId !== homeTeamId)) return c.json<ErrorResponse>({ status: 'error', message: 'Cleveland team id is required' }, 400);
      const [opponent, cavaliers] = await Promise.all([
        timed(`four-factors-${visitorTeamId}`, isTestFixture ? cavsBotApi.teamFourFactors(String(visitorTeamId), { season: gameSeason }).catch(() => null) : cavsBotApi.teamFourFactors(String(visitorTeamId), { season: gameSeason })),
        timed(`four-factors-${homeTeamId}`, isTestFixture ? cavsBotApi.teamFourFactors(String(homeTeamId), { season: gameSeason }).catch(() => null) : cavsBotApi.teamFourFactors(String(homeTeamId), { season: gameSeason })),
      ]);
      response = { fourFactors: { cleveland: clevelandTeamId === visitorTeamId ? opponent : cavaliers, opponent: clevelandTeamId === visitorTeamId ? cavaliers : opponent } };
    }
    if (await redis.get(threadCacheGenerationKey(gameId, threadType)) !== generation) {
      console.log(`[thread-cache] discarded stale ${section} response ${sectionCacheKey}`);
    } else {
      await redis.set(sectionCacheKey, JSON.stringify(response));
      await redis.expire(sectionCacheKey, insightCacheTtlSeconds(threadType));
    }
    return c.json(response);
  } catch (error) {
    console.error(`Thread insight section ${section} failed for game ${gameId}:`, error);
    return c.json<ErrorResponse>({ status: 'error', message: 'Unable to load insight section' }, 502);
  } finally {
    console.log(`[thread-timing] ${section ?? 'unknown'}-total ${Date.now() - startedAt}ms`);
  }
});

api.get('/thread', async (c) => {
  const postData = context.postData;
  const gameId = typeof postData?.gameId === 'string' ? postData.gameId : undefined;
  if (!gameId) return c.json<ErrorResponse>({ status: 'error', message: 'This post is not linked to a game' }, 400);
  const isTestFixture = postData?.testFixture === true || gameId === testBoxScore.gameId;
  const threadType = typeof postData?.threadType === 'string' ? postData.threadType : 'game';
  const cacheKey = threadDataCacheKey(gameId, threadType);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`[thread-cache] hit ${cacheKey}`);
      return c.json<Record<string, unknown>>(JSON.parse(cached));
    }
    console.log(`[thread-cache] miss ${cacheKey}`);
  } catch (error) {
    console.warn(`Thread cache read failed for game ${gameId}:`, error);
  }

  try {
    const [boxScore, playByPlay, game] = await Promise.all([
      timed('boxscore', isTestFixture ? cavsBotApi.boxScore(gameId).catch(() => testBoxScore) : cavsBotApi.boxScore(gameId)),
      timed('playbyplay', isTestFixture ? cavsBotApi.playByPlay(gameId).catch(() => testPlayByPlay) : cavsBotApi.playByPlay(gameId)),
      timed('game', isTestFixture ? cavsBotApi.game(gameId).catch(() => testGame) : cavsBotApi.game(gameId)),
    ]);
    const visitorGameTeam = game.visitingTeam;
    const homeGameTeam = game.homeTeam;
    const gameSeason = seasonFromStartTime(game.startTime);
    const teams = [visitorGameTeam, homeGameTeam];
    const matchupSeasonType = game.seasonType === 2 || game.seasonType === 3 ? 3 : undefined;
    const pastMatchups = (team: number, opponent: number) => cavsBotApi.request<typeof testGame[]>(`/api/v1/teams/${encodeURIComponent(String(team))}/matchups/${encodeURIComponent(String(opponent))}/past`, { count: 10, seasonType: matchupSeasonType });
    const enrichment = await Promise.allSettled([
      ...teams.map((team) => timed(`record-${team.abbreviation}`, isTestFixture
        ? cavsBotApi.record(String(team.id)).catch(() => ({ team: team.abbreviation, record: null, wins: '0', losses: '0' }))
        : cavsBotApi.record(String(team.id)))),
      timed('standings', isTestFixture ? cavsBotApi.standings().catch(() => []) : cavsBotApi.standings()),
      timed('recent-form', isTestFixture ? cavsBotApi.recentForm(String(visitorGameTeam.id), 5).catch(() => []) : cavsBotApi.recentForm(String(visitorGameTeam.id), 5)),
      isTestFixture
        ? timed('past-matchups', pastMatchups(visitorGameTeam.id, homeGameTeam.id).catch(() => [testGame]))
        : timed('past-matchups', pastMatchups(visitorGameTeam.id, homeGameTeam.id)),
      timed(`four-factors-${gameSeason}`, isTestFixture
        ? cavsBotApi.teamFourFactors(String(visitorGameTeam.id), { season: gameSeason }).catch(() => null)
        : cavsBotApi.teamFourFactors(String(visitorGameTeam.id), { season: gameSeason })),
    ]);
    const enrichmentValue = <T,>(index: number, fallback: T) => {
      const result = enrichment[index];
      return result?.status === 'fulfilled' ? result.value as T : fallback;
    };
    const matchupHistory = enrichmentValue(4, [] as typeof testGame[]).filter((matchup) => matchup.seasonType !== 2);
    const response = {
      gameId,
      threadType,
      seasonType: postData?.seasonType ?? 2,
      boxScore,
      playByPlay,
      game,
      records: { visitor: enrichmentValue(0, null), home: enrichmentValue(1, null) },
      standings: enrichmentValue(2, []),
      recentForm: enrichmentValue(3, []),
      matchups: matchupHistory,
      fourFactors: enrichmentValue(5, null),
      fetchedAt: new Date().toISOString(),
    };
    try {
      await redis.set(cacheKey, JSON.stringify(response));
      await redis.expire(cacheKey, cacheTtlSeconds(threadType));
    } catch (error) {
      console.warn(`Thread cache write failed for game ${gameId}:`, error);
    }
    return c.json(response);
  } catch (error) {
    console.error(`Thread data error for game ${gameId}:`, error);
    if (isTestFixture) {
      return c.json<Record<string, unknown>>({
        gameId,
        threadType: postData?.threadType ?? 'game',
        seasonType: testGame.seasonType,
        boxScore: testBoxScore,
        playByPlay: testPlayByPlay,
        game: testGame,
        records: { visitor: null, home: null },
        standings: [],
        recentForm: [],
        matchups: [testGame],
        fourFactors: null,
        fetchedAt: new Date().toISOString(),
      });
    }
    return c.json<ErrorResponse>({ status: 'error', message: 'Unable to load live game data' }, 502);
  }
});

api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    console.error('API Init Error: postId not found in devvit context');
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  try {
    const [count, username] = await Promise.all([
      redis.get('count'),
      reddit.getCurrentUsername(),
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId: postId,
      count: count ? parseInt(count) : 0,
      username: username ?? 'anonymous',
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = 'Unknown error during initialization';
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    return c.json<ErrorResponse>(
      { status: 'error', message: errorMessage },
      400
    );
  }
});

api.post('/increment', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', 1);
  return c.json<IncrementResponse>({
    count,
    postId,
    type: 'increment',
  });
});

api.post('/decrement', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', -1);
  return c.json<DecrementResponse>({
    count,
    postId,
    type: 'decrement',
  });
});
