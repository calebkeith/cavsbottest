import type { BoxScorePlayerResponse, BoxScoreResponse, PlayerStatisticsResponse, ScheduleGameResponse } from './cavs-api';

export const testGame: ScheduleGameResponse = {
  gameId: '0042500304',
  startTime: '2026-05-26T00:00:00Z',
  seasonType: 3,
  gameLabel: null,
  gameStatus: 3,
  gameStatusText: 'Final',
  isFinal: true,
  visitingScore: 130,
  homeScore: 93,
  winner: {
    abbreviation: 'NYK',
    id: 1610612752,
    city: 'New York',
    name: 'Knicks',
    fullName: 'New York Knicks',
  },
  visitingTeam: {
    abbreviation: 'NYK',
    id: 1610612752,
    city: 'New York',
    name: 'Knicks',
    fullName: 'New York Knicks',
  },
  homeTeam: {
    abbreviation: 'CLE',
    id: 1610612739,
    city: 'Cleveland',
    name: 'Cavaliers',
    fullName: 'Cleveland Cavaliers',
  },
  arena: {
    name: 'Rocket Arena',
    city: 'Cleveland',
    state: 'OH',
    attendance: 0,
  },
  media: null,
};

const testPlayer = (
  personId: number,
  firstName: string,
  familyName: string,
  position: string | null,
  starter: boolean,
  statistics: Partial<PlayerStatisticsResponse>
): BoxScorePlayerResponse => ({
  personId,
  firstName,
  familyName,
  jerseyNumber: '',
  position,
  status: 'ACTIVE',
  played: true,
  starter,
  statistics: {
    minutes: 'PT00M00.00S',
    points: 0,
    assists: 0,
    reboundsTotal: 0,
    reboundsOffensive: 0,
    reboundsDefensive: 0,
    steals: 0,
    blocks: 0,
    foulsPersonal: 0,
    turnovers: 0,
    plusMinusPoints: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    fieldGoalsPercentage: 0,
    twoPointersMade: 0,
    twoPointersAttempted: 0,
    twoPointersPercentage: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    threePointersPercentage: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    freeThrowsPercentage: 0,
    ...statistics,
  },
});

const visitorPlayers = [
  testPlayer(1628404, 'Josh', 'Hart', 'SF', true, { minutes: 'PT23M36.60S', points: 6, assists: 6, reboundsTotal: 11, reboundsOffensive: 4, reboundsDefensive: 7, steals: 2, foulsPersonal: 3, turnovers: 2, plusMinusPoints: 20, fieldGoalsMade: 2, fieldGoalsAttempted: 5, fieldGoalsPercentage: 0.4, twoPointersMade: 1, twoPointersAttempted: 2, twoPointersPercentage: 0.5, threePointersMade: 1, threePointersAttempted: 3, threePointersPercentage: 0.333333, freeThrowsMade: 1, freeThrowsAttempted: 2, freeThrowsPercentage: 0.5 }),
  testPlayer(1628384, 'OG', 'Anunoby', 'PF', true, { minutes: 'PT27M02.60S', points: 17, assists: 4, reboundsTotal: 7, reboundsOffensive: 3, reboundsDefensive: 4, steals: 2, foulsPersonal: 4, turnovers: 1, plusMinusPoints: 14, fieldGoalsMade: 6, fieldGoalsAttempted: 13, fieldGoalsPercentage: 0.461538, twoPointersMade: 5, twoPointersAttempted: 8, twoPointersPercentage: 0.625, threePointersMade: 1, threePointersAttempted: 5, threePointersPercentage: 0.2, freeThrowsMade: 4, freeThrowsAttempted: 4, freeThrowsPercentage: 1 }),
  testPlayer(1626157, 'Karl-Anthony', 'Towns', 'C', true, { minutes: 'PT25M58.00S', points: 19, assists: 3, reboundsTotal: 14, reboundsOffensive: 2, reboundsDefensive: 12, steals: 2, blocks: 2, foulsPersonal: 4, turnovers: 2, plusMinusPoints: 25, fieldGoalsMade: 8, fieldGoalsAttempted: 11, fieldGoalsPercentage: 0.727273, twoPointersMade: 5, twoPointersAttempted: 8, twoPointersPercentage: 0.625, threePointersMade: 3, threePointersAttempted: 3, threePointersPercentage: 1 }),
  testPlayer(1628969, 'Mikal', 'Bridges', 'SG', true, { minutes: 'PT30M06.60S', points: 15, assists: 5, reboundsTotal: 3, reboundsDefensive: 3, foulsPersonal: 2, turnovers: 2, plusMinusPoints: 10, fieldGoalsMade: 4, fieldGoalsAttempted: 16, fieldGoalsPercentage: 0.25, twoPointersMade: 3, twoPointersAttempted: 8, twoPointersPercentage: 0.375, threePointersMade: 1, threePointersAttempted: 8, threePointersPercentage: 0.125, freeThrowsMade: 6, freeThrowsAttempted: 6, freeThrowsPercentage: 1 }),
  testPlayer(1628973, 'Jalen', 'Brunson', 'PG', true, { minutes: 'PT30M51.80S', points: 15, assists: 5, reboundsTotal: 2, reboundsOffensive: 1, reboundsDefensive: 1, foulsPersonal: 0, turnovers: 0, plusMinusPoints: 16, fieldGoalsMade: 6, fieldGoalsAttempted: 14, fieldGoalsPercentage: 0.428571, twoPointersMade: 4, twoPointersAttempted: 9, twoPointersPercentage: 0.444444, threePointersMade: 2, threePointersAttempted: 5, threePointersPercentage: 0.4, freeThrowsMade: 1, freeThrowsAttempted: 2, freeThrowsPercentage: 0.5 }),
];

