---
title: Player Limit
description: The current player limit, network constraints, entity tracking, and what breaks when you increase it.
---

Legacy Console Edition supports up to 8 players in a multiplayer game. On PS Vita, it's 4. This limit is baked in deep across every layer of the codebase. Here's the full picture of where it shows up, what it controls, and what happens when you try to change it.

## The Constant

The max player count is defined per-platform in the network headers. The main definition lives in `extraX64.h` (for the x64 build) and `extra.h` (for Xbox 360):

```cpp
// Minecraft.World/x64headers/extraX64.h
#ifdef __PSVITA__
const int MINECRAFT_NET_MAX_PLAYERS = 4;
#else
const int MINECRAFT_NET_MAX_PLAYERS = 8;
#endif

// Xbox/Network/extra.h (Xbox 360 build)
const int MINECRAFT_NET_MAX_PLAYERS = 8;
```

PS Vita gets 4 because it only supports 1 local user (`XUSER_MAX_COUNT = 1`) and the hardware can't handle more network traffic. Every other platform gets 8.

This constant appears in over 70 locations across both `Minecraft.Client` and `Minecraft.World`. It's used for array sizes, loop bounds, validation checks, network packet fields, session advertising, QNet small ID allocation, UI screen layouts, and voice chat buffers. It is not a config value you can just change in one place.

## How Players Connect

When a player tries to join, `PlayerList` handles the connection. The max player count gets clamped right in the constructor:

```cpp
// PlayerList.cpp - constructor (MinecraftConsoles build)
int rawMax = server->settings->getInt(L"max-players", 8);
maxPlayers = static_cast<unsigned int>(
    Mth::clamp(rawMax, 1, MINECRAFT_NET_MAX_PLAYERS)
);
```

In the LCEMP build, it's even simpler. The settings check is gone:

```cpp
// PlayerList.cpp - constructor (LCEMP build)
maxPlayers = MINECRAFT_NET_MAX_PLAYERS;
```

Even if you set `max-players` to 16 in the server settings, it gets capped at 8.

### Player Index Assignment

When someone connects, they get a player index from 0 to `MINECRAFT_NET_MAX_PLAYERS - 1`. The system uses a fixed-size boolean array to find the first free slot:

```cpp
// PlayerList.cpp - placeNewPlayer()
DWORD playerIndex = (DWORD)MINECRAFT_NET_MAX_PLAYERS;
{
    bool usedIndexes[MINECRAFT_NET_MAX_PLAYERS];
    ZeroMemory(&usedIndexes, MINECRAFT_NET_MAX_PLAYERS * sizeof(bool));
    for (auto& p : players)
    {
        usedIndexes[p->getPlayerIndex()] = true;
    }
    for (unsigned int i = 0; i < MINECRAFT_NET_MAX_PLAYERS; ++i)
    {
        if (!usedIndexes[i])
        {
            playerIndex = i;
            break;
        }
    }
}
if (playerIndex >= static_cast<unsigned int>(MINECRAFT_NET_MAX_PLAYERS))
{
    connection->send(
        std::make_shared<DisconnectPacket>(DisconnectPacket::eDisconnect_ServerFull)
    );
    connection->sendAndQuit();
}
```

If all slots are taken, the player gets a "server full" disconnect. There's also an early check before the index assignment even runs:

```cpp
// PlayerList.cpp - getPlayerForLogin()
if (players.size() >= (unsigned int)MINECRAFT_NET_MAX_PLAYERS)
{
    pendingConnection->disconnect(DisconnectPacket::eDisconnect_ServerFull);
    return shared_ptr<ServerPlayer>();
}
```

### The Login Packet

The login packet sent back to the joining player includes the max player count. But it's encoded as a single byte:

```cpp
// PlayerList.cpp - placeNewPlayer()
int maxPlayersForPacket = getMaxPlayers() > 255 ? 255 : getMaxPlayers();
// ...
static_cast<byte>(maxPlayersForPacket),
```

So the wire format technically caps at 255, but `MINECRAFT_NET_MAX_PLAYERS` caps you at 8 way before that matters.

## Every Fixed-Size Array

This is the part that makes increasing the limit painful. The constant sizes arrays all over the codebase. Here's the complete list.

