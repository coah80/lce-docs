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
- **Display slots** in a fixed-size array of `Objective*` pointers (size `DISPLAY_SLOTS = 3`)
- **Teams by name** in `unordered_map<wstring, PlayerTeam*>`
- **Teams by player** in `unordered_map<wstring, PlayerTeam*>` (reverse lookup)

### Display slots

Three display slots are defined:

| Constant | Value | Slot name | Where it shows |
|---|---|---|---|
| `DISPLAY_SLOT_LIST` | 0 | `"list"` | Tab player list |
| `DISPLAY_SLOT_SIDEBAR` | 1 | `"sidebar"` | Right side of the screen |
| `DISPLAY_SLOT_BELOW_NAME` | 2 | `"belowName"` | Under player nametags |

`getDisplaySlotName(int)` and `getDisplaySlotByName(wstring)` convert between integer and string representations. Both are static methods.

### Objective management

- `addObjective(name, criteria)` creates an `Objective`, registers it by name and criteria, and fires `onObjectiveAdded`
- `getObjective(name)` looks up by name
- `findObjectiveFor(criteria)` finds all objectives using a given criteria, returns a `vector<Objective*>*`
- `removeObjective(objective)` removes from all maps and display slots, fires `onObjectiveRemoved`
- `getObjectives()` returns all objectives as a `vector<Objective*>*`
- `setDisplayObjective(int slot, Objective*)` assigns an objective to a display slot
- `getDisplayObjective(int slot)` returns which objective is in a given display slot

### Score management

- `getPlayerScore(playerName, objective)` retrieves or creates a score for a player-objective pair
- `getPlayerScores(objective)` returns all scores for an objective as `vector<Score*>*`
- `getPlayerScores(playerName)` returns all scores for a player as `unordered_map<Objective*, Score*>*`
- `getScores()` returns every score in the system
- `resetPlayerScore(playerName)` removes all scores for a player, fires `onPlayerRemoved`
- `getTrackedPlayers()` returns all player names that have scores as `vector<wstring>*`
- `getPlayer(wstring)` returns a shared pointer to the actual `Player` object for a given name

### Team management

- `addPlayerTeam(name)` creates a `PlayerTeam`, fires `onTeamAdded`
- `getPlayerTeam(name)` looks up by team name
- `addPlayerToTeam(player, team)` removes the player from any existing team first, then assigns them
- `removePlayerFromTeam(player)` removes from current team (returns `bool` success)
- `removePlayerFromTeam(player, team)` removes from a specific team
- `removePlayerTeam(team)` removes a team and all its player-team mappings
- `getPlayersTeam(playerName)` returns which team a player belongs to
- `getTeamNames()` / `getPlayerTeams()` lists all teams

### Event hooks

The base `Scoreboard` class defines virtual callback methods that do nothing by default:

- `onObjectiveAdded` / `onObjectiveChanged` / `onObjectiveRemoved`
- `onScoreChanged`
- `onPlayerRemoved`
- `onTeamAdded` / `onTeamChanged` / `onTeamRemoved`

These are all public virtual methods, designed to be overridden by `ServerScoreboard`.

## Objective

An objective ties a name and display name to a criteria type.

| Field | Max length | Description |
|---|---|---|
| `name` | `MAX_NAME_LENGTH` (16 chars) | Internal identifier, used for commands and serialization |
| `displayName` | `MAX_DISPLAY_NAME_LENGTH` (32 chars) | Shown in the UI |
| `criteria` | -- | Pointer to an `ObjectiveCriteria` |
| `scoreboard` | -- | Back-pointer to the owning `Scoreboard` |

Constructor takes `(Scoreboard*, wstring name, ObjectiveCriteria*)`. Methods include `getScoreboard()`, `getName()`, `getCriteria()`, `getDisplayName()`, and `setDisplayName(wstring)`.

## ObjectiveCriteria

Defines how a score is calculated. Five built-in criteria are registered in a static `CRITERIA_BY_NAME` map (`unordered_map<wstring, ObjectiveCriteria*>`):

| Static instance | Criteria name | Purpose | Read-only? |
|---|---|---|---|
| `DUMMY` | `"dummy"` | Manual scores only, no auto-update | No |
| `DEATH_COUNT` | `"deathCount"` | Number of deaths | No |
| `KILL_COUNT_PLAYERS` | `"playerKillCount"` | Player kills | No |
| `KILL_COUNT_ALL` | `"totalKillCount"` | Total kills (all entities) | No |
| `HEALTH` | `"health"` | Current health | Yes |

Interface methods:

- `getName()` returns the string identifier for serialization
- `getScoreModifier(vector<shared_ptr<Player>>*)` computes an automatic score update
- `isReadOnly()` if true, the score can't be set manually (only `HEALTH` returns true)

The `DummyCriteria` class provides a concrete implementation (source files: `DummyCriteria.h/cpp`). The `HealthCriteria` class provides the health-specific implementation (`HealthCriteria.h/cpp`).

## Score

Represents a single player's score for one objective:

- `owner`, the player name (`wstring`)
- `count`, the integer score value
- `objective`, which objective this belongs to
- `scoreboard`, a back-pointer for change notification

Methods:

- `add(int)` / `remove(int)` / `increment()` / `decrement()` adjust the count
- `setScore(int)` / `getScore()` for direct access
- `getObjective()` / `getOwner()` / `getScoreboard()` for field access
- `updateFor(vector<shared_ptr<Player>>*)` recalculates from criteria

:::note
The Java-style `SCORE_COMPARATOR` is defined in a `#if 0` block and has not been ported to C++. It would provide sorting of scores for display purposes.
:::

