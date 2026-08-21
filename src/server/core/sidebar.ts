import { context, reddit } from '@devvit/web/server';
import { cavsBotApi, type ScheduleGameResponse, type StandingResponse } from './cavs-api';
import { currentSeasonType, SEASON_TYPES, seasonTypeLabel } from './season';

const SCHEDULE_WIDGET = 'Schedule';
const STANDINGS_WIDGET = 'Standings';
const LEGACY_SCHEDULE_WIDGET = 'CavsBot Schedule';
const LEGACY_STANDINGS_WIDGET = 'CavsBot Standings';
const easternTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatScheduleTable = (games: ScheduleGameResponse[], seasonType: number) => {
  const rows = games.map((game) => {
    const isHome = game.homeTeam.abbreviation === 'CLE';
    const opponent = isHome ? game.visitingTeam : game.homeTeam;
    const date = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(game.startTime));
    const time = game.gameStatusText?.match(/\b\d{1,2}:\d{2}\s*[AP]\.?M\.?(?:\s*ET)?\b/i)?.[0]
      ?? `${new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(game.startTime))} ET`;
    return `| ${date} | ${isHome ? 'vs.' : '@'}${opponent.abbreviation ?? opponent.name ?? 'OPP'} | ${time} |`;
  });
  return [`# ${seasonTypeLabel(seasonType)} Schedule`, '| Date | Opponent | Time |', '| :-- | :-- | :--: |', ...rows].join('\n');
};

const formatStandings = (standings: StandingResponse[], limit?: number) => {
  const rows = standings
    .filter((standing) => standing.conference === 0)
    .sort((left, right) => Number(right.winPercentage ?? 0) - Number(left.winPercentage ?? 0))
    .map((standing) => `| ${standing.team.name ?? standing.team.fullName ?? 'Team'} | ${standing.wins ?? '-'} | ${standing.losses ?? '-'} | ${standing.winPercentage ?? '-'} | ${standing.gamesBehind} |`);
  return ['# Eastern Conference Standings', '| Team | W | L | Win % | GB |', '| :-- | ---: | ---: | ---: | ---: |', ...(limit ? rows.slice(0, limit) : rows)].join('\n');
};

const formatClassicSidebar = (scheduleText: string, standingsText: string, updatedAt: string) => [
  '',
  '',
  "###Don't forget to check the [new queue](http://reddit.com/r/clevelandcavs/new)!",
  '',
  '###Please read our posting [guidelines](https://www.reddit.com/r/clevelandcavs/comments/5d4hjq/meta_updated_subreddit_guidelines/)',
  '',
  scheduleText,
  '',
  standingsText,
  '',
  '#Related Subreddits',
  '',
  '* /r/Basketball ',
  '',
  '* /r/Browns ',
  '',
  '* /r/Cleveland ',
  '',
  '* /r/ClevelandTickets ',
  '',
  '* /r/nba ',
  '',
  '* /r/Ohio ',
  '',
  '* /r/sports ',
  '',
  '* /r/ClevelandGuardians ',
  '',
  '* /r/BlueJackets ',
  '',
  '* /r/NBA_memes',
  '',
  '-----',
  '',
  '* [Archived Player Spotlights](http://www.reddit.com/r/clevelandcavs/wiki/playerspotlights) ',
  '',
  "* [Cavs' official site](http://www.nba.com/cavaliers/)",
  '',
  '* [Full NBA standings](http://www.nba.com/standings/team_record_comparison/conferenceNew_Std_Div.html?ls=iref:nba:gnav)',
  '',
  '* [Cavs Multi-Twitter](http://www.hashtagbasketball.com/nba-team-tweets/cleveland-cavaliers)',
  '',
  '* [/r/clevelandcavs Discord](https://discord.gg/qqzMbew)',
  '',
  `*Updated by CavsBot at: ${updatedAt}*`,
].join('\n');

const updateWidget = async (shortName: string, text: string, legacyShortName?: string) => {
  const subreddit = context.subredditName;
  const widgets = await reddit.getWidgets(subreddit);
  const existing = widgets.find((widget) => widget.name === shortName || widget.name === legacyShortName);
  if (existing) {
    await reddit.updateWidget({ type: 'textarea', subreddit, id: existing.id, shortName, text });
  } else {
    await reddit.addWidget({ type: 'textarea', subreddit, shortName, text });
  }
};

export const updateSidebarAndWidgets = async () => {
  const now = Date.now();
  const startedAt = Date.now();
  console.log('[sidebar-timing] refresh started');
  const timed = async <T,>(label: string, task: Promise<T>) => {
    const requestStartedAt = Date.now();
    try {
      return await task;
    } finally {
      console.log(`[sidebar-timing] ${label} ${Date.now() - requestStartedAt}ms`);
    }
  };
  const teams = await timed('teams', cavsBotApi.teams());
  const cavaliers = teams.find(
    (team) =>
      team.name?.toLowerCase() === 'cavaliers' ||
      team.fullName?.toLowerCase() === 'cleveland cavaliers'
  );
  if (!cavaliers) throw new Error('Cleveland Cavaliers team was not returned by the NBA API');

  const scheduleResults = await timed('schedule', Promise.all(SEASON_TYPES.map((seasonType) => cavsBotApi.teamSchedule(String(cavaliers.id), { seasonType }))));
  const schedule = scheduleResults.flat();
  const sorted = schedule
    .filter((game) => Number.isFinite(new Date(game.startTime).getTime()))
    .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime());
  const seasonType = currentSeasonType(sorted, now);
  const seasonSchedule = sorted.filter((game) => game.seasonType === seasonType);
  const past = seasonSchedule.filter((game) => new Date(game.startTime).getTime() < now).slice(-3);
  const upcoming = seasonSchedule.filter((game) => new Date(game.startTime).getTime() >= now).slice(0, 10);
  const allScheduleText = formatScheduleTable([...past, ...upcoming], seasonType);
  const standings = await timed('standings', cavsBotApi.standings({ conference: 0 }));
  const standingsText = formatStandings(standings);
  const subreddit = context.subredditName;
  const updatedAt = easternTime.format(new Date());
  const classicSidebar = formatClassicSidebar(allScheduleText, standingsText, updatedAt);
  await timed('reddit-writes', Promise.all([
    reddit.updateWikiPage({ subredditName: subreddit, page: 'config/sidebar', content: classicSidebar, reason: 'Update live Cavs schedule and standings', wikiVersion: 'v1' }),
    updateWidget(SCHEDULE_WIDGET, `${allScheduleText}\n\n_CavsBot last updated ${updatedAt} ET_`, LEGACY_SCHEDULE_WIDGET),
    updateWidget(STANDINGS_WIDGET, `${standingsText}\n\n_CavsBot last updated ${updatedAt} ET_`, LEGACY_STANDINGS_WIDGET),
  ]));
  console.log(`[sidebar-timing] refresh completed ${Date.now() - startedAt}ms`);
};