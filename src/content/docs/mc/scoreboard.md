---
title: "Scoreboard & Teams"
description: "Scoreboard objectives, scores, and player teams."
---

The scoreboard system tracks player statistics, displays scores, and manages teams. It's a C++ port of the Java Edition scoreboard. Most of the logic lives in headers, and the `.cpp` file has partially-stubbed implementations (methods are defined but their bodies are commented out, so it's still a work in progress).

**Key source files:** `Scoreboard.h/cpp`, `ServerScoreboard.h`, `Objective.h`, `ObjectiveCriteria.h`, `Score.h`, `ScoreHolder.h`, `PlayerTeam.h`, `Team.h`, `ScoreboardSaveData.h` (in `Minecraft.World/` and `Minecraft.Client/`).

## Scoreboard

The `Scoreboard` class is the central manager. It stores:

- **Objectives** in `unordered_map<wstring, Objective*> objectivesByName`
- **Objectives by criteria** in `unordered_map<ObjectiveCriteria*, vector<Objective*>*>`
- **Player scores** in `unordered_map<wstring, unordered_map<Objective*, Score*>>`
- **Display slots** in a fixed-size array of `Objective*` pointers
- **Teams by name** in `unordered_map<wstring, PlayerTeam*>`
- **Teams by player** in `unordered_map<wstring, PlayerTeam*>` (reverse lookup)

### Display slots

Three display slots are defined:

| Constant | Value | Slot name |
|---|---|---|
| `DISPLAY_SLOT_LIST` | 0 | `"list"` |
| `DISPLAY_SLOT_SIDEBAR` | 1 | `"sidebar"` |
| `DISPLAY_SLOT_BELOW_NAME` | 2 | `"belowName"` |

`getDisplaySlotName(int)` and `getDisplaySlotByName(wstring)` convert between integer and string representations.

### Objective management

- `addObjective(name, criteria)` creates an `Objective`, registers it by name and criteria, and fires `onObjectiveAdded`
- `getObjective(name)` looks up by name
- `findObjectiveFor(criteria)` finds all objectives using a given criteria
- `removeObjective(objective)` removes from all maps and display slots, fires `onObjectiveRemoved`
- `getObjectives()` returns all objectives

### Score management

- `getPlayerScore(playerName, objective)` retrieves or creates a score for a player-objective pair
- `getPlayerScores(objective)` returns all scores for an objective
- `getPlayerScores(playerName)` returns all scores for a player (map of objective to score)
- `getScores()` returns every score in the system
- `resetPlayerScore(playerName)` removes all scores for a player, fires `onPlayerRemoved`
- `getTrackedPlayers()` returns all player names that have scores

### Team management

- `addPlayerTeam(name)` creates a `PlayerTeam`, fires `onTeamAdded`
- `getPlayerTeam(name)` looks up by team name
- `addPlayerToTeam(player, team)` removes the player from any existing team first, then assigns them
- `removePlayerFromTeam(player)` removes from current team
- `removePlayerTeam(team)` removes a team and all its player-team mappings
- `getPlayersTeam(playerName)` returns which team a player belongs to
- `getTeamNames()` / `getPlayerTeams()` lists all teams

### Event hooks

The base `Scoreboard` class defines virtual callback methods that do nothing by default:

- `onObjectiveAdded` / `onObjectiveChanged` / `onObjectiveRemoved`
- `onScoreChanged`
- `onPlayerRemoved`
- `onTeamAdded` / `onTeamChanged` / `onTeamRemoved`

## Objective

An objective ties a name and display name to a criteria type.

| Field | Constraint |
|---|---|
| `name` | Max 16 characters |
| `displayName` | Max 32 characters |
| `criteria` | Pointer to an `ObjectiveCriteria` |
| `scoreboard` | Back-pointer to the owning `Scoreboard` |

## ObjectiveCriteria