const homePlayers = [
  testPlayer(1629622, 'Max', 'Strus', 'SF', true, { minutes: 'PT21M53.00S', points: 5, assists: 2, reboundsTotal: 2, reboundsDefensive: 2, foulsPersonal: 3, turnovers: 2, plusMinusPoints: -9, fieldGoalsMade: 2, fieldGoalsAttempted: 6, fieldGoalsPercentage: 0.333333, twoPointersMade: 1, twoPointersAttempted: 2, twoPointersPercentage: 0.5, threePointersMade: 1, threePointersAttempted: 4, threePointersPercentage: 0.25 }),
  testPlayer(1630596, 'Evan', 'Mobley', 'PF', true, { minutes: 'PT33M20.00S', points: 15, assists: 4, reboundsTotal: 7, reboundsOffensive: 2, reboundsDefensive: 5, steals: 1, foulsPersonal: 1, turnovers: 3, plusMinusPoints: -30, fieldGoalsMade: 7, fieldGoalsAttempted: 15, fieldGoalsPercentage: 0.466667, twoPointersMade: 6, twoPointersAttempted: 11, twoPointersPercentage: 0.545455, threePointersMade: 1, threePointersAttempted: 4, threePointersPercentage: 0.25, freeThrowsAttempted: 1 }),
  testPlayer(1628386, 'Jarrett', 'Allen', 'C', true, { minutes: 'PT25M34.00S', points: 6, assists: 1, reboundsTotal: 3, reboundsDefensive: 3, steals: 2, blocks: 2, foulsPersonal: 0, turnovers: 1, plusMinusPoints: -22, fieldGoalsMade: 3, fieldGoalsAttempted: 5, fieldGoalsPercentage: 0.6, twoPointersMade: 3, twoPointersAttempted: 5, twoPointersPercentage: 0.6 }),
  testPlayer(1628378, 'Donovan', 'Mitchell', 'SG', true, { minutes: 'PT31M29.60S', points: 31, assists: 1, reboundsTotal: 4, reboundsDefensive: 4, steals: 1, foulsPersonal: 3, turnovers: 4, plusMinusPoints: -23, fieldGoalsMade: 9, fieldGoalsAttempted: 18, fieldGoalsPercentage: 0.5, twoPointersMade: 4, twoPointersAttempted: 9, twoPointersPercentage: 0.444444, threePointersMade: 5, threePointersAttempted: 9, threePointersPercentage: 0.555556, freeThrowsMade: 8, freeThrowsAttempted: 10, freeThrowsPercentage: 0.8 }),
  testPlayer(201935, 'James', 'Harden', 'PG', true, { minutes: 'PT32M56.00S', points: 12, assists: 2, reboundsTotal: 4, reboundsDefensive: 4, steals: 1, blocks: 1, foulsPersonal: 2, turnovers: 5, plusMinusPoints: -19, fieldGoalsMade: 2, fieldGoalsAttempted: 8, fieldGoalsPercentage: 0.25, twoPointersMade: 2, twoPointersAttempted: 2, twoPointersPercentage: 1, threePointersAttempted: 6, freeThrowsMade: 8, freeThrowsAttempted: 9, freeThrowsPercentage: 0.888889 }),
];