## ScoreHolder

A minimal interface with one method: `getScoreboard()`. It returns a `Scoreboard*` and is meant for entities that participate in the scoreboard system.

## Team (abstract base)

The `Team` class defines the team interface:

- `getName()` returns the team identifier
- `getFormattedName(teamMemberName)` applies prefix/suffix formatting
- `canSeeFriendlyInvisibles()` whether teammates can see each other when invisible
- `isAllowFriendlyFire()` whether teammates can damage each other
- `isAlliedTo(Team*)` checks if two teams are the same (compares by pointer)

All methods except `isAlliedTo` are pure virtual.

## PlayerTeam

Concrete team implementation with these properties:

| Property | Max length | Constant | Description |
|---|---|---|---|
| `name` | 16 chars | `MAX_NAME_LENGTH` | Internal team name |
| `displayName` | 32 chars | `MAX_DISPLAY_NAME_LENGTH` | Shown in UI |
| `prefix` | 16 chars | `MAX_PREFIX_LENGTH` | Prepended to member names |
| `suffix` | 16 chars | `MAX_SUFFIX_LENGTH` | Appended to member names |

Boolean options:

| Option | Bit position | Constant | Default |
|---|---|---|---|
| `allowFriendlyFire` | Bit 0 | `BIT_FRIENDLY_FIRE` | -- |
| `seeFriendlyInvisibles` | Bit 1 | `BIT_SEE_INVISIBLES` | -- |

The `packOptions()` and `unpackOptions(int)` methods serialize these booleans as a bitmask for network packets.

Player members are stored in an `unordered_set<wstring>`. `getPlayers()` returns a pointer to this set.

Static helpers:

- `formatNameForTeam(PlayerTeam*)` formats the team name itself
- `formatNameForTeam(Team*, wstring name)` applies the prefix/suffix wrapping to a player name

Full method list includes `getScoreboard()`, `getName()`, `getDisplayName()`, `setDisplayName()`, `getPlayers()`, `getPrefix()`, `setPrefix()`, `getSuffix()`, `setSuffix()`, `getFormattedName()`, `isAllowFriendlyFire()`, `setAllowFriendlyFire()`, `canSeeFriendlyInvisibles()`, `setSeeFriendlyInvisibles()`, `packOptions()`, `unpackOptions()`.

## ServerScoreboard

`ServerScoreboard` extends `Scoreboard` on the server side (`Minecraft.Client/ServerScoreboard.h`). It adds:

- A `MinecraftServer*` reference
- A set of `trackedObjectives` (`unordered_set<Objective*>`) for network synchronization
- A `ScoreboardSaveData*` pointer for persistence

It overrides all event hooks to push changes to connected clients and mark save data as dirty. Key networking methods:

- `getStartTrackingPackets(Objective*)` builds the packet list (`vector<shared_ptr<Packet>>*`) to send when a client starts tracking an objective
- `getStopTrackingPackets(Objective*)` builds the packet list to send when tracking stops
- `startTrackingObjective(Objective*)` / `stopTrackingObjective(Objective*)` manage the tracked set
- `getObjectiveDisplaySlotCount(Objective*)` returns how many display slots reference this objective
- `setDirty()` marks the save data as needing a write (protected)
- `setSaveData(ScoreboardSaveData*)` sets the persistence handler
- `getServer()` returns the `MinecraftServer*`

The overridden methods `setDisplayObjective`, `addPlayerToTeam`, and `removePlayerFromTeam` take the same signatures as the base class but add network packet broadcasting.

## Scoreboard save data

`ScoreboardSaveData` (defined in a `#if 0` block as unconverted Java) shows the intended NBT format. The `FILE_ID` is `"scoreboard"`.

### NBT structure

**Objectives list** (`"Objectives"`):

| Tag | Type | Purpose |
|---|---|---|
| `"Name"` | String | Internal objective name |
| `"CriteriaName"` | String | Criteria type identifier |
| `"DisplayName"` | String | Displayed name |

**Player scores list** (`"PlayerScores"`):

| Tag | Type | Purpose |
|---|---|---|
| `"Name"` | String | Player name |
| `"Objective"` | String | Objective name |
| `"Score"` | Int | Score value |

**Teams list** (`"Teams"`):

| Tag | Type | Purpose |
|---|---|---|
| `"Name"` | String | Team name |
| `"DisplayName"` | String | Displayed team name |
| `"Prefix"` | String | Name prefix |
| `"Suffix"` | String | Name suffix |
| `"AllowFriendlyFire"` | Boolean | Friendly fire toggle |
| `"SeeFriendlyInvisibles"` | Boolean | Invisible teammate visibility |
| `"Players"` | String list | Team member names |

**Display slots** (`"DisplaySlots"`):

A compound mapping `"slot_0"` through `"slot_2"` to objective names. Only written if at least one slot has an objective assigned.

### Load/save behavior

The Java reference shows a `delayLoad` pattern: if the scoreboard reference isn't set when `load()` is called, the data is stashed and loaded later when `setScoreboard()` is called. On save, a warning is logged if no scoreboard is available.

This save/load logic hasn't been ported to C++ yet and only exists as reference Java code inside a `#if 0` block.

## Differences from LCEMP

LCEMP does not have any scoreboard implementation. The `Scoreboard`, `Objective`, `ObjectiveCriteria`, `Score`, `PlayerTeam`, `Team`, `ScoreHolder`, `ServerScoreboard`, and `ScoreboardSaveData` classes are all exclusive to MinecraftConsoles.