### Core Application Arrays

```cpp
// Consoles_App.h
BYTE m_playerColours[MINECRAFT_NET_MAX_PLAYERS];
unsigned int m_playerGamePrivileges[MINECRAFT_NET_MAX_PLAYERS];
```

`m_playerColours` maps QNet small IDs to player color indexes. `m_playerGamePrivileges` stores per-player permission flags. Both are indexed by player index. Overflow here means you're writing past the end of these arrays into whatever memory comes after them in the `Consoles_App` object.

### Session Data Arrays

The `GameSessionData` struct (used for session advertising and discovery) has per-player arrays on every platform:

```cpp
// SessionInfo.h - Xbox build
GameSessionUID players[MINECRAFT_NET_MAX_PLAYERS];    // 64 bytes (8*8) on Xbox
char szPlayers[MINECRAFT_NET_MAX_PLAYERS][XUSER_NAME_SIZE]; // 128 bytes (8*16)
```

```cpp
// SessionInfo.h - PS3/PS4/Vita build
GameSessionUID players[MINECRAFT_NET_MAX_PLAYERS];    // 192 bytes (24*8) on PS3
```

```cpp
// SessionInfo.h - x64/LAN build
GameSessionUID players[MINECRAFT_NET_MAX_PLAYERS];
char szPlayers[MINECRAFT_NET_MAX_PLAYERS][XUSER_NAME_SIZE];
unsigned char maxPlayers;  // also stored as a byte here
```

The x64 LAN build also stores `maxPlayers` as a `unsigned char` inside the struct. This gets set to `MINECRAFT_NET_MAX_PLAYERS` in the constructor. It's broadcast over the network during LAN discovery, so other clients use it to decide if the game is full.

### UI Screen Arrays

Multiple UI screens have their own per-player arrays:

```cpp
// UIScene_TeleportMenu.h
BYTE m_players[MINECRAFT_NET_MAX_PLAYERS];
char m_playersVoiceState[MINECRAFT_NET_MAX_PLAYERS];
short m_playersColourState[MINECRAFT_NET_MAX_PLAYERS];
wstring m_playerNames[MINECRAFT_NET_MAX_PLAYERS];
```

```cpp
// UIScene_InGameInfoMenu.h (LCEMP build)
BYTE m_players[MINECRAFT_NET_MAX_PLAYERS];
char m_playersVoiceState[MINECRAFT_NET_MAX_PLAYERS];
short m_playersColourState[MINECRAFT_NET_MAX_PLAYERS];
wstring m_playerNames[MINECRAFT_NET_MAX_PLAYERS];
```

```cpp
// XUI_InGameInfo.h (Xbox XUI build)
BYTE m_players[MINECRAFT_NET_MAX_PLAYERS];
```

```cpp
// XUI_Teleport.h (Xbox XUI build)
BYTE m_players[MINECRAFT_NET_MAX_PLAYERS];
```

These arrays store the player list as QNet small IDs along with their voice state, nametag color, and display name. The teleport menu uses them to show the list of players you can teleport to. The in-game info menu shows the online player list overlay.

### Renderer Arrays

```cpp
// PlayerRenderer.h
static unsigned int s_nametagColors[MINECRAFT_NET_MAX_PLAYERS];
```

This array stores the ARGB color for each player's nametag. The first 8 are hardcoded to specific colors (black, green, red, blue, magenta, orange, yellow, cyan). Indexes 8 and above use procedurally generated colors via HSV:

```cpp
// PlayerRenderer.cpp
for (int i = 8; i < MINECRAFT_NET_MAX_PLAYERS; i++)
{
    float hue = fmodf(i * 137.508f, 360.0f);
    float sat = 0.65f + (float)(i % 3) * 0.15f;
    float val = 0.75f + (float)(i % 4) * 0.08f;
    s_nametagColors[i] = HsvToArgb(hue, sat, val);
}
```

The color lookup does a bounds check:

```cpp
if (index >= 0 && index < MINECRAFT_NET_MAX_PLAYERS)
    return s_nametagColors[index];
return 0xFF000000; // fallback to black
```

If you increase the constant but forget this array, any player with an index past the old size reads garbage memory for their nametag color.

### QNet Player Array

