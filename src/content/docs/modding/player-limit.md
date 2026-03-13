---
title: Player Limit
description: The current player limit, network constraints, entity tracking, and what breaks when you increase it.
---

Legacy Console Edition supports up to 8 players in a multiplayer game. This limit is baked in pretty deep. Here's how it works and what happens if you try to push past it.

## Where the Limit Lives

The max player count is defined per-platform in the network headers. For Xbox, it's in `extra.h`:

```cpp
// Xbox/Network/extra.h
const int MINECRAFT_NET_MAX_PLAYERS = 8;
```

This constant shows up everywhere. It's used for array sizes, loop bounds, validation checks, and network packet fields. It's not a config value you can just change in one place.

## How Players Connect

When a player tries to join, `PlayerList` handles the connection. Here's the relevant code:

```cpp
// PlayerList.cpp - constructor
int rawMax = server->settings->getInt(L"max-players", 8);
maxPlayers = static_cast<unsigned int>(
    Mth::clamp(rawMax, 1, MINECRAFT_NET_MAX_PLAYERS)
);
```

The `maxPlayers` value is clamped to `MINECRAFT_NET_MAX_PLAYERS`. Even if you set `max-players` to 16 in the settings, it gets capped at 8.

When someone actually connects, they get a player index:

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
    // ...
}
```

If all 8 indexes are taken, you get a "server full" disconnect. Simple as that.

There's also a check earlier in the join flow:

```cpp
// PlayerList.cpp - getPlayerForLogin()
if (players.size() >= (unsigned int)maxPlayers)
{
    pendingConnection->disconnect(DisconnectPacket::eDisconnect_ServerFull);
    return shared_ptr<ServerPlayer>();
}
```

## The Login Packet

The login packet that gets sent back to the joining player includes the max player count. But there's a catch, it's a single byte:

```cpp
// PlayerList.cpp - placeNewPlayer()
int maxPlayersForPacket = getMaxPlayers() > 255 ? 255 : getMaxPlayers();
// ...
static_cast<byte>(maxPlayersForPacket),
```

So the packet format caps at 255 players in theory, but `MINECRAFT_NET_MAX_PLAYERS` caps you at 8 way before that.

## Fixed-Size Arrays

This is where things get ugly. The constant is used to size arrays throughout the codebase:

```cpp
// Consoles_App.h
BYTE m_playerColours[MINECRAFT_NET_MAX_PLAYERS];
unsigned int m_playerGamePrivileges[MINECRAFT_NET_MAX_PLAYERS];
```

The `PlayerRenderer` also uses the constant for bounds checking:

```cpp
// PlayerRenderer.cpp
if (index >= 8 && index < MINECRAFT_NET_MAX_PLAYERS)
    // ...
if (index >= 0 && index < MINECRAFT_NET_MAX_PLAYERS)
    // ...
```

The `PreLoginPacket` clamps the player count server-side:

```cpp
// PreLoginPacket.cpp
if (m_dwPlayerCount > MINECRAFT_NET_MAX_PLAYERS)
    m_dwPlayerCount = MINECRAFT_NET_MAX_PLAYERS;
```

## What Breaks If You Increase It

Let's say you change `MINECRAFT_NET_MAX_PLAYERS` to 16. Here's what you'd need to deal with:

### Array Overflows

Every fixed-size array indexed by player count needs to grow. Search the codebase for `MINECRAFT_NET_MAX_PLAYERS` and you'll find dozens of arrays. Some are in hot paths, some are in network code, some are in the UI. Miss one and you get memory corruption.

### Network Bandwidth

The server broadcasts packets to all players in range. With 8 players, that's manageable. With 16, you're sending roughly twice as many entity updates, chunk data packets, and position syncs. On a console with limited network throughput, this adds up fast.

### Entity Tracking

The `EntityTracker` system syncs entity positions and state across all players within range. More players means:

- More tracked entities (each player is an entity)
- More position update packets per tick
- More player-to-player visibility checks

The `PlayerList` maintains per-dimension tracking lists:

```cpp
// PlayerList.h
// Which players in which dimensions can receive all packet types
vector<shared_ptr<ServerPlayer>> receiveAllPlayers[3];
```

### Splitscreen Interaction

The local splitscreen system supports 4 players max (`XUSER_MAX_COUNT`). If you're adding more network players, that's separate from local players. But UI code that lists all players in the game might need wider layouts.

### Save File Size

Player data is saved for each connected player. More players means bigger save files and longer save times. On consoles with tight storage limits, this matters.

### Voice Chat

The voice chat system (on platforms that have it) is sized for 8 participants:

```cpp
// SonyVoiceChat.h, PlatformNetworkManagerXbox.h, etc.
// These systems allocate buffers per-player
```

## How to Actually Increase It

If you still want to try, here's the rough plan:

**Step 1:** Change `MINECRAFT_NET_MAX_PLAYERS` in the platform-specific header:

```cpp
const int MINECRAFT_NET_MAX_PLAYERS = 16;
```

**Step 2:** Find every use of the constant. There are a lot of them. Use a full codebase search. Every array, every loop, every bounds check.

**Step 3:** Check the network packet formats. Any field that encodes player count or player index as a `BYTE` caps at 255. The `LoginPacket` already handles this, but other packets might not.

**Step 4:** Test entity tracking. With more players, the server needs to do more work per tick. Profile the tick time and make sure it stays under 50ms (for 20 TPS).

**Step 5:** Test the platform's network layer. Xbox Live, PSN, and other platform networking APIs may have their own session size limits that are separate from the game code.

**Step 6:** Update the UI. Player list screens, tab overlays, scoreboard displays, and other places that show all players need to handle the larger count.

## A Safer Approach

Instead of changing the hard limit, consider:

- **Dedicated server mode** where there are no local players and all 8 slots go to network clients
- **Reducing the splitscreen limit** to 2 local players to free up network slots for remote players
- **Spectator slots** that don't count toward the player limit and don't get entity tracking

## Key Files

| File | What it does |
|---|---|
| `Xbox/Network/extra.h` | `MINECRAFT_NET_MAX_PLAYERS` definition |
| `PlayerList.h/.cpp` | Player connection, index assignment, broadcasting |
| `Consoles_App.h` | Player color and privilege arrays |
| `PlayerRenderer.cpp` | Per-player rendering with index bounds |
| `PreLoginPacket.cpp` | Player count validation |
| `LoginPacket.h` | Login response packet with max players field |
