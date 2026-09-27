# CavsBot

CavsBot is a Cleveland Cavaliers game-thread application for Reddit, built with Devvit. It creates and maintains a complete game-day conversation around each Cavaliers matchup: a pregame discussion, a live game thread, a post-game discussion, and a next-day recap. Each thread combines a Reddit-native fallback post with an interactive web view so the conversation remains useful even when the embedded client is unavailable.

The application is designed for a Cavaliers community rather than as a generic sports scoreboard. It understands Cleveland's home and road context, season type, Eastern Time scheduling, opponent history, game state, and the difference between a preview, a live game, and a completed game. During a game it refreshes the score and data automatically; after the final whistle it preserves the box score, play-by-play, game story, and win-probability timeline for discussion and analysis.

## Features

### Automated Reddit threads

CavsBot checks the Cavaliers schedule every five minutes and creates the appropriate thread without duplicate posts:

- **Game Day Thread**: created on game day for predictions, matchups, breakout candidates, rotations, coaching decisions, and keys to the game.
- **Live Game Thread**: created up to two hours before tip-off and refreshed throughout the game.
- **Post-Game Discussion**: created after a completed game with final scores, a full box score, and discussion prompts.
- **Next-Day Discussion**: created the following morning for performances, adjustments, and takeaways.

Threads are titled with the matchup, season type, and Eastern Time game date. Automated threads are marked as announcements, sticky-posted, and configured to sort comments by new.

### Live game center

The embedded game view provides a responsive game center inside Reddit with:

- Cleveland and opponent logos, records, home/away labels, and matchup context.
- Live score, game status, period scores, total score, and game clock.
- Automatic refresh behavior for active game threads.
- Loading states while data is being fetched and graceful empty states when a feed is not yet available.
- Responsive layouts for desktop and narrow mobile screens.

### Complete box scores

Completed and in-progress games include team-by-team player tables with:

- Points, rebounds, assists, steals, blocks, personal fouls, turnovers, and plus/minus.
- Field-goal, three-point, and free-throw makes, attempts, and percentages.
- Starter/bench role, position, player name, and minutes.
- Quarter and overtime scoring totals.
- Arena, location, attendance, game status, game clock, and officials.

The post text fallback also includes a Markdown box score so important information remains readable in old Reddit, feeds, accessibility contexts, or clients that do not render the web view.

### Play-by-play and game analysis

The game view includes a scrollable, virtualized play-by-play table with team logos, period, clock, home score, away score, and event description. The analysis area derives additional game context from the available events and box score:

- Largest lead.
- Lead changes.
- Periods played.
- Clutch-moment highlights.
- Points, rebounds, and assists leaders for both teams.
- Field-goal, three-point, and free-throw shooting comparisons.
- Quarter-by-quarter scoring story.

### Live insights and recap data

The Live Insights section changes based on game state. Pregame threads show a game preview; live threads show live insights; post-game and next-day threads show a game recap. The section can display:

- Recent Cavaliers schedule and form.
- The last ten meetings between Cleveland and the opponent.
- Cavaliers head-to-head record, meeting count, home/road split, and most recent matchup.
- Eastern Conference standings.
- Team records.
- Four-factor comparisons for Cleveland and the opponent.

### Win-probability timeline

Live and completed game threads include an interactive Cavaliers win-probability graph at the bottom of Live Insights/Game Recap. The graph:

- Uses the Cleveland probability regardless of whether the Cavaliers are home or away.
- Shows a fixed 0% to 100% vertical scale.
- Labels the beginning and end of the match, or the current point for an active game.
- Supports mouse hover and touch/pointer selection to inspect the nearest sample.
- Displays the selected probability, quarter, and game clock.
- Fits the available width on mobile without requiring horizontal scrolling.

When historical probability data is unavailable, the application can use fixture/play-by-play data.

### Season-aware sidebar and widgets

The scheduled sidebar refresh identifies the current Cavaliers season phase across preseason, regular season, and postseason data. It updates:

- A schedule widget with Eastern Time dates, opponents, home/road markers, and tip-off times.
- An Eastern Conference standings widget with wins, losses, win percentage, and games behind.
- A classic Markdown sidebar fallback containing schedule, standings, community links, Cavaliers resources, and the last update time.

The app updates existing `Schedule` and `Standings` widgets when present.

### Moderator tools

Moderators receive Reddit subreddit and post menu actions for operational control:

- **Create a new post**: creates a general Cavaliers community discussion post.
- **Refresh CavsBot sidebar**: immediately rebuilds the schedule, standings, and widgets.
- **Clear thread Redis cache**: invalidates the selected thread's core and insight caches.
- **TEST: Create game thread**
- **TEST: Create game day thread**
- **TEST: Create next day thread**
- **TEST: Create post game thread**

The test actions use the fixture game `0042500304` and navigate the moderator to the generated Reddit post. They are intended to verify rendering, fallbacks, box scores, play-by-play, insights, and the probability graph without waiting for a live NBA game.