The QNet abstraction layer (used on x64 builds) allocates a static array of player objects:

```cpp
// Extrax64Stubs.cpp
IQNetPlayer IQNet::m_player[MINECRAFT_NET_MAX_PLAYERS];
```

This is the core player tracking array for the network layer. Every QNet function that looks up a player by index or small ID checks against `MINECRAFT_NET_MAX_PLAYERS`:

```cpp
if (dwUserIndex >= MINECRAFT_NET_MAX_PLAYERS) return E_FAIL;
```

```cpp
if (SmallId >= MINECRAFT_NET_MAX_PLAYERS) return NULL;
```

### PendingConnection Arrays

When a player is joining and the server needs to check UGC (user-generated content) permissions, it allocates a temporary array:

```cpp
// PendingConnection.cpp
PlayerUID *ugcXuids = new PlayerUID[MINECRAFT_NET_MAX_PLAYERS];
```

This is heap-allocated so it won't overflow the same way, but it still only has room for `MINECRAFT_NET_MAX_PLAYERS` entries.

### Player Data Migration

The save system uses the constant when migrating old player data files:

```cpp
// DirectoryLevelStorage.cpp
for (int i = 0; i < MINECRAFT_NET_MAX_PLAYERS; i++)
{
    PlayerUID oldXuid = WIN64_XUID_BASE + i;
    tag = loadPlayerDataTag(oldXuid);
    // ...
}
```

This loop tries old-style XUIDs (sequential from a base value) to find existing player data that needs migration. If you increase the constant, this loop runs more iterations but that's harmless. It just takes slightly longer.

## Complete Usage Breakdown

Here's every category of usage and the count:

| Category | Count | Risk if you miss it |
|---|---|---|
| Fixed-size arrays (stack/static) | 18 | Memory corruption, crashes |
| Loop bounds | 22 | Wrong iteration count, missed players |
| Bounds checks / validation | 12 | Out-of-bounds access, security |
| Function default parameters | 14 | Wrong slot counts passed to platform APIs |
| Assignments / comparisons | 6 | Wrong limits enforced |

**Total: ~72 locations** across both `Minecraft.Client` and `Minecraft.World`.

## QNet Small ID Allocation

On the x64 LAN build, the server assigns "small IDs" (0 through `MINECRAFT_NET_MAX_PLAYERS - 1`) to each connecting client. This happens in the Winsock network layer:

```cpp
// WinsockNetLayer.cpp
BYTE assignedSmallId;
EnterCriticalSection(&s_freeSmallIdLock);
if (!s_freeSmallIds.empty())
{
    assignedSmallId = s_freeSmallIds.back();
    s_freeSmallIds.pop_back();
}
else if (s_nextSmallId < MINECRAFT_NET_MAX_PLAYERS)
{
    assignedSmallId = s_nextSmallId++;
}
else
{
    LeaveCriticalSection(&s_freeSmallIdLock);
    app.DebugPrintf("Win64 LAN: Server full, rejecting connection\n");
    closesocket(clientSocket);
    continue;
}
LeaveCriticalSection(&s_freeSmallIdLock);
```

The small ID is sent to the client as a single byte. When a player disconnects, their small ID goes back into the `s_freeSmallIds` pool for reuse. The key constraint: small IDs are used as indexes into `IQNet::m_player[]`, which is sized to `MINECRAFT_NET_MAX_PLAYERS`. If the small ID is >= the array size, everything downstream breaks.

The LAN broadcast also advertises the max players:

```cpp
// WinsockNetLayer.cpp
s_advertiseData.maxPlayers = MINECRAFT_NET_MAX_PLAYERS;
```

Clients see this in the server browser and use it to show "X/8 players" in the game list.

## Platform Network Layer Limits

The game's player limit isn't the only one. Each platform's network API has its own session size constraints.

### Xbox 360 / Xbox One

The `HostGame` function passes `MINECRAFT_NET_MAX_PLAYERS` as the `publicSlots` parameter to the platform session API:

```cpp
// PlatformNetworkManagerXbox.h
virtual void HostGame(
    int localUsersMask,
    bool bOnlineGame,
    bool bIsPrivate,
    unsigned char publicSlots = MINECRAFT_NET_MAX_PLAYERS,
    unsigned char privateSlots = 0
);
```