visitorPlayers.push(
  testPlayer(1630540, 'Miles', 'McBride', null, false, { minutes: 'PT16M41.60S', points: 11, assists: 2, reboundsTotal: 2, reboundsDefensive: 2, steals: 3, foulsPersonal: 1, plusMinusPoints: 25, fieldGoalsMade: 4, fieldGoalsAttempted: 6, fieldGoalsPercentage: 0.666667 }),
  testPlayer(1629011, 'Mitchell', 'Robinson', null, false, { minutes: 'PT17M46.80S', points: 8, reboundsTotal: 10, reboundsOffensive: 5, reboundsDefensive: 5, steals: 1, foulsPersonal: 1, turnovers: 2, plusMinusPoints: 14, fieldGoalsMade: 4, fieldGoalsAttempted: 6, fieldGoalsPercentage: 0.666667 }),
  testPlayer(1629013, 'Landry', 'Shamet', null, false, { minutes: 'PT18M58.00S', points: 16, assists: 2, steals: 1, plusMinusPoints: 28, fieldGoalsMade: 5, fieldGoalsAttempted: 6, fieldGoalsPercentage: 0.833333 }),
  testPlayer(1630631, 'Jose', 'Alvarado', null, false, { minutes: 'PT10M07.00S', points: 4, assists: 2, steals: 2, foulsPersonal: 1, turnovers: 2, plusMinusPoints: 21, fieldGoalsMade: 2, fieldGoalsAttempted: 3, fieldGoalsPercentage: 0.666667 }),
  testPlayer(203903, 'Jordan', 'Clarkson', null, false, { minutes: 'PT08M37.00S', points: 3, reboundsTotal: 1, reboundsOffensive: 1, foulsPersonal: 1, turnovers: 1, plusMinusPoints: 4, fieldGoalsMade: 1, fieldGoalsAttempted: 6, fieldGoalsPercentage: 0.166667 }),
  testPlayer(1642278, 'Tyler', 'Kolek', null, false, { minutes: 'PT07M47.00S', points: 8, assists: 1, reboundsTotal: 1, reboundsOffensive: 1, plusMinusPoints: 2, fieldGoalsMade: 3, fieldGoalsAttempted: 7, fieldGoalsPercentage: 0.428571 }),
  testPlayer(1642885, 'Mohamed', 'Diawara', null, false, { minutes: 'PT07M47.00S', reboundsTotal: 3, assists: 2, reboundsDefensive: 3, foulsPersonal: 1, turnovers: 1, plusMinusPoints: 2 }),
  testPlayer(1630574, 'Ariel', 'Hukporti', null, false, { minutes: 'PT07M47.00S', points: 2, assists: 1, reboundsTotal: 5, reboundsOffensive: 2, reboundsDefensive: 3, steals: 1, foulsPersonal: 1, plusMinusPoints: 2, fieldGoalsMade: 1, fieldGoalsAttempted: 1, fieldGoalsPercentage: 1 }),
  testPlayer(1642359, 'Pacome', 'Dadiet', null, false, { minutes: 'PT06M53.00S', points: 6, reboundsTotal: 1, reboundsOffensive: 1, steals: 1, fieldGoalsMade: 2, fieldGoalsAttempted: 4, fieldGoalsPercentage: 0.5 }),
  testPlayer(1631110, 'Jeremy', 'Sochan', null, false, {}),
);