Defines how a score is calculated. Four built-in criteria are registered in a static `CRITERIA_BY_NAME` map:

| Static instance | Purpose |
|---|---|
| `DUMMY` | Manual scores only, no auto-update |
| `DEATH_COUNT` | Number of deaths |
| `KILL_COUNT_PLAYERS` | Player kills |
| `KILL_COUNT_ALL` | Total kills (all entities) |
| `HEALTH` | Current health (read-only) |

Interface methods:

- `getName()` returns the string identifier for serialization
- `getScoreModifier(vector<shared_ptr<Player>>*)` computes an automatic score update
- `isReadOnly()` if true, the score can't be set manually (used by `HEALTH`)

## Score

Represents a single player's score for one objective:

- `owner`, the player name (wstring)
- `count`, the integer score value
- `objective`, which objective this belongs to
- `scoreboard`, a back-pointer for change notification

Methods:

- `add(int)` / `remove(int)` / `increment()` / `decrement()` adjust the count
- `setScore(int)` / `getScore()` for direct access
- `updateFor(vector<shared_ptr<Player>>*)` recalculates from criteria

:::note
The Java-style `SCORE_COMPARATOR` is defined in a `#if 0` block and has not been ported to C++.
:::

## ScoreHolder

A minimal interface with one method: `getScoreboard()`. It's meant for entities that participate in the scoreboard system.

## Team (abstract base)

The `Team` class defines the team interface:

- `getName()` returns the team identifier
- `getFormattedName(teamMemberName)` applies prefix/suffix formatting
- `canSeeFriendlyInvisibles()` whether teammates can see each other when invisible
- `isAllowFriendlyFire()` whether teammates can damage each other
- `isAlliedTo(Team*)` checks if two teams are the same (compares by pointer)

## PlayerTeam

Concrete team implementation with these properties:

| Property | Max length | Description |
|---|---|---|
| `name` | 16 chars | Internal team name |
| `displayName` | 32 chars | Shown in UI |
| `prefix` | 16 chars | Prepended to member names |
| `suffix` | 16 chars | Appended to member names |

Boolean options:

- `allowFriendlyFire` toggled via bit 0
- `seeFriendlyInvisibles` toggled via bit 1

The `packOptions()` and `unpackOptions(int)` methods serialize these booleans as a bitmask for network packets.

`getPlayers()` returns the `unordered_set<wstring>` of member names.

Static helpers `formatNameForTeam(PlayerTeam*)` and `formatNameForTeam(Team*, name)` apply the prefix/suffix wrapping.

## ServerScoreboard

`ServerScoreboard` extends `Scoreboard` on the server side (`Minecraft.Client/ServerScoreboard.h`). It adds:

- A reference to `MinecraftServer`
- A set of `trackedObjectives` for network synchronization
- A `ScoreboardSaveData` pointer for persistence

It overrides all event hooks to push changes to connected clients and mark save data as dirty. Key networking methods:

- `getStartTrackingPackets(Objective*)` builds the packet list to send when a client starts tracking an objective
- `getStopTrackingPackets(Objective*)` builds the packet list to send when tracking stops
- `startTrackingObjective(Objective*)` / `stopTrackingObjective(Objective*)` manage the tracked set
- `getObjectiveDisplaySlotCount(Objective*)` returns how many display slots reference this objective

## Scoreboard save data

`ScoreboardSaveData` (defined in a `#if 0` block as unconverted Java) shows the intended NBT format:

- **`"Objectives"`** list of `{Name, CriteriaName, DisplayName}`
- **`"PlayerScores"`** list of `{Name, Objective, Score}`
- **`"Teams"`** list of `{Name, DisplayName, Prefix, Suffix, AllowFriendlyFire, SeeFriendlyInvisibles, Players[]}`
- **`"DisplaySlots"`** compound mapping `"slot_0"` through `"slot_2"` to objective names

This save/load logic hasn't been ported to C++ yet and only exists as reference Java code.