Xbox Live sessions have their own maximum that's configured in the game's service config. If you increase the game constant but don't update the Xbox Live service config, the platform will reject sessions larger than what it expects.

### PlayStation (PS3, PS4, Vita)

Sony's SQR network manager defines its own constant:

```cpp
// SQRNetworkManager.h
static const int MAX_ONLINE_PLAYER_COUNT = MINECRAFT_NET_MAX_PLAYERS;
```

This gets used throughout the Sony network stack. PSN room sizes are configured when creating the network room, and Sony's AVC2 voice chat API has its own limit:

```cpp
// SonyVoiceChat.h
#define AVC2_PARAM_DEFAULT_MAX_PLAYERS  (8)
#define AVC2_PARAM_DEFAULT_MAX_SPEAKERS (4)
```

Note that `AVC2_PARAM_DEFAULT_MAX_PLAYERS` is a separate `#define` set to 8. It does not use `MINECRAFT_NET_MAX_PLAYERS`. If you change the game constant, voice chat still caps at 8 participants unless you also change this define and the PSN room configuration.

### Splitscreen

Local splitscreen supports up to `XUSER_MAX_COUNT` players:

```cpp
// extraX64.h
#ifdef __PSVITA__
const int XUSER_MAX_COUNT = 1;   // Vita: no splitscreen
#else
const int XUSER_MAX_COUNT = 4;   // Everyone else: 4 local players
#endif
```

Splitscreen players and network players share the same `MINECRAFT_NET_MAX_PLAYERS` pool. With 4 local splitscreen players on Xbox, you only have 4 slots left for network players. The UI code that lists "all players in the game" iterates over the same arrays.

## Bandwidth Estimates

The server broadcasts entity updates to all players in range. Here's a rough estimate of the per-tick network cost based on the entity tracking system.

### Per-Player Costs

Each connected player is a tracked entity. The entity tracker sends these packets:

| Packet type | Size (bytes) | When |
|---|---|---|
| MoveEntityPacketSmall | 8 | Every tick the player moves (bit-packed delta) |
| MoveEntityPacket | 18 | When delta exceeds small packet range |
| MoveEntityPacketPosRot | 22 | Every 400 ticks (full position resync) |
| RotateHeadPacket | 6 | When head rotation changes |
| SetEntityMotionPacket | 10 | When velocity changes |
| SetEntityDataPacket | varies (20-80) | When metadata changes (health, armor, held item) |

### Scaling Math

At 20 TPS with 8 players, assume each player moves every tick (worst case):

- **8 players, all moving:** 8 players * 8 bytes * 20 ticks = **1,280 bytes/sec** just for position updates
- **Plus metadata, rotation, velocity:** roughly 3x the position data = **~3,840 bytes/sec**
- **Each player receives updates for all other players in range:** 7 other players * 3,840 = **~26,880 bytes/sec per client**

With 16 players:

- **15 other players per client:** 15 * 3,840 = **~57,600 bytes/sec per client**
- **Server total outbound:** 16 clients * 57,600 = **~921,600 bytes/sec** (~900 KB/s)

That doesn't include chunk data, block updates, tile entity updates, item drops, mob positions, or any other traffic. The real number with a busy world is significantly higher.

For reference, Xbox 360 games typically had about 256 Kbps (32 KB/s) of guaranteed bandwidth per peer in Xbox Live sessions. 8 players is already pushing it. 16 players would require a fundamentally different network architecture.

### Entity Tracking Ranges

The tracking range determines how far away a player can be and still receive updates. More players in range means more packets:

| Entity type | Range (blocks) | Update interval (ticks) |
|---|---|---|
| Players | 512 | 2 |
| Mobs | 80 | 3 |
| Items | 64 | 20 |
| Arrows/projectiles | 64 | 20 |
| TNT | 160 | 10 |
| Falling blocks | 160 | 20 |

Players have the largest tracking range (512 blocks) and the most frequent update interval (every 2 ticks). In a small world, all 8 players are almost always within tracking range of each other. Doubling the player count roughly quadruples the player-to-player tracking work (each of 16 players tracks 15 others vs each of 8 tracking 7).

