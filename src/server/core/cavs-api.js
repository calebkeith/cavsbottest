const API_BASE_URL = 'https://cavsbotapi-brfghpcjgdggaugg.eastus-01.azurewebsites.net';
export class CavsBotApiError extends Error {
    status;
    path;
    constructor(message, status, path) {
        super(message);
        this.status = status;
        this.path = path;
        this.name = 'CavsBotApiError';
    }
}
const toQueryString = (query = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '')
            params.set(key, String(value));
    }
    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
};
export class CavsBotApiClient {
    baseUrl;
    constructor(baseUrl = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }
    async request(path, query, init) {
        const response = await fetch(`${this.baseUrl}${path}${toQueryString(query)}`, {
            ...init,
            headers: { Accept: 'application/json', ...init?.headers },
        });
        if (!response.ok) {
            const detail = await response.text();
            throw new CavsBotApiError(detail || `CavsBot API request failed with status ${response.status}`, response.status, path);
        }
        if (response.status === 204)
            return undefined;
        return response.json();
    }
    health() { return this.request('/health'); }
    teams() { return this.request('/api/v1/teams'); }
    team(team) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}`); }
    seasons() { return this.request('/api/v1/seasons'); }
    teamPlayers(team, season) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/players`, { season }); }
    teamRoster(team, season) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/roster`, { season }); }
    teamCoaches(team, season) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/coaches`, { season }); }
    teamSchedule(team, query) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/schedule`, query); }
    game(gameId) { return this.request(`/api/v1/games/${encodeURIComponent(gameId)}`); }
    scoreboard(date) { return this.request('/api/v1/scoreboard', { date }); }
    scoreboardToday() { return this.request('/api/v1/scoreboard/today'); }
    nextGame(team) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/next-game`); }
    previousGame(team) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/previous-game`); }
    recentForm(team, count = 5) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/recent-form`, { count }); }
    matchups(team, opponent, count = 50) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/matchups/${encodeURIComponent(opponent)}`, { count }); }
    playByPlay(gameId) { return this.request(`/api/v1/games/${encodeURIComponent(gameId)}/playbyplay`); }
    players(query) { return this.request('/api/v1/players', query); }
    player(playerId) { return this.request(`/api/v1/players/${playerId}`); }
    playerTeams(playerId) { return this.request(`/api/v1/players/${playerId}/teams`); }
    playerRosterHistory(playerId) { return this.request(`/api/v1/players/${playerId}/roster-history`); }
    playerGameLog(playerId, query) { return this.request(`/api/v1/players/${playerId}/gamelog`, query); }
    playerStats(playerId, query) { return this.request(`/api/v1/players/${playerId}/stats`, query); }
    playerShotChart(playerId, query) { return this.request(`/api/v1/players/${playerId}/shotchart`, query); }
    playerStatsDashboard(query) { return this.request('/api/v1/players/stats', query); }
    playerAdvancedStats(query) { return this.request('/api/v1/players/advanced-stats', query); }
    playerSplits(playerId, query) { return this.request(`/api/v1/players/${playerId}/splits`, query); }
    playerAdvancedStatsById(playerId, query) { return this.request(`/api/v1/players/${playerId}/advanced-stats`, query); }
    playerTracking(playerId, query) { return this.request(`/api/v1/players/${playerId}/tracking`, query); }
    playerAwards(playerId) { return this.request(`/api/v1/players/${playerId}/awards`); }
    teamStats(team, query) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/stats`, query); }
    teamAdvancedStats(team, query) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/advanced-stats`, query); }
    teamGameLog(team, query) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/game-log`, query); }
    teamSplits(team, query) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/splits`, query); }
    teamLineups(team, query) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/lineups`, query); }
    teamLineupCombinations(team, query) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/lineup-combinations`, query); }
    teamOnOff(team, query) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/on-off`, query); }
    teamClutch(team, query) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/clutch`, query); }
    teamFourFactors(team, query) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/four-factors`, query); }
    teamOpponentStats(team, query) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/opponent-stats`, query); }
    teamQuarterStats(team, query) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/quarter-stats`, query); }
    leaders(query) { return this.request('/api/v1/leaders', query); }
    standings(query) { return this.request('/api/v1/standings', query); }
    record(team, seasonType) { return this.request(`/api/v1/teams/${encodeURIComponent(team)}/record`, { seasonType }); }
    boxScore(gameId) { return this.request(`/api/v1/games/${encodeURIComponent(gameId)}/boxscore`); }
}
export const cavsBotApi = new CavsBotApiClient();
//# sourceMappingURL=cavs-api.js.map