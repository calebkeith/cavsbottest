const API_BASE_URL = 'https://cavsbotapi-brfghpcjgdggaugg.eastus-01.azurewebsites.net';

type ApiValue = string | number | boolean | null;
export type Query = Record<string, ApiValue | undefined>;
export type ApiObject = Record<string, unknown>;
export type TeamIdentifier = string | number;

export type TeamResponse = {
  abbreviation: string | null;
  id: number;
  city: string | null;
  name: string | null;
  fullName: string | null;
};

export type ArenaResponse = {
  name: string | null;
  city: string | null;
  state: string | null;
  attendance: number;
};

export type PeriodResponse = {
  period: number;
  periodType: string | null;
  score: number;
};

export type PlayerStatisticsResponse = {
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

export type BoxScorePlayerResponse = {
  personId: number;
  firstName: string;
  familyName: string;
  jerseyNumber: string;
  position: string | null;
  status: string;
  played: boolean;
  starter: boolean;
  statistics: PlayerStatisticsResponse;
};

export type TeamScoreResponse = {
  team: TeamResponse;
  score: number | null;
  wins: number;
  losses: number;
  periods: PeriodResponse[] | null;
  players: BoxScorePlayerResponse[];
};

export type ScheduleGameResponse = {
  gameId: string | null;
  startTime: string;
  seasonType: number;
  gameLabel: string | null;
  gameStatus: number;
  gameStatusText: string | null;
  isFinal: boolean;
  visitingScore: number | null;
  homeScore: number | null;
  winner: TeamResponse | null;
  visitingTeam: TeamResponse;
  homeTeam: TeamResponse;
  arena: ArenaResponse;
  media: ApiObject[] | null;
};

export type BoxScoreResponse = {
  gameId: string | null;
  isAvailable: boolean;
  gameState: string | null;
  startTimeUtc: string;
  startTimeEastern: string;
  gameCode: string | null;
  gameClock: string | null;
  gameStatusText: string | null;
  period: number;
  arena: ArenaResponse;
  visitor: TeamScoreResponse;
  home: TeamScoreResponse;
  officials: ApiObject[] | null;
};

export type PlayerResponse = {
  id: number;
  teamId: number;
  season: string | null;
  leagueId: string | null;
  name: string | null;
  nickname: string | null;
  playerSlug: string | null;
  jerseyNumber: string | null;
  position: string | null;
  height: string | null;
  weight: string | null;
  birthDate: string | null;
  age: string | null;
  experience: string | null;
  school: string | null;
  howAcquired: string | null;
  supplementalStatus: number;
};

export type SeasonResponse = {
  value: string | null;
  label: string | null;
  startYear: number;
  endYear: number;
  isCurrent: boolean;
};

export type RecordResponse = {
  team: string | null;
  record: string | null;
  wins: string | null;
  losses: string | null;
};

export type StandingResponse = {
  team: TeamResponse;
  conference: number;
  wins: string | null;
  losses: string | null;
  winPercentage: string | null;
  gamesBehind: number;
  streak: string | null;
};

export type StatsResultSetResponse = {
  name: string | null;
  headers: string[] | null;
  rows: Record<string, string>[] | null;
};

export type StatsResponse = {
  resource: string | null;
  parameters: Record<string, string | null> | null;
  resultSets: StatsResultSetResponse[] | null;
};

export type GameActionResponse = ApiObject;
export type PlayerSearchResponse = ApiObject;
export type LeagueLeaderResponse = ApiObject;
export type TeamDashboardResponse = ApiObject;
export type LineupCombinationsResponse = ApiObject;
export type PlayerCareerStatsResponse = ApiObject;
export type PlayerGameLogResponse = ApiObject;
export type PlayerTrackingResponse = ApiObject;

export class CavsBotApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string
  ) {
    super(message);
    this.name = 'CavsBotApiError';
  }
}