homePlayers.push(
  testPlayer(1630241, 'Sam', 'Merrill', null, false, { minutes: 'PT17M35.00S', points: 5, assists: 1, reboundsTotal: 1, reboundsOffensive: 1, steals: 0, foulsPersonal: 3, turnovers: 1, plusMinusPoints: -13, fieldGoalsMade: 2, fieldGoalsAttempted: 4, fieldGoalsPercentage: 0.5 }),
  testPlayer(1629731, 'Dean', 'Wade', null, false, { minutes: 'PT12M28.40S', assists: 1, reboundsTotal: 1, reboundsOffensive: 1, reboundsDefensive: 0, steals: 2, blocks: 1, plusMinusPoints: -14, fieldGoalsAttempted: 1 }),
  testPlayer(1642281, 'Jaylon', 'Tyson', null, false, { minutes: 'PT16M01.00S', points: 2, assists: 2, reboundsTotal: 3, reboundsOffensive: 1, reboundsDefensive: 2, steals: 1, foulsPersonal: 2, turnovers: 2, plusMinusPoints: -21, fieldGoalsMade: 1, fieldGoalsAttempted: 6, fieldGoalsPercentage: 0.166667 }),
  testPlayer(1631165, 'Keon', 'Ellis', null, false, { minutes: 'PT15M59.00S', points: 5, assists: 1, reboundsTotal: 2, reboundsDefensive: 2, steals: 1, foulsPersonal: 1, plusMinusPoints: -20, fieldGoalsMade: 1, fieldGoalsAttempted: 3, fieldGoalsPercentage: 0.333333 }),
  testPlayer(1628418, 'Thomas', 'Bryant', null, false, { minutes: 'PT08M37.00S', points: 10, reboundsTotal: 3, reboundsDefensive: 3, plusMinusPoints: -4, fieldGoalsMade: 4, fieldGoalsAttempted: 7, fieldGoalsPercentage: 0.571429 }),
  testPlayer(1641854, 'Craig', 'Porter Jr.', null, false, { minutes: 'PT08M37.00S', assists: 3, reboundsTotal: 1, reboundsDefensive: 1, foulsPersonal: 1, turnovers: 3, plusMinusPoints: -4 }),
  testPlayer(1642878, 'Tyrese', 'Proctor', null, false, { minutes: 'PT08M37.00S', assists: 2, reboundsTotal: 1, reboundsDefensive: 1, foulsPersonal: 1, turnovers: 1, plusMinusPoints: -4 }),
  testPlayer(1641772, 'NaeQwan', 'Tomlin', null, false, { minutes: 'PT06M53.00S', points: 2, assists: 1, reboundsTotal: 1, reboundsOffensive: 1, foulsPersonal: 1, plusMinusPoints: -2, fieldGoalsMade: 1, fieldGoalsAttempted: 2, fieldGoalsPercentage: 0.5 }),
  testPlayer(1626204, 'Larry', 'Nance Jr.', null, false, {}),
  testPlayer(203471, 'Dennis', 'Schroder', null, false, {}),
);

export const testBoxScore: BoxScoreResponse = {
  gameId: '0042500304',
  isAvailable: true,
  gameState: 'Final',
  startTimeUtc: '2026-05-26T00:00:00Z',
  startTimeEastern: '2026-05-26T00:00:00+00:00',
  gameCode: '20260525/NYKCLE',
  gameClock: 'PT00M00.00S',
  gameStatusText: 'Final',
  period: 4,
  arena: testGame.arena,
  visitor: {
    team: testGame.visitingTeam,
    score: 130,
    wins: 0,
    losses: 0,
    periods: [38, 30, 30, 32].map((score, index) => ({ period: index + 1, periodType: 'REGULAR', score })),
    players: visitorPlayers,
  },
  home: {
    team: testGame.homeTeam,
    score: 93,
    wins: 0,
    losses: 0,
    periods: [26, 23, 22, 22].map((score, index) => ({ period: index + 1, periodType: 'REGULAR', score })),
    players: homePlayers,
  },
  officials: [
    { name: 'Marc Davis', number: '8' },
    { name: 'Josh Tiven', number: '58' },
    { name: 'Kevin Scott', number: '24' },
    { name: 'Jacyn Goble', number: '68' },
  ],
};