## Voice Chat Sizing

The voice chat system has separate limits per platform:

**PS3 (AVC2 API):** Hardcoded to `AVC2_PARAM_DEFAULT_MAX_PLAYERS = 8` with `AVC2_PARAM_DEFAULT_MAX_SPEAKERS = 4`. The AVC2 library allocates audio buffers per participant. It operates through a state machine (init, load, join, session processing, leave, unload) and tracks talking status per room member in an `unordered_map`.

**PS4 (Party Voice):** Uses the party system API (`SonyVoiceChatParty_Orbis`) instead of in-game voice. The party size is controlled by Sony's platform, not the game.

**PS Vita:** Has its own voice chat implementation but the game only supports 4 players total anyway.

**Xbox 360/One:** Voice chat goes through Xbox Live party chat. The game checks `IsTalking()` and `IsMutedByLocalUser()` per QNet player, but the actual voice routing is handled by the platform.

**x64/LAN build:** Voice chat stubs return false for everything. No actual voice chat in LAN mode.

## Save File Impact

Player data is saved per player in the world save. The save system iterates over player files:

```cpp
// DirectoryLevelStorage.cpp
for (int i = 0; i < MINECRAFT_NET_MAX_PLAYERS; i++)
{
    PlayerUID oldXuid = WIN64_XUID_BASE + i;
    tag = loadPlayerDataTag(oldXuid);
    // ...
}
```

Each player's save data includes inventory, position, health, and other state. With 8 players, that's 8 `.dat` files. With 16, it's 16. On consoles with tight storage limits (especially Vita with its small memory card), this adds up.

The `PlayerList` also maintains per-dimension tracking lists:

```cpp
// PlayerList.h
vector<shared_ptr<ServerPlayer>> receiveAllPlayers[3];
```

These are dynamic vectors, not fixed arrays, so they grow as needed. But each entry means more broadcast targets per packet send.

## UI Screens That Use the Limit

Every UI screen that shows a player list iterates up to `MINECRAFT_NET_MAX_PLAYERS`. If you increase the limit, these screens need wider layouts or scrolling:

| Screen | What it does with the constant |
|---|---|
| `UIScene_TeleportMenu` | Lists players you can teleport to. 4 arrays sized to the limit. |
| `UIScene_InGameInfoMenu` | Shows online players overlay. 4 arrays sized to the limit. |
| `UIScene_JoinMenu` | Shows players in a session you're joining. 5 loops bounded by the limit. |
| `XUI_InGameInfo` | Xbox XUI version of the player overlay. 1 array sized to the limit. |
| `XUI_Teleport` | Xbox XUI version of the teleport screen. 1 array sized to the limit. |
| `XUI_MultiGameInfo` | Shows game info for multiplayer. 2 loops bounded by the limit. |
| `XUI_MultiGameJoinLoad` | Join/load flow for multiplayer. Uses the limit for `maxPlayers` checks. |
| `UIScene_LoadOrJoinMenu` | Combined load/join screen. Uses the limit for `maxPlayers` display. |

## How to Actually Increase It

If you still want to try, here's the full plan.

### Step 1: Change the Constant

```cpp
// Change in every platform header:
const int MINECRAFT_NET_MAX_PLAYERS = 16;
```

You need to change it in `extraX64.h`, `extra.h`, and any platform-specific header that defines it. There are conditional defines (like the Vita `#ifdef`), so check all of them.

### Step 2: Find Every Usage

Search the full codebase for `MINECRAFT_NET_MAX_PLAYERS`. You'll find ~72 locations. Every fixed-size array needs to grow. Every loop bound is already using the constant, so those update automatically when you recompile. But hardcoded `8`s that should have been the constant? Those exist too:

```cpp
// PlayerRenderer.cpp - hardcoded 8
for (int i = 8; i < MINECRAFT_NET_MAX_PLAYERS; i++)
```

This loop assumes the first 8 colors are hardcoded and generates the rest procedurally. If you set the limit to 16, the first 8 still get their fixed colors and indexes 8-15 get generated colors. That actually works fine. But search for bare `8`s near player-related code to make sure there aren't other assumptions.

### Step 3: Check Network Packet Formats