const toQueryString = (query: Query = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

export class CavsBotApiClient {
  constructor(private readonly baseUrl = API_BASE_URL) {}

  async request<T>(path: string, query?: Query, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}${toQueryString(query)}`, {
      ...init,
      headers: { Accept: 'application/json', ...init?.headers },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new CavsBotApiError(
        detail || `CavsBot API request failed with status ${response.status}`,
        response.status,
        path
      );
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  health() { return this.request<void>('/health'); }
  teams() { return this.request<TeamResponse[]>('/api/v1/teams'); }
  team(team: TeamIdentifier) { return this.request<TeamResponse>(`/api/v1/teams/${encodeURIComponent(team)}`); }
  seasons() { return this.request<SeasonResponse[]>('/api/v1/seasons'); }
  teamPlayers(team: TeamIdentifier, season?: string) { return this.request<PlayerResponse[]>(`/api/v1/teams/${encodeURIComponent(team)}/players`, { season }); }
  teamRoster(team: TeamIdentifier, season?: string) { return this.request<PlayerResponse[]>(`/api/v1/teams/${encodeURIComponent(team)}/roster`, { season }); }
  teamCoaches(team: TeamIdentifier, season?: string) { return this.request<ApiObject[]>(`/api/v1/teams/${encodeURIComponent(team)}/coaches`, { season }); }
  teamSchedule(team: TeamIdentifier, query?: Query) { return this.request<ScheduleGameResponse[]>(`/api/v1/teams/${encodeURIComponent(team)}/schedule`, query); }
  game(gameId: string) { return this.request<ScheduleGameResponse>(`/api/v1/games/${encodeURIComponent(gameId)}`); }
  scoreboard(date?: string) { return this.request<ScheduleGameResponse[]>('/api/v1/scoreboard', { date }); }
  scoreboardToday() { return this.request<ScheduleGameResponse[]>('/api/v1/scoreboard/today'); }
  nextGame(team: TeamIdentifier) { return this.request<ScheduleGameResponse>(`/api/v1/teams/${encodeURIComponent(team)}/next-game`); }
  previousGame(team: TeamIdentifier) { return this.request<ScheduleGameResponse>(`/api/v1/teams/${encodeURIComponent(team)}/previous-game`); }
  recentForm(team: TeamIdentifier, count = 5) { return this.request<ScheduleGameResponse[]>(`/api/v1/teams/${encodeURIComponent(team)}/recent-form`, { count }); }
  pastMatchups(team: TeamIdentifier, opponent: TeamIdentifier, count = 10, seasonType?: number) { return this.request<ScheduleGameResponse[]>(`/api/v1/teams/${encodeURIComponent(team)}/matchups/${encodeURIComponent(opponent)}/past`, { count, seasonType }); }
  playByPlay(gameId: string) { return this.request<GameActionResponse[]>(`/api/v1/games/${encodeURIComponent(gameId)}/playbyplay`); }
  players(query?: Query) { return this.request<PlayerSearchResponse[]>('/api/v1/players', query); }
  player(playerId: number) { return this.request<PlayerCareerStatsResponse>(`/api/v1/players/${playerId}`); }
  playerTeams(playerId: number) { return this.request<PlayerCareerStatsResponse>(`/api/v1/players/${playerId}/teams`); }
  playerRosterHistory(playerId: number) { return this.request<PlayerCareerStatsResponse>(`/api/v1/players/${playerId}/roster-history`); }
  playerGameLog(playerId: number, query?: Query) { return this.request<PlayerGameLogResponse[]>(`/api/v1/players/${playerId}/gamelog`, query); }
  playerStats(playerId: number, query?: Query) { return this.request<StatsResponse>(`/api/v1/players/${playerId}/stats`, query); }
  playerShotChart(playerId: number, query?: Query) { return this.request<StatsResponse>(`/api/v1/players/${playerId}/shotchart`, query); }
  playerStatsDashboard(query?: Query) { return this.request<StatsResponse>('/api/v1/players/stats', query); }
  playerAdvancedStats(query?: Query) { return this.request<StatsResponse>('/api/v1/players/advanced-stats', query); }
  playerSplits(playerId: number, query?: Query) { return this.request<StatsResponse>(`/api/v1/players/${playerId}/splits`, query); }
  playerAdvancedStatsById(playerId: number, query?: Query) { return this.request<StatsResponse>(`/api/v1/players/${playerId}/advanced-stats`, query); }
  playerTracking(playerId: number, query?: Query) { return this.request<PlayerTrackingResponse>(`/api/v1/players/${playerId}/tracking`, query); }
  playerAwards(playerId: number) { return this.request<ApiObject[]>(`/api/v1/players/${playerId}/awards`); }
  teamStats(team: TeamIdentifier, query?: Query) { return this.request<StatsResponse>(`/api/v1/teams/${encodeURIComponent(team)}/stats`, query); }
  teamAdvancedStats(team: TeamIdentifier, query?: Query) { return this.request<StatsResponse>(`/api/v1/teams/${encodeURIComponent(team)}/advanced-stats`, query); }
  teamGameLog(team: TeamIdentifier, query?: Query) { return this.request<StatsResponse>(`/api/v1/teams/${encodeURIComponent(team)}/game-log`, query); }
  teamSplits(team: TeamIdentifier, query?: Query) { return this.request<TeamDashboardResponse>(`/api/v1/teams/${encodeURIComponent(team)}/splits`, query); }
  teamLineups(team: TeamIdentifier, query?: Query) { return this.request<LineupCombinationsResponse>(`/api/v1/teams/${encodeURIComponent(team)}/lineups`, query); }
  teamLineupCombinations(team: TeamIdentifier, query?: Query) { return this.request<LineupCombinationsResponse>(`/api/v1/teams/${encodeURIComponent(team)}/lineup-combinations`, query); }
  teamOnOff(team: TeamIdentifier, query?: Query) { return this.request<StatsResponse>(`/api/v1/teams/${encodeURIComponent(team)}/on-off`, query); }
  teamClutch(team: TeamIdentifier, query?: Query) { return this.request<StatsResponse>(`/api/v1/teams/${encodeURIComponent(team)}/clutch`, query); }
  teamFourFactors(team: TeamIdentifier, query?: Query) { return this.request<StatsResponse>(`/api/v1/teams/${encodeURIComponent(team)}/four-factors`, query); }
  teamOpponentStats(team: TeamIdentifier, query?: Query) { return this.request<StatsResponse>(`/api/v1/teams/${encodeURIComponent(team)}/opponent-stats`, query); }
  teamQuarterStats(team: TeamIdentifier, query?: Query) { return this.request<StatsResponse>(`/api/v1/teams/${encodeURIComponent(team)}/quarter-stats`, query); }
  leaders(query?: Query) { return this.request<LeagueLeaderResponse[]>('/api/v1/leaders', query); }
  standings(query?: Query) { return this.request<StandingResponse[]>('/api/v1/standings', query); }
  record(team: TeamIdentifier, seasonType?: number) { return this.request<RecordResponse>(`/api/v1/teams/${encodeURIComponent(team)}/record`, { seasonType }); }
  boxScore(gameId: string) { return this.request<BoxScoreResponse>(`/api/v1/games/${encodeURIComponent(gameId)}/boxscore`); }
}

export const cavsBotApi = new CavsBotApiClient();
