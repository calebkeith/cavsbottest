import './index.css';

import { StrictMode, useEffect, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';

const inlineStartedAt = performance.now();

type Team = {
  abbreviation: string | null;
  fullName: string | null;
  name: string | null;
  id?: number;
};

type PeriodScore = {
  period: number;
  score: number;
};

type PlayerStatistics = {
  points: number;
  assists: number;
  reboundsTotal: number;
};

type BoxScorePlayer = {
  firstName: string;
  familyName: string;
  played: boolean;
  statistics: PlayerStatistics;
};

type BoxScoreTeam = {
  team: Team;
  score: number | null;
  periods?: PeriodScore[] | null;
  players?: BoxScorePlayer[];
};

type RecordResponse = {
  record: string | null;
  wins: string | null;
  losses: string | null;
};

type ScheduleGame = {
  gameId: string | null;
  startTime: string;
  isFinal: boolean;
  visitingScore: number | null;
  homeScore: number | null;
  visitingTeam: Team;
  homeTeam: Team;
  winner: Team | null;
};

type InsightsResponse = {
  records: { visitor: RecordResponse | null; home: RecordResponse | null };
  recentForm: ScheduleGame[];
  matchups: ScheduleGame[];
  fourFactors: FourFactors;
};

type FourFactors = {
  cleveland: Record<string, unknown> | null;
  opponent: Record<string, unknown> | null;
} | null;

type InsightState = Partial<InsightsResponse>;
type InsightSection = 'records' | 'recentForm' | 'matchups' | 'fourFactors';
type InsightSectionStatus = 'idle' | 'loading' | 'loaded' | 'error';
type InsightStatus = Record<InsightSection, InsightSectionStatus>;

type ThreadResponse = {
  threadType: string;
  boxScore: {
    gameState: string | null;
    gameStatusText: string | null;
    visitor: BoxScoreTeam;
    home: BoxScoreTeam;
  };
  game: {
    startTime: string;
    gameStatusText: string | null;
    isFinal: boolean;
    visitingScore: number | null;
    homeScore: number | null;
    visitingTeam: Team;
    homeTeam: Team;
    arena: { name: string | null; city: string | null; state: string | null };
  };
};

const teamLogoKey: Record<string, string> = {
  ATL: 'atl', BKN: 'bkn', BOS: 'bos', CHA: 'cha', CHI: 'chi', CLE: 'cle', DAL: 'dal', DEN: 'den', DET: 'det',
  GSW: 'gs', HOU: 'hou', IND: 'ind', LAC: 'lac', LAL: 'lal', MEM: 'mem', MIA: 'mia', MIL: 'mil', MIN: 'min',
  NOP: 'no', OKC: 'okc', ORL: 'orl', PHI: 'phi', PHX: 'phx', POR: 'por', SAC: 'sac', SAS: 'sas',
  TOR: 'tor', WAS: 'wsh', WSH: 'wsh',
};

const teamLogoPath = (abbreviation: string | null) => {
  const key = abbreviation?.toUpperCase() ?? '';
  const file = teamLogoKey[key];
  return file ? `/logos/${file}.png` : null;
};

const teamName = (team: Team) => team.fullName ?? team.name ?? team.abbreviation ?? 'Team';
const teamAbbreviation = (team: Team) => team.abbreviation ?? team.name?.slice(0, 3).toUpperCase() ?? '---';

const seasonFromStartTime = (startTime: string) => {
  const date = new Date(startTime);
  const startYear = date.getUTCMonth() >= 9 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const formatRecord = (record: RecordResponse | null | undefined) => record?.record
  ?? (record?.wins !== null && record?.wins !== undefined && record?.losses !== null && record?.losses !== undefined ? `${record.wins}-${record.losses}` : 'Unavailable');

const topPlayer = (team: BoxScoreTeam, stat: keyof PlayerStatistics) => [...(team.players ?? [])]
  .filter((player) => player.played)
  .sort((left, right) => right.statistics[stat] - left.statistics[stat])[0];

const playerLabel = (team: BoxScoreTeam, stat: keyof PlayerStatistics) => {
  const player = topPlayer(team, stat);
  return player ? `${player.firstName.charAt(0)}. ${player.familyName} ${player.statistics[stat]}` : 'Unavailable';
};

const matchupWinner = (game: ScheduleGame) => game.winner?.abbreviation
  ?? (game.visitingScore !== null && game.homeScore !== null && game.visitingScore !== game.homeScore
    ? game.visitingScore > game.homeScore ? game.visitingTeam.abbreviation : game.homeTeam.abbreviation
    : null);

const matchupSummary = (matchups: ScheduleGame[]) => {
  const completed = matchups.filter((game) => game.isFinal && matchupWinner(game));
  const cavaliersWins = completed.filter((game) => matchupWinner(game) === 'CLE').length;
  return {
    record: completed.length ? `${cavaliersWins}-${completed.length - cavaliersWins}` : 'Unavailable',
    meetings: matchups.length,
    home: matchups.filter((game) => game.homeTeam.abbreviation === 'CLE').length,
    road: matchups.filter((game) => game.visitingTeam.abbreviation === 'CLE').length,
  };
};

const shortDate = (startTime: string) => new Date(startTime).toLocaleDateString([], { month: 'short', day: 'numeric' });

const matchupLabel = (game: ScheduleGame) => {
  const opponent = game.homeTeam.abbreviation === 'CLE' ? game.visitingTeam : game.homeTeam;
  const result = matchupWinner(game) === 'CLE' ? 'W' : matchupWinner(game) ? 'L' : '-';
  return `${result} vs ${teamAbbreviation(opponent)} · ${shortDate(game.startTime)}`;
};

const recentFormLabel = (game: ScheduleGame) => {
  const opponent = game.homeTeam.abbreviation === 'CLE' ? game.visitingTeam : game.homeTeam;
  const result = matchupWinner(game) === 'CLE' ? 'W' : matchupWinner(game) ? 'L' : '-';
  return { result, opponent: teamAbbreviation(opponent), date: shortDate(game.startTime) };
};

const factorDefinitions: Array<[string, string[]]> = [
  ['eFG%', ['effectiveFieldGoalPercentage', 'EFG_PCT']],
  ['FT rate', ['freeThrowAttemptRate', 'FTA_RATE']],
  ['TOV rate', ['teamTurnoverPercentage', 'TM_TOV_PCT']],
  ['OREB%', ['offensiveReboundPercentage', 'OREB_PCT']],
];

const factorStats = (factors: Record<string, unknown> | null | undefined) => {
  const resultSets = factors?.resultSets;
  const overallResultSet = Array.isArray(resultSets)
    ? resultSets.find((resultSet) => typeof resultSet === 'object' && resultSet !== null && (resultSet as Record<string, unknown>).name === 'OverallTeamDashboard')
    : undefined;
  const resultSetRecord = typeof overallResultSet === 'object' && overallResultSet !== null ? overallResultSet as Record<string, unknown> : undefined;
  const rows = resultSetRecord?.rows;
  const row = Array.isArray(rows) && rows[0] && typeof rows[0] === 'object' ? rows[0] as Record<string, unknown> : undefined;
  const overall = factors?.overall;
  const overallRow = Array.isArray(overall) && overall[0] && typeof overall[0] === 'object' ? overall[0] as Record<string, unknown> : undefined;
  return row ?? overallRow ?? factors ?? {};
};

const factorValue = (stats: Record<string, unknown>, keys: string[]) => {
  const value = keys.map((key) => stats[key]).find((candidate) => typeof candidate === 'string' || typeof candidate === 'number');
  return value === undefined ? '-' : String(value);
};

const factorComparisonEntries = (factors: FourFactors | null | undefined) => {
  const cleveland = factorStats(factors?.cleveland);
  const opponent = factorStats(factors?.opponent);
  return factorDefinitions.map(([label, keys]) => [label, factorValue(cleveland, keys), factorValue(opponent, keys)] as [string, string, string]);
};

const formatTipOff = (startTime: string) => {
  const date = new Date(startTime);
  return Number.isNaN(date.getTime())
    ? 'Tip-off time unavailable'
    : date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const periodLabel = (period: number) => period <= 4 ? `${period}Q` : `OT${period - 4}`;

const periodScores = (team: BoxScoreTeam, periodCount: number) => Array.from({ length: periodCount }, (_, index) => {
  const period = index + 1;
  return team.periods?.find((entry) => entry.period === period)?.score ?? null;
});

const getScore = (boxScoreTeam: BoxScoreTeam, gameScore: number | null) => boxScoreTeam.score ?? gameScore;

const quarterAnalysis = (
  visitor: BoxScoreTeam,
  home: BoxScoreTeam,
  visitorScores: (number | null)[],
  homeScores: (number | null)[],
  visitorTotal: number | null,
  homeTotal: number | null,
  isFinal: boolean,
) => {
  const completedQuarters = visitorScores
    .map((score, index) => ({ visitor: score, home: homeScores[index], period: index + 1 }))
    .filter((quarter): quarter is { visitor: number; home: number; period: number } => quarter.visitor !== null && quarter.home !== null);
  if (!completedQuarters.length) return 'Quarter breakdown will appear once the game begins.';

  const visitorWins = completedQuarters.filter((quarter) => quarter.visitor > quarter.home).length;
  const homeWins = completedQuarters.filter((quarter) => quarter.home > quarter.visitor).length;
  const largestMargin = completedQuarters.reduce((largest, quarter) => {
    const margin = Math.abs(quarter.visitor - quarter.home);
    return margin > largest.margin ? { margin, period: quarter.period, leader: quarter.visitor > quarter.home ? visitor : home } : largest;
  }, { margin: -1, period: 1, leader: visitor });
  const largestLabel = `${teamAbbreviation(largestMargin.leader.team)} +${largestMargin.margin} in ${periodLabel(largestMargin.period)}`;

  if (isFinal && visitorTotal !== null && homeTotal !== null) {
    const gameLeader = visitorTotal > homeTotal ? visitor : home;
    const quarterLeaderCount = Math.max(visitorWins, homeWins);
    return `${teamAbbreviation(gameLeader.team)} finished ahead and won ${quarterLeaderCount} of ${completedQuarters.length} quarters. Biggest swing: ${largestLabel}.`;
  }

  const currentLeader = visitorTotal !== null && homeTotal !== null && visitorTotal !== homeTotal
    ? visitorTotal > homeTotal ? visitor : home
    : null;
  return currentLeader && visitorTotal !== null && homeTotal !== null
    ? `${teamAbbreviation(currentLeader.team)} leads by ${Math.abs(visitorTotal - homeTotal)} after ${completedQuarters.length} ${completedQuarters.length === 1 ? 'quarter' : 'quarters'}. Biggest swing: ${largestLabel}.`
    : `The teams are tied after ${completedQuarters.length} ${completedQuarters.length === 1 ? 'quarter' : 'quarters'}. Biggest swing: ${largestLabel}.`;
};

const TeamLogo = ({ team }: { team: Team }) => {
  const abbreviation = teamAbbreviation(team);
  const [imageFailed, setImageFailed] = useState(() => teamLogoPath(team.abbreviation) === null);
  const fallbackClass = abbreviation === 'NYK' ? 'bg-[#1d428a] text-[#f58426]' : 'bg-[#fdbb30] text-[#080d14]';

  if (imageFailed) {
    return <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded text-[10px] font-black ${fallbackClass}`} role="img" aria-label={`${teamName(team)} logo`}>{abbreviation}</span>;
  }

  return <img className="h-9 w-9 shrink-0 object-contain" src={teamLogoPath(team.abbreviation) ?? ''} alt={`${teamName(team)} logo`} onError={() => setImageFailed(true)} />;
};

const TeamLine = ({ boxScoreTeam, score, label }: { boxScoreTeam: BoxScoreTeam; score: number | null; label: string }) => {
  const abbreviation = teamAbbreviation(boxScoreTeam.team);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <TeamLogo team={boxScoreTeam.team} />
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-[#f5f1e8]">{teamName(boxScoreTeam.team)}</div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8f9cac]">{abbreviation} · {label}</div>
      </div>
      {score !== null && <strong className="ml-auto text-2xl tabular-nums text-[#f5f1e8]">{score}</strong>}
    </div>
  );
};

const QuarterTable = ({ visitor, home, visitorScores, homeScores }: { visitor: BoxScoreTeam; home: BoxScoreTeam; visitorScores: (number | null)[]; homeScores: (number | null)[] }) => (
  <div className="mt-3" aria-label="Quarter-by-quarter scores">
    <div className="grid items-center gap-x-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8f9cac]" style={{ gridTemplateColumns: `3rem repeat(${visitorScores.length}, minmax(1.8rem, 1fr))` }}>
      <span className="text-left">Split</span>
      {visitorScores.map((_, index) => <span key={`quarter-label-${index}`}>{periodLabel(index + 1)}</span>)}
    </div>
    {[{ team: visitor, scores: visitorScores }, { team: home, scores: homeScores }].map(({ team, scores }) => (
      <div className="mt-1 grid items-center gap-x-2 text-right text-xs tabular-nums text-[#e7e9ed]" style={{ gridTemplateColumns: `3rem repeat(${scores.length}, minmax(1.8rem, 1fr))` }} key={teamAbbreviation(team.team)}>
        <strong className="truncate text-left text-[#f5f1e8]">{teamAbbreviation(team.team)}</strong>
        {scores.map((score, index) => <span className="rounded bg-[#202d3d] px-1 py-1" key={`${teamAbbreviation(team.team)}-${index}`}>{score ?? '-'}</span>)}
      </div>
    ))}
  </div>
);

const DetailTile = ({ label, value, detail }: { label: string; value: string; detail: string }) => (
  <div className="rounded-lg bg-[#1a2431] px-3 py-2">
    <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7f8b9a]">{label}</span>
    <strong className="mt-1 block text-sm text-[#f5f1e8]">{value}</strong>
    <span className="mt-1 block text-[11px] text-[#aeb8c6]">{detail}</span>
  </div>
);

const CompactTile = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-md bg-[#1a2431] px-2 py-2">
    <span className="block truncate text-[9px] font-semibold uppercase tracking-[0.06em] text-[#7f8b9a]">{label}</span>
    <strong className="mt-1 block truncate text-xs text-[#f5f1e8]">{value}</strong>
  </div>
);

export const App = () => {
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [insights, setInsights] = useState<InsightState>({});
  const [insightStatus, setInsightStatus] = useState<InsightStatus>({ records: 'idle', recentForm: 'idle', matchups: 'idle', fourFactors: 'idle' });
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    const loadThread = async () => {
      if (!active || requestInFlight) return;
      requestInFlight = true;
      const coreStartedAt = performance.now();
      console.info(`[inline-timing] core:start offset=${Math.round(coreStartedAt - inlineStartedAt)}ms`);
      try {
        const response = await fetch('/api/thread/core?summary=1', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as ThreadResponse;
        console.info(`[inline-timing] core:response duration=${Math.round(performance.now() - coreStartedAt)}ms bytes=${response.headers.get('content-length') ?? 'unknown'}`);
        if (!active) return;
        setThread(data);
        setError(false);

        const visitorTeamId = data.game.visitingTeam.id;
        const homeTeamId = data.game.homeTeam.id;
        const clevelandTeamId = data.game.visitingTeam.abbreviation === 'CLE' ? visitorTeamId : homeTeamId;
        if (visitorTeamId !== undefined && homeTeamId !== undefined && clevelandTeamId !== undefined) {
          setInsights({});
          setInsightStatus({ records: 'loading', recentForm: 'loading', matchups: 'loading', fourFactors: data.threadType === 'game-day' ? 'loading' : 'idle' });
          const query = new URLSearchParams({
            visitorTeamId: String(visitorTeamId),
            homeTeamId: String(homeTeamId),
            clevelandTeamId: String(clevelandTeamId),
            season: seasonFromStartTime(data.game.startTime),
          });
          const sections: Array<{ key: InsightSection; section: string }> = [
            { key: 'records', section: 'records' },
            { key: 'recentForm', section: 'recent-form' },
            { key: 'matchups', section: 'past-matchups' },
          ];
          if (data.threadType === 'game-day') sections.push({ key: 'fourFactors', section: 'four-factors' });
          await Promise.all(sections.map(async ({ key, section }) => {
            const sectionStartedAt = performance.now();
            console.info(`[inline-timing] section:start section=${section}`);
            try {
              const insightResponse = await fetch(`/api/thread/insight?${query}&section=${section}`, { cache: 'no-store' });
              if (!insightResponse.ok) throw new Error(`HTTP ${insightResponse.status}`);
              const insightData = await insightResponse.json() as Partial<InsightsResponse>;
              console.info(`[inline-timing] section:response section=${section} duration=${Math.round(performance.now() - sectionStartedAt)}ms bytes=${insightResponse.headers.get('content-length') ?? 'unknown'}`);
              if (active) {
                setInsights((current) => ({ ...current, ...insightData }));
                setInsightStatus((current) => ({ ...current, [key]: 'loaded' }));
              }
            } catch {
              console.warn(`[inline-timing] section:error section=${section} duration=${Math.round(performance.now() - sectionStartedAt)}ms`);
              if (active) setInsightStatus((current) => ({ ...current, [key]: 'error' }));
            }
          }));
        } else if (active) {
          setInsightStatus({ records: 'error', recentForm: 'error', matchups: 'error', fourFactors: 'error' });
        }
      } catch {
        if (active) setError(true);
      } finally {
        requestInFlight = false;
      }
    };

    void loadThread();
    const intervalId = window.setInterval(() => void loadThread(), 60_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!thread) return;
    const frameId = requestAnimationFrame(() => {
      console.info(`[inline-timing] rendered-after-core duration=${Math.round(performance.now() - inlineStartedAt)}ms`);
    });
    return () => cancelAnimationFrame(frameId);
  }, [thread]);

  const launchExpanded = (event: MouseEvent<HTMLButtonElement>) => {
    requestExpandedMode(event.nativeEvent, 'game');
  };

  if (error) {
    return (
      <section className="inline-post-header bg-[#111923] px-4 py-4 text-[#f5f1e8] sm:px-6" aria-label="CavsBot game thread">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FDBB30]">CavsBot</p>
          <p className="mt-1 text-sm text-[#aeb8c6]">Game details are temporarily unavailable.</p>
        </div>
        <button className="inline-action" onClick={launchExpanded}>Open full view</button>
      </section>
    );
  }

  if (!thread) {
    return (
      <section className="inline-post-header overflow-hidden bg-[#111923] text-[#f5f1e8]" aria-label="Loading CavsBot game thread">
        <header className="border-b-4 border-[#FDBB30] bg-[#860038] px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="h-3 w-32 animate-pulse rounded bg-[#fdbb30]/50" />
            <div className="h-3 w-14 animate-pulse rounded bg-white/25" />
          </div>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <div className="flex items-center gap-2"><div className="h-9 w-9 animate-pulse rounded bg-white/20" /><div className="h-4 w-28 max-w-full animate-pulse rounded bg-white/25" /></div>
            <div className="h-3 w-5 animate-pulse rounded bg-white/20" />
            <div className="flex items-center justify-end gap-2"><div className="h-4 w-28 max-w-full animate-pulse rounded bg-white/25" /><div className="h-9 w-9 animate-pulse rounded bg-white/20" /></div>
          </div>
        </header>
        <div className="flex-1 px-4 py-3 sm:px-6">
          <div className="h-3 w-36 animate-pulse rounded bg-[#354052]" />
          <div className="mt-3 space-y-2"><div className="h-6 animate-pulse rounded bg-[#202d3d]" /><div className="h-6 animate-pulse rounded bg-[#202d3d]" /></div>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-[#354052] px-4 py-3 sm:px-6">
          <div className="h-3 w-44 animate-pulse rounded bg-[#354052]" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-[#354052]" />
        </footer>
      </section>
    );
  }

  const { boxScore, game } = thread;
  const isGameDay = thread.threadType === 'game-day';
  const visitorScore = getScore(boxScore.visitor, game.visitingScore);
  const homeScore = getScore(boxScore.home, game.homeScore);
  const periodCount = Math.max(boxScore.visitor.periods?.length ?? 0, boxScore.home.periods?.length ?? 0);
  const visitorScores = periodScores(boxScore.visitor, periodCount);
  const homeScores = periodScores(boxScore.home, periodCount);
  const status = boxScore.gameStatusText ?? game.gameStatusText ?? (game.isFinal ? 'Final' : 'Scheduled');
  const isFinal = game.isFinal || status.toLowerCase().includes('final');
  const analysis = quarterAnalysis(boxScore.visitor, boxScore.home, visitorScores, homeScores, visitorScore, homeScore, isFinal);
  const arena = [game.arena.name, game.arena.city, game.arena.state].filter(Boolean).join(', ');
  const recordsStatus = insightStatus.records;
  const recentFormStatus = insightStatus.recentForm;
  const matchupsStatus = insightStatus.matchups;
  const fourFactorsStatus = insightStatus.fourFactors;
  const insightsLoading = Object.values(insightStatus).some((sectionStatus) => sectionStatus === 'loading');
  const visitorRecord = formatRecord(insights.records?.visitor);
  const homeRecord = formatRecord(insights.records?.home);
  const recentForm = insights?.recentForm ?? [];
  const matchups = insights?.matchups ?? [];
  const matchupStats = matchupSummary(matchups);
  const fourFactors = factorComparisonEntries(insights.fourFactors);
  const visitorTopScorer = playerLabel(boxScore.visitor, 'points');
  const homeTopScorer = playerLabel(boxScore.home, 'points');
  const visitorTopScoringPlayer = topPlayer(boxScore.visitor, 'points');
  const homeTopScoringPlayer = topPlayer(boxScore.home, 'points');
  const compactScorers = `${teamAbbreviation(boxScore.visitor.team)} ${visitorTopScoringPlayer?.statistics.points ?? '-'} / ${teamAbbreviation(boxScore.home.team)} ${homeTopScoringPlayer?.statistics.points ?? '-'}`;
  const compactRecentForm = recentFormStatus === 'loading'
    ? 'Loading'
    : recentForm.length
      ? recentForm.slice(0, 5).map((recentGame) => recentFormLabel(recentGame).result).join('')
      : '-';
  const isPostGame = thread.threadType === 'post-game';
  const isNextDay = thread.threadType === 'next-day';

  return (
    <section className={`inline-post-header ${isGameDay ? 'inline-post-header--compact-mobile' : 'inline-post-header--fill'} overflow-hidden bg-[#111923] text-[#f5f1e8]`} aria-label="CavsBot game thread">
      <header className="border-b-4 border-[#FDBB30] bg-[#860038] px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#FDBB30]">
          <span>{isGameDay ? 'r/clevelandcavs game day' : 'r/clevelandcavs game thread'}</span>
          <span className="text-right text-white/80">{isGameDay ? 'Game day' : status}</span>
        </div>
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <TeamLine boxScoreTeam={boxScore.visitor} score={isGameDay ? null : visitorScore} label="Away" />
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">{isGameDay ? 'vs' : 'at'}</span>
          <TeamLine boxScoreTeam={boxScore.home} score={isGameDay ? null : homeScore} label="Home" />
        </div>
      </header>

      <div className="px-4 py-3 sm:px-6">
        {isGameDay ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-[#c3ccd8]">
            <span><strong className="text-[#f5f1e8]">Tip-off:</strong> {formatTipOff(game.startTime)}</span>
            {arena && <span><strong className="text-[#f5f1e8]">Venue:</strong> {arena}</span>}
          </div>
        ) : periodCount > 0 ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-[#aeb8c6]">Quarter-by-quarter</h2>
              <span className="text-[10px] uppercase tracking-[0.1em] text-[#7f8b9a]">{status}</span>
            </div>
            <QuarterTable visitor={boxScore.visitor} home={boxScore.home} visitorScores={visitorScores} homeScores={homeScores} />
            <p className="mt-3 text-xs leading-5 text-[#c3ccd8]">{analysis}</p>
          </>
        ) : (
          <p className="text-xs text-[#c3ccd8]">Quarter breakdown will appear when the game begins.</p>
        )}
      </div>

      {isGameDay ? (
        <section className="border-t border-[#354052] px-4 py-3 sm:px-6" aria-label="Game preview and matchup details">
          <div className="game-day-desktop">
            <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-[#aeb8c6]">Matchup preview</h2>
            <span className="text-[10px] uppercase tracking-[0.1em] text-[#7f8b9a]">{insightsLoading ? 'Loading' : 'Cleveland outlook'}</span>
            </div>
            <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DetailTile
                label="Team records"
                value={recordsStatus === 'loading' ? 'Loading...' : `${visitorRecord} / ${homeRecord}`}
                detail={recordsStatus === 'loading' ? 'Fetching team records' : `${teamAbbreviation(boxScore.visitor.team)} away · ${teamAbbreviation(boxScore.home.team)} home`}
              />
              <DetailTile
                label="Last 10 meetings"
                value={matchupsStatus === 'loading' ? 'Loading...' : matchupStats.record}
                detail={matchupsStatus === 'loading' ? 'Fetching matchup history' : `${matchupStats.meetings || 'No'} meetings · CLE home ${matchupStats.home} · road ${matchupStats.road}`}
              />
            </div>
            <div className="mt-3 rounded-lg bg-[#1a2431] px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7f8b9a]">Recent Cleveland form</span>
                <span className="text-[10px] text-[#7f8b9a]">{recentFormStatus === 'loading' ? 'Loading' : `Last ${Math.min(recentForm.length, 5)}`}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {recentFormStatus === 'loading' ? <span className="text-xs text-[#7f8b9a]">Loading recent form...</span> : recentForm.length ? recentForm.slice(0, 5).map((recentGame) => {
                  const form = recentFormLabel(recentGame);
                  return <span className="rounded bg-[#202d3d] px-2 py-1 text-[11px] text-[#c3ccd8]" key={recentGame.gameId ?? recentGame.startTime}><strong className={form.result === 'W' ? 'text-[#8fd694]' : 'text-[#ff9d93]'}>{form.result}</strong> {form.opponent} <span className="text-[#7f8b9a]">{form.date}</span></span>;
                }) : <span className="text-xs text-[#7f8b9a]">Recent form unavailable.</span>}
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-[#1a2431] px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7f8b9a]">Recent meetings</span>
                <span className="text-[10px] text-[#7f8b9a]">Head-to-head</span>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-[#c3ccd8] sm:grid-cols-3">
                {matchupsStatus === 'loading' ? <span className="text-[#7f8b9a]">Loading meeting history...</span> : matchups.length ? matchups.slice(0, 3).map((matchup) => <span key={matchup.gameId ?? matchup.startTime}>{matchupLabel(matchup)}</span>) : <span className="text-[#7f8b9a]">Meeting history unavailable.</span>}
              </div>
            </div>
            </>
          </div>
          <div className="game-day-mobile">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-[#aeb8c6]">Matchup preview</h2>
              <span className="text-[10px] uppercase tracking-[0.1em] text-[#7f8b9a]">{insightsLoading ? 'Loading' : 'Cleveland outlook'}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1">
              <CompactTile label="Records" value={recordsStatus === 'loading' ? 'Loading' : `${visitorRecord}/${homeRecord}`} />
              <CompactTile label="Recent CLE" value={compactRecentForm} />
              <CompactTile label="H2H" value={matchupsStatus === 'loading' ? 'Loading' : matchupStats.record} />
            </div>
            <div className="mt-2 rounded-md bg-[#1a2431] px-2 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#7f8b9a]">Four factors</span>
                <span className="text-[9px] text-[#7f8b9a]">CLE / OPP</span>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {fourFactorsStatus === 'loading' ? <span className="col-span-4 text-[10px] text-[#7f8b9a]">Loading...</span> : fourFactors.length ? fourFactors.map(([label, cleveland, opponent]) => <div className="min-w-0 rounded bg-[#202d3d] px-1 py-1 text-center" key={label}><span className="block truncate text-[8px] text-[#7f8b9a]">{label}</span><strong className="block truncate text-[9px] text-[#c3ccd8]">{cleveland} / {opponent}</strong></div>) : <span className="col-span-4 text-[10px] text-[#7f8b9a]">Unavailable</span>}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="border-t border-[#354052] px-4 py-3 sm:px-6" aria-label="Game insight snapshot">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-[#aeb8c6]">{isPostGame ? 'Post-game snapshot' : isNextDay ? 'Discussion snapshot' : 'Game snapshot'}</h2>
            <span className="text-[10px] uppercase tracking-[0.1em] text-[#7f8b9a]">{insightsLoading ? 'Loading' : 'More context'}</span>
          </div>
          <>
            <div className="mt-3 hidden gap-2 sm:grid sm:grid-cols-3">
              <DetailTile
                label="Team records"
                value={recordsStatus === 'loading' ? 'Loading...' : `${visitorRecord} / ${homeRecord}`}
                detail={recordsStatus === 'loading' ? 'Fetching team records' : `${teamAbbreviation(boxScore.visitor.team)} / ${teamAbbreviation(boxScore.home.team)}`}
              />
              <DetailTile
                label="Top scorers"
                value={`${teamAbbreviation(boxScore.visitor.team)} ${visitorTopScorer}`}
                detail={`${teamAbbreviation(boxScore.home.team)} ${homeTopScorer}`}
              />
              <DetailTile
                label="Head-to-head"
                value={matchupsStatus === 'loading' ? 'Loading...' : matchupStats.record}
                detail={matchupsStatus === 'loading' ? 'Fetching matchup history' : `${matchupStats.meetings || 'No'} recent meetings`}
              />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 sm:hidden">
              <CompactTile label="Records" value={recordsStatus === 'loading' ? 'Loading' : `${visitorRecord}/${homeRecord}`} />
              <CompactTile label="Leaders" value={compactScorers} />
              <CompactTile label="H2H" value={matchupsStatus === 'loading' ? 'Loading' : matchupStats.record} />
            </div>
            <div className="mt-2 hidden flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#2b3542] pt-2 sm:flex">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7f8b9a]">Recent CLE</span>
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  {recentFormStatus === 'loading' ? <span className="text-xs text-[#7f8b9a]">Loading recent form...</span> : recentForm.length ? recentForm.slice(0, 5).map((recentGame) => {
                    const form = recentFormLabel(recentGame);
                    return <span className="text-xs text-[#c3ccd8]" key={recentGame.gameId ?? recentGame.startTime}><strong className={form.result === 'W' ? 'text-[#8fd694]' : 'text-[#ff9d93]'}>{form.result}</strong> {form.opponent}</span>;
                  }) : <span className="text-xs text-[#7f8b9a]">Unavailable</span>}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7f8b9a]">Meetings</span>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#c3ccd8]">
                  {matchupsStatus === 'loading' ? <span className="text-[#7f8b9a]">Loading meeting history...</span> : matchups.length ? matchups.slice(0, 3).map((matchup) => <div key={matchup.gameId ?? matchup.startTime}>{matchupLabel(matchup)}</div>) : <span className="text-[#7f8b9a]">Unavailable</span>}
                </div>
              </div>
            </div>
          </>
        </section>
      )}

      <footer className="flex items-center justify-between gap-3 border-t border-[#354052] bg-[#111923] px-4 py-3 sm:px-6">
        <span className="text-xs text-[#8f9cac]">{isGameDay ? 'Preview, schedule, and matchup details' : 'Full stats and play-by-play available'}</span>
        <button className="inline-action" onClick={launchExpanded}>Open full view</button>
      </footer>
    </section>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