Any field that encodes player count or player index as a `BYTE` caps at 255. The `LoginPacket` handles this:

```cpp
int maxPlayersForPacket = getMaxPlayers() > 255 ? 255 : getMaxPlayers();
static_cast<byte>(maxPlayersForPacket),
```

The `PreLoginPacket` clamps incoming player counts:

```cpp
if (m_dwPlayerCount > MINECRAFT_NET_MAX_PLAYERS)
    m_dwPlayerCount = MINECRAFT_NET_MAX_PLAYERS;
```

Check every packet that carries a player index or count. Small IDs are also bytes, so they cap at 255. For 16 players that's fine. For 256+ you'd need to change the wire format.

### Step 4: Update Platform Session Config

- **Xbox Live:** Update the service configuration for max session size
- **PSN:** Update the room creation parameters in `SQRNetworkManager`
- **Sony Voice Chat:** Change `AVC2_PARAM_DEFAULT_MAX_PLAYERS` and `AVC2_PARAM_DEFAULT_MAX_SPEAKERS`
- **LAN broadcast:** The `maxPlayers` field in the advertise data is a `unsigned char`, so 16 fits fine

### Step 5: Test Entity Tracking

With more players, the server does more work per tick. Profile the tick time and make sure it stays under 50ms (for 20 TPS). The entity tracker runs every tick and checks visibility for every tracked entity against every player. That's O(entities * players) per tick.

### Step 6: Update the UI

Player list screens, tab overlays, scoreboard displays, and teleport menus need to handle more entries. The XUI-based screens (Xbox 360) have fixed layouts that might need redesigning. The newer UI scenes might scroll, but test them.

### Step 7: Test Save/Load

Make sure saves with more than 8 players load correctly, and that the migration code in `DirectoryLevelStorage` doesn't break.

## A Safer Approach

Instead of fighting the hard limit everywhere, consider these alternatives:

- **Dedicated server mode:** No local players, all 8 slots go to network clients. The x64 build already has `isDedicatedServer` support in the session data.
- **Reduce splitscreen:** Limit to 2 local players to free up 2 more network slots (6 remote players instead of 4).
- **Spectator slots:** Add a spectator mode that doesn't count toward the player limit. Spectators skip entity tracking and don't get a player index from the normal pool.
- **Relay server:** Instead of peer-to-peer or client-hosted, use a dedicated relay that can handle the bandwidth for more clients.

## Key Files

| File | What it does |
|---|---|
| `extraX64.h` / `extra.h` | `MINECRAFT_NET_MAX_PLAYERS` definition (per platform) |
| `PlayerList.h/.cpp` | Player connection, index assignment, dimension tracking |
| `Consoles_App.h/.cpp` | Player color and privilege arrays, color assignment logic |
| `SessionInfo.h` | `GameSessionData` struct with per-player arrays (3 platform variants) |
| `PlayerRenderer.h/.cpp` | Nametag color array, color generation, bounds checking |
| `Extrax64Stubs.cpp` | QNet player array, small ID validation, player lookup |
| `WinsockNetLayer.cpp` | Small ID allocation/recycling, LAN broadcast advertising |
| `PendingConnection.cpp` | UGC permission check array |
| `DirectoryLevelStorage.cpp` | Player data migration loop |
| `PreLoginPacket.cpp` | Player count clamping on incoming packets |
| `LoginPacket.h` | Login response packet with max players byte field |
| `UIScene_TeleportMenu.h` | Teleport screen player arrays (4 arrays) |
| `UIScene_InGameInfoMenu.h` | Player overlay arrays (4 arrays in LCEMP, commented out in newer) |
| `XUI_InGameInfo.h` | Xbox XUI player overlay array |
| `UIScene_JoinMenu.cpp` | Join screen with 5 loops over the limit |
| `SonyVoiceChat.h` | PS3 voice chat with hardcoded 8-player limit |
| `SQRNetworkManager.h` | Sony network layer with `MAX_ONLINE_PLAYER_COUNT` alias |
| `PlatformNetworkManagerInterface.h` | Base class with `MINECRAFT_NET_MAX_PLAYERS` default params |
| `GameNetworkManager.h` | `HostGame` with `MINECRAFT_NET_MAX_PLAYERS` default slots |
