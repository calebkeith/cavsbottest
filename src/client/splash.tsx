import './index.css';

import { Fragment, StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

type PlayerStatisticsResponse = {
  minutes: string;
  points: number;
  assists: number;
  reboundsTotal: number;
  reboundsOffensive: number;
  reboundsDefensive: number;
  steals: number;
  blocks: number;
  foulsPersonal: number;
  turnovers: number;
  plusMinusPoints: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  fieldGoalsPercentage: number;
  twoPointersMade: number;
  twoPointersAttempted: number;
  twoPointersPercentage: number;
  threePointersMade: number;
  threePointersAttempted: number;
  threePointersPercentage: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  freeThrowsPercentage: number;
};

type BoxScorePlayerResponse = {
  firstName: string;
  familyName: string;
  position: string | null;
  played: boolean;
  starter: boolean;
  statistics: PlayerStatisticsResponse;
};

type BoxScoreTeam = {
  team: {
    abbreviation: string | null;
    id?: number;
    city: string | null;
    name: string | null;
    fullName: string | null;
  };
  score: number | null;
  periods?: Array<{ period: number; periodType: string | null; score: number }> | null;
  players?: BoxScorePlayerResponse[];
};

type BoxScoreResponse = {
  gameClock: string | null;
  gameState: string | null;
  gameStatusText: string | null;
  arena: { name: string | null; city: string | null; state: string | null; attendance: number };
  visitor: BoxScoreTeam;
  home: BoxScoreTeam;
  officials?: Array<Record<string, unknown>> | null;
};

type ScheduleGameResponse = {
  gameId: string | null;
  startTime: string;
  seasonType: number;
  gameLabel: string | null;
  gameStatus: number;
  gameStatusText: string | null;
  isFinal: boolean;
  visitingScore: number | null;
  homeScore: number | null;
  winner: BoxScoreTeam['team'] | null;
  visitingTeam: BoxScoreTeam['team'];
  homeTeam: BoxScoreTeam['team'];
  arena: BoxScoreResponse['arena'];
};

type RecordResponse = {
  team: string | null;
  record: string | null;
  wins: string | null;
  losses: string | null;
};

type StandingResponse = {
  team: BoxScoreTeam['team'];
  conference: number;
  wins: string | null;
  losses: string | null;
  winPercentage: string | null;
  gamesBehind: number;
  streak: string | null;
};

type PlayByPlayEvent = Record<string, unknown>;

type ThreadResponse = {
  gameId: string;
  threadType: string;
  boxScore: BoxScoreResponse;
  playByPlay: PlayByPlayEvent[];
  game: ScheduleGameResponse;
  records: { visitor: RecordResponse | null; home: RecordResponse | null };
  standings: StandingResponse[];
  recentForm: ScheduleGameResponse[];
  matchups: ScheduleGameResponse[];
  fourFactors: Record<string, unknown> | null;
  insightsReady?: boolean;
  fetchedAt: string;
};

const Skeleton = ({ className }: { className: string }) => <span aria-hidden="true" className={`block animate-pulse rounded bg-[#354052] ${className}`} />;

const seasonFromStartTime = (startTime: string) => {
  const date = new Date(startTime);
  const startYear = date.getUTCMonth() >= 9 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const formatPercentage = (value: number) => value === 0 ? '' : `${(value * 100).toFixed(2).replace(/\.00$/, '')}%`;

const formatMinutes = (duration: string) => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return '-';
  const totalSeconds = Math.round(Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
};

const formatGameClock = (duration: string | null | undefined) => {
  if (!duration) return '-';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return duration;
  const totalSeconds = Math.round(Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
};

const playByPlayText = (event: PlayByPlayEvent) => {
  const description = ['description', 'text', 'actionDescription', 'detail'].map((key) => event[key]).find((value): value is string => typeof value === 'string' && value.length > 0);
  if (description) return description;
  const player = event.playerName ?? event.player ?? event.personName;
  const action = event.actionType ?? event.eventType ?? event.type;
  return [event.period ? `Q${event.period}` : null, event.clock ?? event.gameClock, player, action].filter((value): value is string | number => typeof value === 'string' || typeof value === 'number').join(' - ') || 'Play details unavailable';
};

const eventString = (event: PlayByPlayEvent, key: string) => {
  const value = event[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
};

const eventNumber = (event: PlayByPlayEvent, key: string) => {
  const value = event[key];
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const playerDisplayName = (player: BoxScorePlayerResponse) => `${player.firstName.charAt(0)}. ${player.familyName}`;

const topPlayer = (team: BoxScoreTeam, stat: keyof PlayerStatisticsResponse) => [...(team.players ?? [])]
  .filter((player) => player.played)
  .sort((left, right) => Number(right.statistics[stat]) - Number(left.statistics[stat]))[0];

const formatRecord = (record: RecordResponse | null | undefined) => record?.record || (record?.wins != null && record?.losses != null ? `${record.wins}-${record.losses}` : 'Record unavailable');

const teamShooting = (team: BoxScoreTeam | undefined) => {
  const players = team?.players ?? [];
  const totals = players.reduce((result, player) => ({
    fieldMade: result.fieldMade + player.statistics.fieldGoalsMade,
    fieldAttempted: result.fieldAttempted + player.statistics.fieldGoalsAttempted,
    threeMade: result.threeMade + player.statistics.threePointersMade,
    threeAttempted: result.threeAttempted + player.statistics.threePointersAttempted,
    freeMade: result.freeMade + player.statistics.freeThrowsMade,
    freeAttempted: result.freeAttempted + player.statistics.freeThrowsAttempted,
  }), { fieldMade: 0, fieldAttempted: 0, threeMade: 0, threeAttempted: 0, freeMade: 0, freeAttempted: 0 });
  const percentage = (made: number, attempted: number) => attempted ? (made / attempted) * 100 : null;
  const display = (made: number, attempted: number) => {
    const value = percentage(made, attempted);
    return value === null ? '-' : `${value.toFixed(1)}% (${made}/${attempted})`;
  };
  return {
    field: { value: percentage(totals.fieldMade, totals.fieldAttempted), display: display(totals.fieldMade, totals.fieldAttempted) },
    three: { value: percentage(totals.threeMade, totals.threeAttempted), display: display(totals.threeMade, totals.threeAttempted) },
    free: { value: percentage(totals.freeMade, totals.freeAttempted), display: display(totals.freeMade, totals.freeAttempted) },
  };
};

const scheduledOpponent = (game: ScheduleGameResponse, abbreviation: string) => game.homeTeam.abbreviation === abbreviation ? game.visitingTeam.fullName : game.homeTeam.fullName;

const matchupWinner = (game: ScheduleGameResponse) => game.winner?.abbreviation
  ?? (game.visitingScore !== null && game.homeScore !== null && game.visitingScore !== game.homeScore
    ? game.visitingScore > game.homeScore ? game.visitingTeam.abbreviation : game.homeTeam.abbreviation
    : null);

const factorEntries = (factors: Record<string, unknown> | null) => {
  const overall = factors?.overall;
  const resultSets = factors?.resultSets;
  const overallResultSet = Array.isArray(resultSets)
    ? resultSets.find((resultSet) => typeof resultSet === 'object' && resultSet !== null && (resultSet as Record<string, unknown>).name === 'OverallTeamDashboard') as Record<string, unknown> | undefined
    : undefined;
  const resultSetRow = Array.isArray(overallResultSet?.rows) && overallResultSet.rows[0] && typeof overallResultSet.rows[0] === 'object'
    ? overallResultSet.rows[0] as Record<string, unknown>
    : undefined;
  const stats = resultSetRow ?? (Array.isArray(overall) && overall[0] && typeof overall[0] === 'object' ? overall[0] as Record<string, unknown> : factors);
  if (!stats) return [];
  const labels: Record<string, string> = {
    effectiveFieldGoalPercentage: 'eFG%',
    freeThrowAttemptRate: 'FT rate',
    teamTurnoverPercentage: 'Turnover rate',
    offensiveReboundPercentage: 'Offensive rebound rate',
    opponentEffectiveFieldGoalPercentage: 'Opponent eFG%',
    opponentFreeThrowAttemptRate: 'Opponent FT rate',
    opponentTurnoverPercentage: 'Opponent turnover rate',
    opponentOffensiveReboundPercentage: 'Opponent offensive rebound rate',
    EFG_PCT: 'eFG%',
    FTA_RATE: 'FT rate',
    TM_TOV_PCT: 'Turnover rate',
    OREB_PCT: 'Offensive rebound rate',
    OPP_EFG_PCT: 'Opponent eFG%',
    OPP_FTA_RATE: 'Opponent FT rate',
    OPP_TOV_PCT: 'Opponent turnover rate',
    OPP_OREB_PCT: 'Opponent offensive rebound rate',
  };
  return Object.entries(labels)
    .map(([key, label]) => [label, stats[key]] as [string, unknown])
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number');
};

const factorComparisonEntries = (factors: Record<string, unknown> | null) => {
  const opponentFactors = factors?.opponent && typeof factors.opponent === 'object' ? factors.opponent as Record<string, unknown> : factors;
  const cavaliersFactors = factors?.cleveland && typeof factors.cleveland === 'object' ? factors.cleveland as Record<string, unknown> : factors;
  const opponentEntries = factorEntries(opponentFactors);
  const cavaliersEntries = factorEntries(cavaliersFactors);
  const labels = [...new Set([...cavaliersEntries, ...opponentEntries].map(([label]) => label))];
  return labels.map((label) => [label, cavaliersEntries.find(([entryLabel]) => entryLabel === label)?.[1] ?? '-', opponentEntries.find(([entryLabel]) => entryLabel === label)?.[1] ?? '-'] as [string, unknown, unknown]);
};

const factorValueClass = (value: unknown, otherValue: unknown) => {
  const numericValue = Number(value);
  const numericOtherValue = Number(otherValue);
  return Number.isFinite(numericValue) && Number.isFinite(numericOtherValue) && numericValue > numericOtherValue ? 'font-bold' : 'font-normal';
};

const clockSeconds = (value: string) => {
  const isoMatch = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (isoMatch) return Number(isoMatch[1] ?? 0) * 3600 + Number(isoMatch[2] ?? 0) * 60 + Number(isoMatch[3] ?? 0);
  const clockMatch = value.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  return clockMatch ? Number(clockMatch[1]) * 60 + Number(clockMatch[2]) : null;
};

type ClutchMoment = { text: string; reason: string; rank: number };

const rankedClutchMoments = (events: PlayByPlayEvent[]): ClutchMoment[] => {
  const candidates: ClutchMoment[] = [];
  const finalMadeScoringIndex = events.reduce((lastIndex, event, index) => {
    const homeScore = eventNumber(event, 'homeScore');
    const awayScore = eventNumber(event, 'awayScore');
    const madeShot = eventString(event, 'shotResult').toLowerCase() === 'made';
    return madeShot && homeScore !== null && awayScore !== null && index > 0 ? index : lastIndex;
  }, -1);
  let previousHomeScore: number | null = null;
  let previousAwayScore: number | null = null;

  for (const [eventIndex, event] of events.entries()) {
    const homeScore = eventNumber(event, 'homeScore');
    const awayScore = eventNumber(event, 'awayScore');
    const homeDelta = homeScore !== null && previousHomeScore !== null ? homeScore - previousHomeScore : 0;
    const awayDelta = awayScore !== null && previousAwayScore !== null ? awayScore - previousAwayScore : 0;
    const points = Math.max(homeDelta, awayDelta, 0);
    const period = eventNumber(event, 'period') ?? 0;
    const clock = eventString(event, 'clock') || eventString(event, 'gameClock');
    const clutch = period >= 4
      && (clockSeconds(clock) ?? Number.POSITIVE_INFINITY) <= 300
      && previousHomeScore !== null
      && previousAwayScore !== null
      && Math.abs(previousHomeScore - previousAwayScore) <= 5;
    const action = eventString(event, 'actionType').toLowerCase();
    const madeShot = eventString(event, 'shotResult').toLowerCase() === 'made';
    const gameWinner = madeShot
      && points > 0
      && eventIndex === finalMadeScoringIndex
      && homeScore !== null
      && awayScore !== null
      && ((homeDelta > 0 && homeScore > awayScore) || (awayDelta > 0 && awayScore > homeScore));

    const isScoringPlay = points > 0 || madeShot;
    const reason = gameWinner ? 'game winner'
      : action === 'turnover' ? 'clutch turnover'
      : action === 'steal' ? 'clutch steal'
        : action === 'block' ? 'clutch block'
          : isScoringPlay ? 'clutch scoring play'
            : '';
    if (clutch && reason) {
      const impact = (gameWinner ? 20 : 0) + (action === '3pt' && madeShot ? 7 : 0) + (action === 'steal' || action === 'block' ? 6 : 0) + (action === 'turnover' ? 4 : 0) + points * 2;
      candidates.push({ text: playByPlayText(event), reason, rank: impact });
    }
    previousHomeScore = homeScore ?? previousHomeScore;
    previousAwayScore = awayScore ?? previousAwayScore;
  }
  return candidates.sort((left, right) => right.rank - left.rank).filter((moment, index, all) => index === all.findIndex((candidate) => candidate.text === moment.text)).slice(0, 6);
};

const formatAttempts = (made: number, attempted: number) => `${made}/${attempted}`;

const teamLogoKey: Record<string, string> = {
  ATL: 'atl', BKN: 'bkn', BOS: 'bos', CHA: 'cha', CHI: 'chi', CLE: 'cle', DAL: 'dal', DEN: 'den', DET: 'det',
  GSW: 'gs', HOU: 'hou', IND: 'ind', LAC: 'lac', LAL: 'lal', MEM: 'mem', MIA: 'mia', MIL: 'mil', MIN: 'min',
  NOP: 'no', NYK: 'ny', OKC: 'okc', ORL: 'orl', PHI: 'phi', PHX: 'phx', POR: 'por', SAC: 'sac', SAS: 'sas',
  TOR: 'tor', UTA: 'utah', WAS: 'wsh', WSH: 'wsh',
};

const teamLogo = (abbreviation: string) => `/logos/${teamLogoKey[abbreviation.toUpperCase()] ?? abbreviation.toLowerCase()}.png`;
const teamSubreddit: Record<string, string> = {
  ATL: 'hawks', BOS: 'celtics', BKN: 'GoNets', CHA: 'CharlotteHornets', CHI: 'chicagobulls', CLE: 'clevelandcavs',
  DAL: 'Mavericks', DEN: 'denvernuggets', DET: 'DetroitPistons', GSW: 'warriors', HOU: 'rockets', IND: 'pacers',
  LAC: 'LAClippers', LAL: 'lakers', MEM: 'memphisgrizzlies', MIA: 'heat', MIL: 'nbaBucks', MIN: 'timberwolves',
  NOP: 'pelicans', NYK: 'nyknicks', OKC: 'Thunder', ORL: 'orlandomagic', PHI: 'sixers', PHX: 'suns', POR: 'ripcity',
  SAC: 'kings', SAS: 'NBASpurs', TOR: 'torontoraptors', UTA: 'jazz', WAS: 'washingtonwizards',
};

const teamSubredditUrl = (abbreviation: string) => {
  const subreddit = teamSubreddit[abbreviation.toUpperCase()];
  return subreddit ? `https://www.reddit.com/r/${subreddit}` : `https://www.reddit.com/r/nba/search/?q=${encodeURIComponent(abbreviation)}`;
};

const playerRow = (player: BoxScorePlayerResponse): string[] => {
  const stats = player.statistics;
  return [
    player.played ? (player.starter ? player.position ?? 'G' : 'B') : 'DNP',
    `${player.firstName.charAt(0)}. ${player.familyName}`,
    String(stats.points),
    String(stats.reboundsTotal),
    String(stats.assists),
    String(stats.plusMinusPoints),
    formatAttempts(stats.fieldGoalsMade, stats.fieldGoalsAttempted),
    formatPercentage(stats.fieldGoalsPercentage),
    formatAttempts(stats.twoPointersMade, stats.twoPointersAttempted),
    formatPercentage(stats.twoPointersPercentage),
    formatAttempts(stats.threePointersMade, stats.threePointersAttempted),
    formatPercentage(stats.threePointersPercentage),
    formatAttempts(stats.freeThrowsMade, stats.freeThrowsAttempted),
    formatPercentage(stats.freeThrowsPercentage),
    String(stats.reboundsDefensive),
    String(stats.reboundsOffensive),
    String(stats.steals),
    String(stats.blocks),
    String(stats.foulsPersonal),
    String(stats.turnovers),
    formatMinutes(stats.minutes),
  ];
};

const totalsRow = (players: BoxScorePlayerResponse[], score: number | null): string[] => {
  const totals = players.reduce<Partial<PlayerStatisticsResponse>>((result, player) => {
    const stats = player.statistics;
    for (const key of ['points', 'reboundsTotal', 'assists', 'fieldGoalsMade', 'fieldGoalsAttempted', 'twoPointersMade', 'twoPointersAttempted', 'threePointersMade', 'threePointersAttempted', 'freeThrowsMade', 'freeThrowsAttempted', 'reboundsDefensive', 'reboundsOffensive', 'steals', 'blocks', 'foulsPersonal', 'turnovers'] as const) {
      result[key] = (result[key] ?? 0) + stats[key];
    }
    return result;
  }, {});
  const percentage = (made: number, attempted: number) => attempted ? formatPercentage(made / attempted) : '';
  return [
    '-', 'Totals', String(score ?? totals.points ?? 0), String(totals.reboundsTotal ?? 0), String(totals.assists ?? 0), '-',
    formatAttempts(totals.fieldGoalsMade ?? 0, totals.fieldGoalsAttempted ?? 0), percentage(totals.fieldGoalsMade ?? 0, totals.fieldGoalsAttempted ?? 0),
    formatAttempts(totals.twoPointersMade ?? 0, totals.twoPointersAttempted ?? 0), percentage(totals.twoPointersMade ?? 0, totals.twoPointersAttempted ?? 0),
    formatAttempts(totals.threePointersMade ?? 0, totals.threePointersAttempted ?? 0), percentage(totals.threePointersMade ?? 0, totals.threePointersAttempted ?? 0),
    formatAttempts(totals.freeThrowsMade ?? 0, totals.freeThrowsAttempted ?? 0), percentage(totals.freeThrowsMade ?? 0, totals.freeThrowsAttempted ?? 0),
    String(totals.reboundsDefensive ?? 0), String(totals.reboundsOffensive ?? 0), String(totals.steals ?? 0), String(totals.blocks ?? 0), String(totals.foulsPersonal ?? 0), String(totals.turnovers ?? 0), '-',
  ];
};

const rowsFromTeam = (team: BoxScoreResponse['visitor']): string[][] => [
  ...(team.players ?? []).map(playerRow),
  totalsRow(team.players ?? [], team.score),
];

export const Splash = () => {
  const mainRef = useRef<HTMLElement>(null);
  const [liveThread, setLiveThread] = useState<ThreadResponse | null>(null);
  const [playByPlayScrollTop, setPlayByPlayScrollTop] = useState(0);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;

    const loadLiveThread = async () => {
      if (!active || document.hidden || requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await fetch('/api/thread/core', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as ThreadResponse;
        if (!active) return;
        setLiveThread(data);
        if (data.insightsReady) return;
        const clevelandTeamId = data.game.visitingTeam.abbreviation === 'CLE' ? data.game.visitingTeam.id : data.game.homeTeam.id;
        const query = `visitorTeamId=${data.game.visitingTeam.id}&homeTeamId=${data.game.homeTeam.id}&clevelandTeamId=${clevelandTeamId}&season=${encodeURIComponent(seasonFromStartTime(data.game.startTime))}`;
        const sections = ['records', 'standings', 'recent-form', 'past-matchups', 'four-factors'] as const;
        await Promise.all(sections.map(async (section) => {
          const response = await fetch(`/api/thread/insight?section=${section}&${query}`, { cache: 'no-store' });
          if (!response.ok || !active) return;
          const insight = await response.json() as Partial<ThreadResponse>;
          setLiveThread((current) => current ? { ...current, ...insight } : current);
        }));
      } finally {
        requestInFlight = false;
      }
    };

    const refreshOnVisibility = () => {
      if (!document.hidden) void loadLiveThread();
    };

    void loadLiveThread();
    const intervalId = window.setInterval(() => void loadLiveThread(), 60_000);
    document.addEventListener('visibilitychange', refreshOnVisibility);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, []);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    let lastTouchY = 0;
    let startTouchX = 0;
    let startTouchY = 0;
    let isVerticalGesture = false;
    let isTableGesture = false;
    let scrollElement: HTMLElement = main;
    let isHorizontalGesture = false;
    let velocity = 0;
    let scrollPosition = 0;
    let pendingDelta = 0;
    let frameId: number | null = null;
    let momentumId: number | null = null;

    const clampScroll = () => {
      const maxScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
      scrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));
      scrollElement.scrollTop = scrollPosition;
    };

    const applyScroll = () => {
      scrollPosition += pendingDelta;
      clampScroll();
      pendingDelta = 0;
      frameId = null;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (momentumId !== null) cancelAnimationFrame(momentumId);
      momentumId = null;
      velocity = 0;
      scrollPosition = main.scrollTop;
      startTouchX = event.touches[0]?.clientX ?? 0;
      startTouchY = event.touches[0]?.clientY ?? 0;
      isVerticalGesture = false;
      isTableGesture = event.target instanceof Element && event.target.closest('[data-horizontal-scroll]') !== null;
      const nestedScrollElement = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-play-by-play-scroll]') : null;
      scrollElement = nestedScrollElement ?? main;
      isHorizontalGesture = false;
      lastTouchY = startTouchY;
      scrollPosition = scrollElement.scrollTop;
      if (!isTableGesture) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      const currentTouchY = event.touches[0]?.clientY ?? lastTouchY;
      const currentTouchX = event.touches[0]?.clientX ?? startTouchX;
      if (isHorizontalGesture) return;
      if (!isVerticalGesture && !isTableGesture) {
        const horizontalDistance = Math.abs(currentTouchX - startTouchX);
        const verticalDistance = Math.abs(currentTouchY - startTouchY);
        if (horizontalDistance > verticalDistance && horizontalDistance > 6) return;
        if (verticalDistance > 6) isVerticalGesture = true;
      }
      if (isTableGesture && !isVerticalGesture) {
        const horizontalDistance = Math.abs(currentTouchX - startTouchX);
        const verticalDistance = Math.abs(currentTouchY - startTouchY);
        if (horizontalDistance > verticalDistance && horizontalDistance > 6) {
          isHorizontalGesture = true;
          return;
        }
        if (verticalDistance > 6) isVerticalGesture = true;
      }
      if (!isVerticalGesture) return;
      event.stopPropagation();
      const delta = lastTouchY - currentTouchY;
      lastTouchY = currentTouchY;
      velocity = velocity * 0.7 + delta * 0.3;
      pendingDelta += delta;
      if (frameId === null) frameId = requestAnimationFrame(applyScroll);
      event.preventDefault();
    };

    const handleTouchEnd = () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      applyScroll();
      const continueMomentum = () => {
        velocity *= 0.94;
        if (Math.abs(velocity) < 0.15) {
          momentumId = null;
          return;
        }
        scrollPosition += velocity;
        clampScroll();
        momentumId = requestAnimationFrame(continueMomentum);
      };
      momentumId = requestAnimationFrame(continueMomentum);
    };

    main.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
    main.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
    main.addEventListener('touchend', handleTouchEnd, { capture: true, passive: true });
    main.addEventListener('touchcancel', handleTouchEnd, { capture: true, passive: true });
    return () => {
      main.removeEventListener('touchstart', handleTouchStart, true);
      main.removeEventListener('touchmove', handleTouchMove, true);
      main.removeEventListener('touchend', handleTouchEnd, true);
      main.removeEventListener('touchcancel', handleTouchEnd, true);
      if (frameId !== null) cancelAnimationFrame(frameId);
      if (momentumId !== null) cancelAnimationFrame(momentumId);
    };
  }, []);

  const homeTeam = liveThread?.boxScore.home;
  const visitorTeam = liveThread?.boxScore.visitor;
  const homeTeamName = homeTeam?.team.fullName ?? homeTeam?.team.name ?? '';
  const visitorTeamName = visitorTeam?.team.fullName ?? visitorTeam?.team.name ?? '';
  const homeTeamAbbreviation = homeTeam?.team.abbreviation ?? '';
  const visitorTeamAbbreviation = visitorTeam?.team.abbreviation ?? '';
  const homeRows = homeTeam?.players?.length ? rowsFromTeam(homeTeam) : [];
  const visitorRows = visitorTeam?.players?.length ? rowsFromTeam(visitorTeam) : [];
  const periodCount = Math.max(4, ...(liveThread ? [liveThread.boxScore.visitor.periods?.length ?? 0, liveThread.boxScore.home.periods?.length ?? 0] : []));
  const periodLabels = Array.from({ length: periodCount }, (_, index) => index < 4 ? `${index + 1}Q` : `OT${index - 3}`);
  const periodScores = (team: BoxScoreTeam) => periodLabels.map((_, index) => team.periods?.[index]?.score ?? '-');
  const visitorPeriodScores = visitorTeam ? periodScores(visitorTeam) : periodLabels.map(() => '-');
  const homePeriodScores = homeTeam ? periodScores(homeTeam) : periodLabels.map(() => '-');
  const arena = liveThread?.boxScore.arena;
  const officials = liveThread?.boxScore.officials ?? [];
  const officialNames = officials.map((official) => {
    const name = typeof official.name === 'string' ? official.name : [official.firstName, official.familyName].filter((part): part is string => typeof part === 'string').join(' ');
    return name || null;
  }).filter((name): name is string => Boolean(name));

  const boxScore = (team: string, abbreviation: string, rows: string[][]) => (
    <section className="mt-6 overflow-hidden rounded-xl border border-[#354052] bg-[#111923]">
      <div className="flex items-center justify-between bg-[#1c2735] px-4 py-3">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-bold text-[#f5f1e8]">
          <img className="h-7 w-7 shrink-0 object-contain" src={teamLogo(abbreviation)} alt={`${team} logo`} />
          <span className="truncate">{team}</span>
        </h2>
       
      </div>
      <div data-horizontal-scroll className="overflow-x-auto [touch-action:pan-x]">
        <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-xs">
          <thead className="bg-[#202c3b] text-[0.68rem] uppercase tracking-[0.08em] text-[#c3ccd8]">
            <tr>
              <th className="w-10 px-1.5 py-2 font-semibold">Pos</th>
              <th className="min-w-[8.5rem] px-1.5 py-2 font-semibold">Name</th>
              {['PTS', 'REB', 'AST', '+/-', 'FGM/A', 'FG%', '2PM/A', '2P%', '3PM/A', '3P%', 'FTM/A', 'FT%', 'DREB', 'OREB', 'STL', 'BLK', 'PF', 'TOV', 'MIN'].map((header) => (
                <th className="whitespace-nowrap px-1.5 py-2 font-semibold" key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([position, name, ...stats]) => (
              <tr
                className={name === 'Totals' ? 'border-t-2 border-[#FDBB30] bg-[#000000] font-bold text-white' : 'border-t border-[#2b3542] text-[#e7e9ed]'}
                key={`${team}-${name}`}
              >
                <td className="px-1.5 py-2 text-[#aeb8c6]">{position}</td>
                <td className="px-1.5 py-2 font-semibold text-[#f5f1e8]">{name}</td>
                {stats.map((stat, index) => <td className="whitespace-nowrap px-1.5 py-2" key={`${team}-${name}-${index}`}>{stat}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const liveStatus = liveThread?.boxScore.gameStatusText ?? liveThread?.boxScore.gameState;
  const liveVisitorScore = liveThread?.boxScore.visitor.score;
  const liveHomeScore = liveThread?.boxScore.home.score;
  const liveState = `${liveThread?.boxScore.gameState ?? ''} ${liveStatus ?? ''}`.toLowerCase();
  const gameInProgress = /live|progress|halftime|quarter|overtime|q[1-4]/.test(liveState);
  const hasPlayerStats = Boolean(homeRows.length && visitorRows.length);
  const playByPlayEvents = liveThread?.playByPlay ?? [];
  const displayedPlayByPlay = [...playByPlayEvents].reverse();
  const playByPlayRowHeight = 68;
  const playByPlayOverscan = 6;
  const playByPlayStart = Math.max(0, Math.floor(playByPlayScrollTop / playByPlayRowHeight) - playByPlayOverscan);
  const playByPlayEnd = Math.min(displayedPlayByPlay.length, Math.ceil((playByPlayScrollTop + 224) / playByPlayRowHeight) + playByPlayOverscan);
  const visiblePlayByPlay = displayedPlayByPlay.slice(playByPlayStart, playByPlayEnd);
  const homeLeader = topPlayer(homeTeam ?? { team: { abbreviation: '', city: '', name: '', fullName: '' }, score: null }, 'points');
  const visitorLeader = topPlayer(visitorTeam ?? { team: { abbreviation: '', city: '', name: '', fullName: '' }, score: null }, 'points');
  const visitorShooting = teamShooting(visitorTeam);
  const homeShooting = teamShooting(homeTeam);
  const leaderStats = [
    { label: 'Points', visitor: visitorLeader?.statistics.points, home: homeLeader?.statistics.points, visitorPlayer: visitorLeader, homePlayer: homeLeader },
    { label: 'Rebounds', visitor: topPlayer(visitorTeam ?? { team: { abbreviation: '', city: '', name: '', fullName: '' }, score: null }, 'reboundsTotal')?.statistics.reboundsTotal, home: topPlayer(homeTeam ?? { team: { abbreviation: '', city: '', name: '', fullName: '' }, score: null }, 'reboundsTotal')?.statistics.reboundsTotal, visitorPlayer: topPlayer(visitorTeam ?? { team: { abbreviation: '', city: '', name: '', fullName: '' }, score: null }, 'reboundsTotal'), homePlayer: topPlayer(homeTeam ?? { team: { abbreviation: '', city: '', name: '', fullName: '' }, score: null }, 'reboundsTotal') },
    { label: 'Assists', visitor: topPlayer(visitorTeam ?? { team: { abbreviation: '', city: '', name: '', fullName: '' }, score: null }, 'assists')?.statistics.assists, home: topPlayer(homeTeam ?? { team: { abbreviation: '', city: '', name: '', fullName: '' }, score: null }, 'assists')?.statistics.assists, visitorPlayer: topPlayer(visitorTeam ?? { team: { abbreviation: '', city: '', name: '', fullName: '' }, score: null }, 'assists'), homePlayer: topPlayer(homeTeam ?? { team: { abbreviation: '', city: '', name: '', fullName: '' }, score: null }, 'assists') },
  ];
  const scoreMargins = playByPlayEvents.map((event) => {
    const homeScore = eventNumber(event, 'homeScore');
    const awayScore = eventNumber(event, 'awayScore');
    return homeScore !== null && awayScore !== null ? homeScore - awayScore : null;
  }).filter((margin): margin is number => margin !== null);
  const largestLead = scoreMargins.reduce((largest, margin) => Math.max(largest, Math.abs(margin)), 0);
  const leadChanges = scoreMargins.slice(1).reduce((count, margin, index) => {
    const previous = scoreMargins[index] ?? 0;
    return previous !== 0 && margin !== 0 && Math.sign(previous) !== Math.sign(margin) ? count + 1 : count;
  }, 0);
  const clutchMoments = rankedClutchMoments(playByPlayEvents);
  const matchupGames = liveThread?.matchups ?? [];
  const cavsHomeMatchups = matchupGames.filter((game) => game.homeTeam.abbreviation === 'CLE').length;
  const cavsRoadMatchups = matchupGames.length - cavsHomeMatchups;
  const completedMatchups = matchupGames.filter((game) => game.isFinal && matchupWinner(game));
  const cavsMatchupWins = completedMatchups.filter((game) => matchupWinner(game) === 'CLE').length;
  const cavsMatchupLosses = completedMatchups.length - cavsMatchupWins;
  const mostRecentMatchup = [...matchupGames].sort((left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime())[0];
  const isGameDayThread = liveThread?.threadType === 'game-day';
  const isPregameThread = isGameDayThread || (liveThread?.threadType === 'game' && !gameInProgress && !liveStatus?.toLowerCase().includes('final'));
  const boxScoreContent = !liveThread ? (
    <div className="mt-6 space-y-4" aria-label="Loading box score">
      {[0, 1].map((team) => <div className="overflow-hidden rounded-xl border border-[#354052] bg-[#111923]" key={`box-score-skeleton-${team}`}>
        <div className="flex items-center justify-between bg-[#1c2735] px-4 py-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-24" /></div>
        <div className="space-y-3 p-4">{[0, 1, 2, 3, 4].map((row) => <div className="flex gap-3" key={`box-score-skeleton-${team}-${row}`}><Skeleton className="h-4 w-10" /><Skeleton className="h-4 w-36" /><Skeleton className="h-4 flex-1" /></div>)}</div>
      </div>)}
    </div>
  ) : !hasPlayerStats && !gameInProgress ? (
    <div className="mt-6 rounded-xl border border-[#FDBB30] bg-[#111923] px-5 py-8 text-center">
      <h3 className="text-lg font-bold text-[#f5f1e8]">Lineups coming soon</h3>
      <p className="mt-2 text-sm text-[#aeb8c6]">Player lineups and box score totals will appear here when they are available.</p>
    </div>
  ) : !hasPlayerStats ? (
    <div className="mt-6 rounded-xl border border-[#354052] bg-[#111923] px-5 py-8 text-center text-[#aeb8c6]">
      Loading player box score data...
    </div>
  ) : (
    <>
      {boxScore(homeTeamName, homeTeamAbbreviation, homeRows)}
      {boxScore(visitorTeamName, visitorTeamAbbreviation, visitorRows)}
    </>
  );

  return (
    <main ref={mainRef} className="h-full overflow-y-auto overscroll-contain bg-[#080d14] px-3 py-5 text-[#f5f1e8] [touch-action:none] sm:px-8 sm:py-8">
      <article className="mx-auto max-w-4xl overflow-visible rounded-2xl border border-[#354052] bg-[#111923] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <header className="rounded-t-2xl border-b-4 border-[#FDBB30] bg-[#860038] px-5 py-6 text-white sm:px-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#FDBB30]">
            <span>r/clevelandcavs game thread</span>
            <div className="flex items-center gap-3">
              {liveThread?.threadType === 'game' && gameInProgress && <span className="flex items-center gap-1.5 text-[#ffb4a8]" title="Live thread refreshes automatically every minute"><span className="h-2 w-2 animate-pulse rounded-full bg-[#ff5a52]" aria-hidden="true" />Live · Refreshes every minute</span>}
              {liveThread ? <span>{liveStatus ?? (liveThread.threadType === 'game' ? 'Scheduled' : 'Final')}</span> : <Skeleton className="h-3 w-16 bg-[#FDBB30]/40" />}
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 sm:gap-6">
            <div className="flex min-w-0 flex-col items-center text-center">
              <div className="flex h-14 items-center sm:h-20">{visitorTeamAbbreviation ? <a className="transition-opacity hover:opacity-80" href={teamSubredditUrl(visitorTeamAbbreviation)} target="_blank" rel="noreferrer" title={`Visit ${visitorTeamName} subreddit`} aria-label={`Visit ${visitorTeamName} subreddit`}><img className="h-14 w-14 object-contain sm:h-20 sm:w-20" src={teamLogo(visitorTeamAbbreviation)} alt={`${visitorTeamName} logo`} /></a> : <Skeleton className="h-14 w-14 rounded-full sm:h-20 sm:w-20" />}</div>
              <h1 className="flex h-[3.5rem] items-center justify-center pt-2 text-lg font-bold leading-tight sm:h-[4.5rem] sm:pt-3 sm:text-3xl">{visitorTeamName || <Skeleton className="mx-auto h-6 w-32 sm:h-8 sm:w-44" />}</h1>
              <div className="mt-2 flex min-h-[2.25rem] flex-col items-center justify-start gap-1"><span className="text-xs text-white/80">{liveThread?.records?.visitor ? formatRecord(liveThread.records.visitor) : <Skeleton className="h-3 w-16 bg-white/30" />}</span><span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FDBB30]">Away</span></div>
            </div>
            {liveThread ? <span className="flex h-14 items-center text-sm font-semibold uppercase tracking-[0.16em] text-[#f5f1e8] sm:h-20 sm:text-base">at</span> : <Skeleton className="mx-auto h-4 w-5 bg-white/30" />}
            <div className="flex min-w-0 flex-col items-center text-center">
              <div className="flex h-14 items-center sm:h-20">{homeTeamAbbreviation ? <a className="transition-opacity hover:opacity-80" href={teamSubredditUrl(homeTeamAbbreviation)} target="_blank" rel="noreferrer" title={`Visit ${homeTeamName} subreddit`} aria-label={`Visit ${homeTeamName} subreddit`}><img className="h-14 w-14 object-contain sm:h-20 sm:w-20" src={teamLogo(homeTeamAbbreviation)} alt={`${homeTeamName} logo`} /></a> : <Skeleton className="h-14 w-14 rounded-full sm:h-20 sm:w-20" />}</div>
              <h2 className="flex h-[3.5rem] items-center justify-center pt-2 text-lg font-bold leading-tight sm:h-[4.5rem] sm:pt-3 sm:text-3xl">{homeTeamName || <Skeleton className="mx-auto h-6 w-32 sm:h-8 sm:w-44" />}</h2>
              <div className="mt-2 flex min-h-[2.25rem] flex-col items-center justify-start gap-1"><span className="text-xs text-white/80">{liveThread?.records?.home ? formatRecord(liveThread.records.home) : <Skeleton className="h-3 w-16 bg-white/30" />}</span><span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FDBB30]">Home</span></div>
            </div>
          </div>
          {/* {liveThread ? <p className="mt-5 text-sm text-white sm:text-base">{gameInProgress ? 'Live game thread and box score' : liveThread.threadType === 'game' ? 'Game thread and box score' : 'Post-game discussion and box score'}</p> : <Skeleton className="mt-5 h-4 w-56 bg-white/30" />} */}
        </header>

        <section className="px-5 py-6 sm:px-8" aria-label="Game summary">
          {liveThread && !isGameDayThread ? <>
            <div className="overflow-x-auto rounded-xl border border-[#354052] bg-[#1a2431] p-4 text-sm">
              <table className="w-full min-w-max text-[#f5f1e8]"><thead><tr className="text-left"><th className="whitespace-nowrap pr-5 font-bold text-[#f5f1e8]">Team</th>{periodLabels.map((label) => <th className="whitespace-nowrap px-2 text-right font-bold text-[#f5f1e8]" key={label}>{label}</th>)}<th className="whitespace-nowrap pl-2 text-right font-bold text-[#f5f1e8]">Total</th></tr></thead><tbody><tr><th className="whitespace-nowrap pr-5 pt-2 text-left font-semibold text-[#f5f1e8]">{visitorTeamAbbreviation}</th>{visitorPeriodScores.map((score, index) => <td className="px-2 pt-2 text-right" key={`visitor-period-${index}`}>{score}</td>)}<td className="pl-2 pt-2 text-right text-lg font-bold text-[#FDBB30]">{liveVisitorScore ?? '-'}</td></tr><tr><th className="whitespace-nowrap pr-5 pt-2 text-left font-semibold text-[#f5f1e8]">{homeTeamAbbreviation}</th>{homePeriodScores.map((score, index) => <td className="px-2 pt-2 text-right" key={`home-period-${index}`}>{score}</td>)}<td className="pl-2 pt-2 text-right text-lg font-bold text-[#d5deea]">{liveHomeScore ?? '-'}</td></tr></tbody></table>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#aeb8c6]">
              <span><strong className="text-[#f5f1e8]">Status:</strong> {liveStatus ?? 'Final'}</span>
              <span><strong className="text-[#f5f1e8]">Game clock:</strong> {formatGameClock(liveThread.boxScore.gameClock)}</span>
            </div>
          </> : liveThread && isGameDayThread ? <div className="rounded-xl border border-[#354052] bg-[#1a2431] p-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[#aeb8c6]">Pregame matchup</h2>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#c3ccd8]">
              <span><strong className="text-[#f5f1e8]">Tip-off:</strong> {new Date(liveThread.game.startTime).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              <span><strong className="text-[#f5f1e8]">Venue:</strong> {arena ? [arena.name, arena.city, arena.state].filter(Boolean).join(', ') || 'Not available' : 'Not available'}</span>
            </div>
          </div> : <>
            <div className="grid items-center gap-4 rounded-xl border border-[#354052] bg-[#1a2431] p-4" style={{ gridTemplateColumns: 'minmax(4rem, 1fr) repeat(5, minmax(2.5rem, auto))' }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((item) => <Skeleton className={item % 6 === 0 ? 'h-4 w-12' : 'mx-auto h-4 w-6'} key={`summary-skeleton-${item}`} />)}
            </div>
            <div className="mt-4 flex gap-6"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-28" /></div>
          </>}

          {liveThread && <section className="mt-6 rounded-xl border border-[#354052] bg-[#111923] p-4" aria-label="Game insights">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-bold">{isPregameThread ? 'Game preview' : liveThread.threadType === 'post-game' || liveThread.threadType === 'next-day' ? 'Game recap' : 'Live insights'}</h2>
              <span className="text-xs text-[#7f8b9a]">Updated {new Date(liveThread.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
            {liveThread.recentForm.length > 0 && <div className="mt-3 rounded-lg border border-[#2b3542] bg-[#1a2431] p-3"><h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#aeb8c6]">Recent Cavs schedule</h3><ul className="mt-2 space-y-1 text-xs">{liveThread.recentForm.slice(0, 5).map((game) => <li className="flex justify-between gap-2"><span>{new Date(game.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span><span className="truncate text-[#aeb8c6]">{scheduledOpponent(game, 'CLE')}</span></li>)}</ul></div>}
            {(liveThread.matchups.length > 0 || factorComparisonEntries(liveThread.fourFactors).length > 0) && <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#2b3542] bg-[#1a2431] p-3"><h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#aeb8c6]">Last 10 head-to-head</h3><div className="mt-3 grid grid-cols-2 gap-2 text-xs xl:grid-cols-4">{completedMatchups.length ? <div className="rounded-md bg-[#202d3d] px-3 py-2"><span className="block text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-[#7f8b9a]">Cavaliers record</span><strong className="mt-1 block text-sm text-[#f5f1e8]">{cavsMatchupWins}-{cavsMatchupLosses}</strong></div> : <div className="rounded-md bg-[#202d3d] px-3 py-2"><span className="block text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-[#7f8b9a]">Record</span><strong className="mt-1 block text-sm text-[#f5f1e8]">Unavailable</strong></div>}<div className="rounded-md bg-[#202d3d] px-3 py-2"><span className="block text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-[#7f8b9a]">Meetings</span><strong className="mt-1 block text-sm text-[#f5f1e8]">{matchupGames.length}</strong></div><div className="rounded-md bg-[#202d3d] px-3 py-2"><span className="block text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-[#7f8b9a]">Home / road</span><strong className="mt-1 block text-sm text-[#f5f1e8]">{cavsHomeMatchups} / {cavsRoadMatchups}</strong></div><div className="rounded-md bg-[#202d3d] px-3 py-2"><span className="block text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-[#7f8b9a]">Most recent</span><strong className="mt-1 block text-sm text-[#f5f1e8]">{mostRecentMatchup ? new Date(mostRecentMatchup.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unavailable'}</strong></div></div>{matchupGames.length > 0 ? <ul className="mt-3 space-y-1 text-xs">{matchupGames.slice(0, 10).map((game) => { const winner = matchupWinner(game); const visitorWon = winner === game.visitingTeam.abbreviation; const homeWon = winner === game.homeTeam.abbreviation; return <li className="flex justify-between gap-2" key={game.gameId}><span>{new Date(game.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span><span className="truncate text-[#aeb8c6]"><strong className={visitorWon ? 'font-bold text-[#f5f1e8]' : 'font-normal'}>{game.visitingTeam.abbreviation} {game.visitingScore ?? '-'}</strong> - <strong className={homeWon ? 'font-bold text-[#f5f1e8]' : 'font-normal'}>{game.homeScore ?? '-'} {game.homeTeam.abbreviation}</strong>{game.gameLabel ? ` · ${game.gameLabel}` : ''}</span></li>; })}</ul> : <p className="mt-2 text-xs text-[#7f8b9a]">No matchup history available.</p>}</div>
              {factorComparisonEntries(liveThread.fourFactors).length > 0 && <div className="rounded-lg border border-[#2b3542] bg-[#1a2431] p-3"><h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#aeb8c6]">Four factors</h3><div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 text-xs"><span className="border-b border-[#354052] pb-1 font-semibold text-[#aeb8c6]">Stat</span><span className="border-b border-[#354052] pb-1 text-right font-semibold text-[#c3ccd8]">CLE</span><span className="border-b border-[#354052] pb-1 text-right font-semibold text-[#c3ccd8]">OPP</span>{factorComparisonEntries(liveThread.fourFactors).slice(0, 8).map(([label, cavaliersValue, opponentValue]) => <Fragment key={label}><span className="border-b border-[#2b3542] py-1">{label}</span><strong className={`border-b border-[#2b3542] py-1 text-right ${factorValueClass(cavaliersValue, opponentValue)}`}>{String(cavaliersValue)}</strong><strong className={`border-b border-[#2b3542] py-1 text-right ${factorValueClass(opponentValue, cavaliersValue)}`}>{String(opponentValue)}</strong></Fragment>)}</div></div>}
            </div>}
            {!isPregameThread && <>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="rounded-lg bg-[#1a2431] p-2"><strong className="block text-lg text-[#FDBB30]">{largestLead}</strong><span className="text-[11px] uppercase text-[#aeb8c6]">Largest lead</span></div>
                <div className="rounded-lg bg-[#1a2431] p-2"><strong className="block text-lg text-[#f5f1e8]">{leadChanges}</strong><span className="text-[11px] uppercase text-[#aeb8c6]">Lead changes</span></div>
                <div className="rounded-lg bg-[#1a2431] p-2"><strong className="block text-lg text-[#f5f1e8]">{visitorPeriodScores.filter((score) => score !== '-').length}</strong><span className="text-[11px] uppercase text-[#aeb8c6]">Periods played</span></div>
                <div className="rounded-lg bg-[#1a2431] p-2"><strong className="block text-lg text-[#f5f1e8]">{clutchMoments.length}</strong><span className="text-[11px] uppercase text-[#aeb8c6]">Clutch moments</span></div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {leaderStats.map((leader) => <div key={leader.label}><h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#aeb8c6]">{leader.label} leaders</h3><div className="mt-2 space-y-1 text-sm"><div className="flex justify-between gap-2"><span className="truncate">{leader.visitorPlayer ? `${visitorTeamAbbreviation} ${playerDisplayName(leader.visitorPlayer)}` : `${visitorTeamAbbreviation} -`}</span><strong>{leader.visitor ?? '-'}</strong></div><div className="flex justify-between gap-2"><span className="truncate">{leader.homePlayer ? `${homeTeamAbbreviation} ${playerDisplayName(leader.homePlayer)}` : `${homeTeamAbbreviation} -`}</span><strong>{leader.home ?? '-'}</strong></div></div></div>)}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div><h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#aeb8c6]">Shooting comparison</h3><table className="mt-2 w-full text-xs"><thead><tr className="text-left text-[#7f8b9a]"><th className="py-1 font-normal">Split</th><th className="px-2 py-1 text-right font-normal">{visitorTeamAbbreviation}</th><th className="py-1 text-right font-normal">{homeTeamAbbreviation}</th></tr></thead><tbody>{[['FG%', visitorShooting.field], ['3P%', visitorShooting.three], ['FT%', visitorShooting.free]].map(([label, values]) => { const split = values as typeof visitorShooting.field; const homeSplit = homeShooting[label === 'FG%' ? 'field' : label === '3P%' ? 'three' : 'free']; const visitorWins = split.value !== null && homeSplit.value !== null && split.value > homeSplit.value; const homeWins = split.value !== null && homeSplit.value !== null && homeSplit.value > split.value; return <tr className="border-t border-[#2b3542]" key={label as string}><th className="py-1 text-left font-normal text-[#c3ccd8]">{label as string}</th><td className={`px-2 py-1 text-right ${visitorWins ? 'font-bold text-[#FDBB30]' : 'text-white'}`}>{split.display}</td><td className={`py-1 text-right ${homeWins ? 'font-bold text-[#FDBB30]' : 'text-white'}`}>{homeSplit.display}</td></tr>; })}</tbody></table></div>
                <div><h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#aeb8c6]">Quarter story</h3><div className="mt-2 grid grid-cols-2 gap-1 text-xs">{periodLabels.map((label, index) => { const visitorScore = Number(visitorPeriodScores[index]); const homeScore = Number(homePeriodScores[index]); const visitorWins = Number.isFinite(visitorScore) && visitorScore > homeScore; const homeWins = Number.isFinite(homeScore) && homeScore > visitorScore; return <div className="flex justify-between rounded bg-[#1a2431] px-2 py-1" key={label}><span>{label}</span><span><strong className={visitorWins ? 'font-bold text-[#FDBB30]' : 'font-normal text-white'}>{visitorPeriodScores[index]}</strong><span className="text-white"> - </span><strong className={homeWins ? 'font-bold text-[#FDBB30]' : 'font-normal text-white'}>{homePeriodScores[index]}</strong></span></div>; })}</div></div>
                <div className="sm:col-span-2"><h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#aeb8c6]">Clutch moments</h3><ul className="mt-2 space-y-1 text-xs text-[#c3ccd8]">{clutchMoments.length ? clutchMoments.map((moment, index) => <li className="truncate" key={`clutch-${index}`} title={`${moment.text} · ${moment.reason}`}>{moment.text} <span className="text-[#FDBB30]">· {moment.reason}</span></li>) : <li className="text-[#7f8b9a]">No clutch moments available.</li>}</ul></div>
              </div>
            </>}
          </section>}

          {!isGameDayThread && <>
            <h2 className="mt-8 text-xl font-bold">Box score</h2>
            {boxScoreContent}
          </>}

          {!isGameDayThread && <section className="mt-6 rounded-xl border border-[#354052] bg-[#111923] p-4" aria-label="Play-by-play">
            <h2 className="text-base font-bold">Play-by-play</h2>
            <div className="mt-3 max-h-56 overflow-x-hidden overflow-y-auto rounded-lg border border-[#2b3542] bg-[#0b121b]" data-horizontal-scroll data-play-by-play-scroll onScroll={(event) => setPlayByPlayScrollTop(event.currentTarget.scrollTop)}>
              {!liveThread ? <div className="space-y-4 p-4">{[0, 1, 2, 3].map((row) => <div className="flex gap-3" key={`play-skeleton-${row}`}><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-4 w-16" /><Skeleton className="h-4 flex-1" /></div>)}</div> : playByPlayEvents.length ? <table className="w-full table-fixed border-collapse text-left text-xs text-[#c3ccd8]">
                <colgroup><col className="w-10" /><col className="w-[4.25rem]" /><col className="w-10" /><col className="w-10" /><col /></colgroup>
                <thead className="sticky top-0 z-10 bg-[#151f2b] text-[10px] font-bold uppercase tracking-[0.08em] text-[#aeb8c6]">
                  <tr><th className="px-2 py-2">Team</th><th className="px-2 py-2">Period</th><th className="px-1 py-2 text-center">Home</th><th className="px-1 py-2 text-center">Away</th><th className="px-2 py-2">Description</th></tr>
                </thead>
                <tbody>
                  {playByPlayStart > 0 && <tr aria-hidden="true"><td colSpan={5} style={{ height: playByPlayStart * playByPlayRowHeight }} /></tr>}
                  {visiblePlayByPlay.map((event, index) => (
                    <tr className="border-t border-[#2b3542]" key={`play-${playByPlayStart + index}`} style={{ height: playByPlayRowHeight }}>
                      <td className="px-2 py-1.5">
                        <div className="flex justify-center">
                          {eventString(event, 'teamAbbreviation') ? <img className="h-5 w-5 object-contain" src={teamLogo(eventString(event, 'teamAbbreviation'))} alt={`${eventString(event, 'teamAbbreviation')} logo`} /> : <span className="text-[#6f7c8d]">-</span>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-[#f5f1e8]">{event.period ? `Q${event.period}` : '-'} {formatGameClock(eventString(event, 'clock') || eventString(event, 'gameClock'))}</td>
                      <td className="px-1 py-1.5 text-center">{eventString(event, 'homeScore') || '-'}</td>
                      <td className="px-1 py-1.5 text-center">{eventString(event, 'awayScore') || '-'}</td>
                      <td className="px-2 py-1.5" title={playByPlayText(event)}><div className="line-clamp-3 whitespace-normal break-words leading-4">{playByPlayText(event)}</div></td>
                    </tr>
                  ))}
                  {playByPlayEnd < playByPlayEvents.length && <tr aria-hidden="true"><td colSpan={5} style={{ height: (playByPlayEvents.length - playByPlayEnd) * playByPlayRowHeight }} /></tr>}
                </tbody>
              </table> : <p className="px-3 py-4 text-sm text-[#aeb8c6]">Play-by-play is not available yet.</p>}
            </div>
          </section>}

          <div className="mt-6 grid gap-4 border-t border-[#354052] pt-6 text-sm sm:grid-cols-2">
            <div><h2 className="font-bold">Officials</h2>{liveThread ? <p className="mt-2 leading-6 text-[#aeb8c6]">{officialNames.length ? officialNames.join(' · ') : 'Not available'}</p> : <Skeleton className="mt-3 h-5 w-56" />}</div>
            <div><h2 className="font-bold">Location</h2>{liveThread ? <p className="mt-2 leading-6 text-[#aeb8c6]">{arena ? [arena.name, arena.city, arena.state].filter(Boolean).join(', ') || 'Not available' : 'Not available'}{arena?.attendance ? ` · Attendance: ${arena.attendance.toLocaleString()}` : ''}</p> : <Skeleton className="mt-3 h-5 w-48" />}</div>
          </div>

        </section>
      </article>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
