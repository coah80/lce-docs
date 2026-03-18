---
title: Leaderboards
description: The LeaderboardManager system for tracking and displaying player stats across sessions.
---

LCE has a leaderboard system that tracks persistent player statistics across play sessions. Each platform has its own leaderboard manager implementation that plugs into the platform's native stats service (Xbox Live, PSN, etc.). This page covers the shared architecture and what stats are tracked.

## LeaderboardManager

**File**: `Common/Leaderboards/LeaderboardManager.h`

The `LeaderboardManager` is the shared base class. Each platform provides a concrete implementation:

| Platform | Class | File |
|---|---|---|
| Xbox 360 | `XboxLeaderboardManager` | `Xbox/Leaderboards/XboxLeaderboardManager.h` |
| Xbox One | `DurangoLeaderboardManager` | `Durango/Leaderboards/DurangoLeaderboardManager.h` |
| PS3 | `PS3LeaderboardManager` | `PS3/Leaderboards/PS3LeaderboardManager.h` |
| PS4 | `OrbisLeaderboardManager` | `Orbis/Leaderboards/OrbisLeaderboardManager.h` |
| PS Vita | `PSVitaLeaderboardManager` | `PSVita/Leaderboards/PSVitaLeaderboardManager.h` |
| Windows 64 | `WindowsLeaderboardManager` | `Windows64/Leaderboards/WindowsLeaderboardManager.h` |

The manager follows a singleton pattern and is accessed through the `ProfileManager`.

## Stats Categories

The leaderboard system tracks four categories of statistics, each with individual stat types and a composite rating:

### Kills (7 stats + rating)

Tracks how many of each mob type the player has killed:

| Stat | What it counts |
|---|---|
| Zombies killed | Zombie kills |
| Skeletons killed | Skeleton kills |
| Spiders killed | Spider kills |
| Creepers killed | Creeper kills |
| Endermen killed | Enderman kills |
| Slimes killed | Slime kills |
| Ghasts killed | Ghast kills |
| **Kills Rating** | Composite score from all kill stats |

### Mining (7 stats + rating)

Tracks blocks mined by type:

| Stat | What it counts |
|---|---|
| Stone mined | Stone blocks broken |
| Dirt mined | Dirt blocks broken |
| Wood mined | Log blocks broken |
| Coal mined | Coal ore mined |
| Iron mined | Iron ore mined |
| Gold mined | Gold ore mined |
| Diamond mined | Diamond ore mined |
| **Mining Rating** | Composite score from all mining stats |

### Farming (6 stats + rating)

Tracks farming and animal-related activities:

| Stat | What it counts |
|---|---|
| Wheat grown | Wheat crops harvested |
| Bread made | Bread items crafted |
| Pigs bred | Pig breeding events |
| Cows bred | Cow breeding events |
| Chickens bred | Chicken breeding events |
| Fish caught | Fish caught while fishing |
| **Farming Rating** | Composite score from all farming stats |

### Travelling (4 stats + rating)

Tracks distance moved by method:

| Stat | What it counts |
|---|---|
| Distance walked | Blocks walked on foot |
| Distance swum | Blocks traveled while swimming |
| Distance by minecart | Blocks traveled in a minecart |
| Distance by boat | Blocks traveled in a boat |
| **Travelling Rating** | Composite score from all distance stats |

## Filter Modes

When viewing leaderboards, the player can filter the results:

| Mode | What it shows |
|---|---|
| `Friends` | Only scores from friends |
| `MyScore` | The player's own score with nearby rankings |
| `TopRank` | Global top rankings |

## Session Management

The leaderboard system uses sessions to batch stat updates:

| Method | What it does |
|---|---|
| `OpenSession()` | Starts a new stat recording session |
| `CloseSession()` | Ends the current session and submits stats |
| `DeleteSession()` | Discards the current session without submitting |

Stats are accumulated during gameplay and only written to the platform's leaderboard service when the session closes. This avoids constant network traffic during play.

## ReadScore Struct

The `ReadScore` struct holds a single leaderboard entry when reading scores back from the platform:

| Field | Type | What it holds |
|---|---|---|
| `rank` | int | Player's position on the leaderboard |
| `name` | wstring | Player's display name |
| `totalScore` | int | The composite score for this category |
| `statsData` | array | Individual stat values within the category |

## Platform Differences

### Xbox (360 and One)

Xbox uses `XSESSION_VIEW_PROPERTIES` for the native view/write types. The leaderboard data maps directly to Xbox Live's stat service. Xbox One's `DurangoLeaderboardManager` also includes a `DurangoStatsDebugger` for testing stat submissions.

Xbox One additionally has a `GameProgress` system in the leaderboards directory that tracks overall game completion.

### PlayStation (PS3, PS4, Vita)

Sony platforms use custom `ViewIn`/`ViewOut` structs instead of Xbox's session properties. The leaderboard data is submitted through PSN's ranking service. All three Sony platforms share a similar structure but have their own manager implementations to handle SDK differences.

### Windows 64

`WindowsLeaderboardManager` provides a local-only implementation. Since there's no online service for the PC build, stats are tracked locally but not submitted anywhere.

## Leaderboard UI

The leaderboard display is handled by `UIScene_LeaderboardsMenu` (in `Common/UI/`) and `UIControl_LeaderboardList`. The menu lets the player:

- Switch between the four stat categories (Kills, Mining, Farming, Travelling)
- Toggle filter modes (Friends, MyScore, TopRank)
- Scroll through entries
- See their own ranking highlighted

## Key Files

| File | What it does |
|---|---|
| `Common/Leaderboards/LeaderboardManager.h` | Base class with stat categories and session API |
| `Common/Leaderboards/LeaderboardManager.cpp` | Shared implementation |
| `Xbox/Leaderboards/XboxLeaderboardManager.h` | Xbox 360 Xbox Live integration |
| `Durango/Leaderboards/DurangoLeaderboardManager.h` | Xbox One Xbox Live integration |
| `PS3/Leaderboards/PS3LeaderboardManager.h` | PS3 PSN integration |
| `Orbis/Leaderboards/OrbisLeaderboardManager.h` | PS4 PSN integration |
| `PSVita/Leaderboards/PSVitaLeaderboardManager.h` | PS Vita PSN integration |
| `Windows64/Leaderboards/WindowsLeaderboardManager.h` | Local-only stats tracking |
| `Common/UI/UIScene_LeaderboardsMenu.h` | Leaderboard display UI |
| `Common/UI/UIControl_LeaderboardList.h` | Scrollable leaderboard list control |
