---
title: Networking & Packets
description: How LCE handles multiplayer networking and packet communication.
---

LCE's networking layer is a console-adapted version of the original Minecraft Java Edition protocol, heavily modified by 4J Studios to work over platform-specific network APIs (QNET on Xbox, SQR on PlayStation, ad-hoc on PS Vita). The system follows a client-server model where the host machine runs an integrated server and all players (including the host's local players) communicate through packet-based connections.

## Architecture overview

The networking code is split across two layers:

**Platform-independent layer** (`Minecraft.World` and `Minecraft.Client`):
- `Packet`: base class for all packet types, with a static registry mapping IDs to factory functions
- `Connection`: manages a bidirectional socket with dedicated read/write threads
- `PacketListener`: abstract interface with virtual handlers for every packet type
- `ServerConnection`: server-side manager that tracks pending and active player connections
- `ClientConnection`: client-side `PacketListener` implementation that handles incoming server packets
- `PlayerConnection`: server-side `PacketListener` implementation that handles incoming client packets
- `PendingConnection`: temporary server-side handler for connections still in the login handshake

**Platform-specific layer** (`Minecraft.Client/Common/Network` and platform subdirectories):
- `CGameNetworkManager`: platform-independent game-side networking coordinator (global instance `g_NetworkManager`)
- `CPlatformNetworkManager`: abstract interface with one implementation per platform
- `INetworkPlayer`: abstract player interface with methods for sending data, checking RTT, and managing socket state
- Platform implementations: `CPlatformNetworkManagerXbox`, `CPlatformNetworkManagerDurango`, `CPlatformNetworkManagerSony`, `CPlatformNetworkManagerStub`

The relationship between these layers is documented in `/Users/cole/Documents/LCEMP/Minecraft.Client/Network Implementation Notes.txt`:

```
Game --> GameNetworkManager <--> NetworkPlayerInterface    (platform independent)
              |                          |
              v                          v
     PlatformNetworkManager <--> NetworkPlayerImplementation  (platform specific)
              |                          |
              v                          v
     Platform network code       Platform player code
```

## The socket abstraction

The `Socket` class (`Minecraft.World/Socket.h`) provides a unified interface over two different transport methods:

- **Local sockets**: For connections between the host player and the integrated server on the same machine. Data passes through in-memory queues (`s_hostQueue`) protected by critical sections, so no actual network traffic happens.
- **Network sockets**: For connections to remote players. Data goes through `INetworkPlayer::SendData()` which passes it to the platform's network layer (QNET on Xbox, SQR on PlayStation).

Each socket has two "ends" (`SOCKET_CLIENT_END = 0` and `SOCKET_SERVER_END = 1`) with independent input and output streams.

### Socket stream classes

The socket uses four internal stream classes:

| Class | Purpose |
|---|---|
| `SocketInputStreamLocal` | Reads from the static `s_hostQueue` for local connections |
| `SocketOutputStreamLocal` | Writes to the static `s_hostQueue` for local connections |
| `SocketInputStreamNetwork` | Reads from per-socket `m_queueNetwork` for remote connections |
| `SocketOutputStreamNetwork` | Writes through `INetworkPlayer::SendData()` with optional priority flags |

The `SocketOutputStreamNetwork` class has a `writeWithFlags()` method that passes QNet priority flags along with the data. This is how the slow queue sends chunk data with `QNET_SENDDATA_LOW_PRIORITY | QNET_SENDDATA_SECONDARY` flags.

Key socket state:
- `m_hostServerConnection`: true if this is the host-to-server connection
- `m_hostLocal`: true if this player is on the same machine as the host
- `m_endClosed[2]`: tracks whether each end of the socket has been closed
- `networkPlayerSmallId`: the QNet small ID assigned to this player's network slot
- `isLocal()`: returns `m_hostLocal`, tells local and networked connections apart
- `isClosing()`: returns true if either end is closed

The system skips outgoing packet stats recording for local connections since no network traffic actually happens.

## The Connection class

`Connection` (`Minecraft.World/Connection.h`) wraps a `Socket` with:

- **Dedicated read and write threads** running on `CPU_CORE_CONNECTIONS`, using event-based wake signals (`C4JThread::Event`) with a 100ms timeout fallback
- **Three packet queues** protected by critical sections:
  - `incoming`: packets read from the network, waiting to be dispatched to the `PacketListener`
  - `outgoing`: normal-priority packets queued for sending
  - `outgoing_slow`: low-priority packets (e.g., chunk data marked with `shouldDelay`), sent with `QNET_SENDDATA_LOW_PRIORITY | QNET_SENDDATA_SECONDARY` flags
- **KeepAlive heartbeat**: sends a `KeepAlivePacket` every 20 ticks
- **Timeout detection**: disconnects after `MAX_TICKS_WITHOUT_INPUT` (1200 ticks / 60 seconds) of silence. Timeout disconnect is disabled in debug builds via `CONNECTION_ENABLE_TIMEOUT_DISCONNECT`.
- **Overflow protection**: disconnects if the estimated outgoing buffer goes over 1 MB (`estimatedRemaining > 1 * 1024 * 1024`)
- **Buffered output**: uses a 5 KB send buffer (`SEND_BUFFER_SIZE = 1024 * 5`)
- **Slow queue delay**: the `slowWriteDelay` counter starts at 50 and counts down before slow queue packets are sent

### How tick() works

The `tick()` method runs on the main game thread each server tick. Here is what it does step by step:

1. Checks `estimatedRemaining` against the 1 MB overflow limit. If exceeded, closes with `eDisconnect_Overflow`.
2. If the incoming queue is empty, increments `noInputTicks`. If that hits 1200, closes with `eDisconnect_TimeOut`.
3. If the incoming queue has packets, resets `noInputTicks` to 0.
4. Every 20 ticks, sends a `KeepAlivePacket` to keep the connection alive.
5. Drains up to 1000 packets from the incoming queue into a local vector (inside the critical section).
6. Handles each packet outside the critical section by calling `packet->handle(packetListener)`. This avoids a deadlock where handle() might call close() which tries to signal the read/write threads.
7. Calls `flush()` to wake the read/write threads.
8. If the socket is closing, calls `close(eDisconnect_Closed)`.
9. If disconnected and the incoming queue is empty, fires `packetListener->onDisconnect()` and resets the disconnected flag.

### How the write thread works

The write thread (`runWrite`) loops while the connection is running:

1. Checks the `outgoing` queue first. If there is a packet and the optional `fakeLag` delay has passed, pops the packet and writes it through `Packet::writePacket()` to the buffered `DataOutputStream`.
2. If `slowWriteDelay` has counted down to zero, checks the `outgoing_slow` queue. If a packet still has `shouldDelay` set, it writes through `byteArrayDos` and then sends with priority flags via `sos->writeWithFlags()`. Otherwise it writes through the normal buffered stream.
3. Records outgoing stats for non-local connections.
4. Waits on `m_hWakeWriteThread` with a 100ms timeout.
5. Flushes the buffered output stream.

### How the read thread works

The read thread (`runRead`) loops while the connection is running:

1. Calls `Packet::readPacket()` which reads one byte for the packet ID, validates it against the allowed set, creates the packet through its factory, and calls `read()` to parse the payload.
2. If a valid packet is returned, pushes it to the `incoming` queue inside the critical section.
3. If `readPacket()` returns null (end of stream), does nothing. An earlier version used to close on null, but that was removed to fix a splitscreen bug.
4. Waits on `m_hWakeReadThread` with a 100ms timeout.

### Connection close sequence

`Connection::close()` does the following:

1. Sets `running = false` and `disconnected = true`
2. Closes the `DataInputStream` to unblock the read thread
3. Waits for both the read and write threads to finish (`WaitForCompletion(INFINITE)`)
4. Deletes all streams (`dis`, `bufferedDos`, `byteArrayDos`)
5. Closes the socket

On Orbis (PS4), both the read and write threads run at `THREAD_PRIORITY_BELOW_NORMAL` because the same CPU core is used for the Matching 2 library.

## The Packet base class

All packets inherit from `Packet` (`Minecraft.World/Packet.h`). Each packet must implement:

| Method | Purpose |
|--------|---------|
| `getId()` | Returns the packet's numeric ID (0-255) |
| `read(DataInputStream*)` | Reads the packet from the stream |
| `write(DataOutputStream*)` | Writes the packet to the stream |
| `handle(PacketListener*)` | Dispatches to the right handler on the listener |
| `getEstimatedSize()` | Returns estimated byte size for buffer management |

Optional overrides include `canBeInvalidated()` and `isInvalidatedBy()` for packet deduplication, and `isAync()` for async-safe packets (only `KeepAlivePacket` uses this).

Every packet also has:
- `createTime`: timestamp from `System::currentTimeMillis()` set in the constructor, used for `fakeLag` timing
- `shouldDelay`: flag that routes the packet to `outgoing_slow` instead of `outgoing`

### Packet wire format

Packets are written as a single ID byte followed by packet-specific data:

```
[1 byte: packet ID] [N bytes: packet payload]
```

The `Packet::readPacket()` static method reads the ID byte, validates it against the allowed set for the connection side (client or server), creates the packet through its registered factory function, and calls `read()` to parse the payload. If the ID byte is -1 (end of stream) or the packet isn't in the allowed set, it returns null.

`Packet::writePacket()` writes the ID byte and then calls `write()`:

```cpp
dos->write(packet->getId());
packet->write(dos);
```

### Packet registration

`Packet::staticCtor()` registers all packets through the `Packet::map()` function:

```cpp
map(id, receiveOnClient, receiveOnServer, sendToAnyClient, renderStats, typeid(Class), Class::create);
```

Parameters:
- **`id`**: numeric packet ID (0-255)
- **`receiveOnClient`**: whether the client processes this packet
- **`receiveOnServer`**: whether the server processes this packet
- **`sendToAnyClient`**: if `true`, sent to all clients; if `false`, sent to only one player per dimension per machine (a 4J splitscreen optimization)
- **`renderStats`**: whether to include in debug statistics rendering
- **Factory function**: creates a new packet instance as `shared_ptr<Packet>`

Three sets track directionality: `clientReceivedPackets`, `serverReceivedPackets`, and `sendToAnyClientPackets`.

### Packet statistics

When `PACKET_ENABLE_STAT_TRACKING` is set to 1 (default is 0), the system tracks per-packet-type statistics:

- `outgoingStatistics`: tracks count and size of outgoing packets
- `statistics`: tracks count and size of incoming packets
- `renderableStats`: subset shown in the debug overlay

Each `PacketStatistics` object keeps a ring buffer of 512 samples for both count and size, used for graphing bandwidth over time. The `renderAllPacketStats()` method draws a stacked graph and legend using the GUI system.

### Utility methods

`Packet` provides shared serialization helpers:

**`writeUtf()` / `readUtf()`**: Length-prefixed UTF-16 strings. Writes a short for the string length, then each character as a `wchar_t`. `readUtf()` takes a `maxLength` parameter and returns an empty string if the length is out of bounds.

**`writeItem()` / `readItem()`**: Serializes an `ItemInstance` as:
1. `short`: item ID (-1 for null)
2. `byte`: stack count
3. `short`: damage/aux value
4. NBT: compressed tag data (always written, not just for depletable items, a 4J change)

**`writeNbt()` / `readNbt()`**: Compressed NBT compound tags. Writes a short length prefix then the raw bytes from `NbtIo::compress()`. Returns null for sizes <= 0 or > 32767 (`MAX_NBT_SIZE`).

**`writeBytes()` / `readBytes()`**: Length-prefixed byte arrays using a short for the length.

## Complete packet registry

All packet IDs as registered in `Packet::staticCtor()`. The `sendToAny` column shows whether the packet is broadcast to all connected clients (`true`) or sent to only one player per dimension per machine (`false`).

### Connection and lifecycle (IDs 0-2, 254-255)

| ID | Packet | Client | Server | sendToAny | Description |
|----|--------|--------|--------|-----------|-------------|
| 0 | `KeepAlivePacket` | recv | recv | true | Connection heartbeat, sent every 20 ticks |
| 1 | `LoginPacket` | recv | recv | true | Login exchange (bidirectional with different payloads) |
| 2 | `PreLoginPacket` | recv | recv | true | Pre-login handshake with version check and UGC privileges |
| 254 | `GetInfoPacket` | -- | recv | false | Server info query |
| 255 | `DisconnectPacket` | recv | recv | true | Disconnect with reason enum |

### Chat and commands (IDs 3, 167, 205)

| ID | Packet | Client | Server | sendToAny | Description |
|----|--------|--------|--------|-----------|-------------|
| 3 | `ChatPacket` | recv | recv | true | Chat messages with typed args |
| 167 | `GameCommandPacket` | -- | recv | false | Game commands from client |
| 205 | `ClientCommandPacket` | -- | recv | true | Client-issued commands (e.g., respawn request) |

### Player movement (IDs 10-13)

| ID | Packet | Client | Server | sendToAny | Description |
|----|--------|--------|--------|-----------|-------------|
| 10 | `MovePlayerPacket` | recv | recv | true | Base player movement (ground/flying status only) |
| 11 | `MovePlayerPacket::Pos` | recv | recv | true | Player position update (x, y, z, onGround) |
| 12 | `MovePlayerPacket::Rot` | recv | recv | true | Player rotation update (yRot, xRot, onGround) |
| 13 | `MovePlayerPacket::PosRot` | recv | recv | true | Player position + rotation update |

### Player actions and state (IDs 4-9, 14-19, 200-202)

| ID | Packet | Client | Server | sendToAny | Description |
|----|--------|--------|--------|-----------|-------------|
| 4 | `SetTimePacket` | recv | -- | false | World time synchronization |
| 5 | `SetEquippedItemPacket` | recv | -- | false | Entity equipped item display |
| 6 | `SetSpawnPositionPacket` | recv | -- | true | Player spawn point |
| 7 | `InteractPacket` | -- | recv | false | Entity interaction (attack/use) |
| 8 | `SetHealthPacket` | recv | -- | true | Player health update |
| 9 | `RespawnPacket` | recv | recv | true | Respawn / dimension change |
| 14 | `PlayerActionPacket` | -- | recv | false | Block digging actions |
| 15 | `UseItemPacket` | -- | recv | false | Item use / block placement |
| 16 | `SetCarriedItemPacket` | -- | recv | false | Hotbar slot change |
| 17 | `EntityActionAtPositionPacket` | recv | -- | true | Entity action at position (e.g., sleep in bed). Changed to sendToAny for sleep sync. |
| 18 | `AnimatePacket` | recv | recv | true | Player arm swing / damage animation. Changed to sendToAny for wake-from-sleep. |
| 19 | `PlayerCommandPacket` | -- | recv | false | Player actions (sneak, sprint, etc.) |
| 200 | `AwardStatPacket` | recv | -- | true | Statistics update |
| 201 | `PlayerInfoPacket` | recv | recv | false | Player list updates (repurposed by 4J) |
| 202 | `PlayerAbilitiesPacket` | recv | recv | true | Player abilities (flying, creative, etc.) |

### Entity spawning (IDs 20-26, 71)

| ID | Packet | Client | Server | sendToAny | Description |
|----|--------|--------|--------|-----------|-------------|
| 20 | `AddPlayerPacket` | recv | -- | false | Spawn a remote player |
| 22 | `TakeItemEntityPacket` | recv | -- | true | Item pickup animation |
| 23 | `AddEntityPacket` | recv | -- | false | Spawn a non-mob entity (minecart, arrow, etc.) |
| 24 | `AddMobPacket` | recv | -- | false | Spawn a mob entity |
| 25 | `AddPaintingPacket` | recv | -- | false | Spawn a painting |
| 26 | `AddExperienceOrbPacket` | recv | -- | false | Spawn an experience orb |
| 71 | `AddGlobalEntityPacket` | recv | -- | false | Spawn a global entity (lightning bolt) |

### Entity sync (IDs 28-35, 38-43, 162-165)

| ID | Packet | Client | Server | sendToAny | Description |
|----|--------|--------|--------|-----------|-------------|
| 28 | `SetEntityMotionPacket` | recv | -- | true | Entity velocity. Set to sendToAny because knockback effects need to be visible to everyone. |
| 29 | `RemoveEntitiesPacket` | recv | -- | false | Despawn entities |
| 30 | `MoveEntityPacket` | recv | -- | false | Entity movement base (no data) |
| 31 | `MoveEntityPacket::Pos` | recv | -- | false | Entity relative position delta (signed bytes) |
| 32 | `MoveEntityPacket::Rot` | recv | -- | false | Entity rotation delta (compressed bytes) |
| 33 | `MoveEntityPacket::PosRot` | recv | -- | false | Entity position + rotation delta |
| 34 | `TeleportEntityPacket` | recv | -- | false | Entity absolute position |
| 35 | `RotateHeadPacket` | recv | -- | false | Entity head rotation |
| 38 | `EntityEventPacket` | recv | -- | true | Entity status changes (damage, death, etc.). Set to sendToAny for sound effects. |
| 39 | `SetRidingPacket` | recv | -- | true | Mount/dismount |
| 40 | `SetEntityDataPacket` | recv | -- | true | Entity metadata sync |
| 41 | `UpdateMobEffectPacket` | recv | -- | true | Apply potion effect |
| 42 | `RemoveMobEffectPacket` | recv | -- | true | Remove potion effect |
| 43 | `SetExperiencePacket` | recv | -- | true | Experience bar update |
| 162 | `MoveEntityPacketSmall` | recv | -- | false | Small entity movement base (4J addition) |
| 163 | `MoveEntityPacketSmall::Pos` | recv | -- | false | Small entity position delta (packed bits) |
| 164 | `MoveEntityPacketSmall::Rot` | recv | -- | false | Small entity rotation delta (packed bits) |
| 165 | `MoveEntityPacketSmall::PosRot` | recv | -- | false | Small entity position + rotation delta (packed bits) |

### World / chunk data (IDs 50-55, 60-62, 70, 155)

| ID | Packet | Client | Server | sendToAny | Description |
|----|--------|--------|--------|-----------|-------------|
| 50 | `ChunkVisibilityPacket` | recv | -- | true | Show/hide a single chunk column |
| 51 | `BlockRegionUpdatePacket` | recv | -- | true | Bulk block data for a region (replaces Java's LevelChunkPacket) |
| 52 | `ChunkTilesUpdatePacket` | recv | -- | true | Multiple block changes within a chunk |
| 53 | `TileUpdatePacket` | recv | -- | true | Single block change |
| 54 | `TileEventPacket` | recv | -- | true | Block event (piston, chest, noteblock) |
| 55 | `TileDestructionPacket` | recv | -- | false | Block break progress |
| 60 | `ExplodePacket` | recv | -- | true | Explosion with affected blocks |
| 61 | `LevelEventPacket` | recv | -- | true | World effects (particles, sounds) |
| 62 | `LevelSoundPacket` | recv | -- | true | Named sound events |
| 70 | `GameEventPacket` | recv | -- | false | Game state changes (rain, credits, etc.) |
| 155 | `ChunkVisibilityAreaPacket` | recv | -- | true | Batch chunk visibility for initial join (4J addition). Sends minX, maxX, minZ, maxZ instead of individual messages. |

### Container / inventory (IDs 100-108, 130-132)

| ID | Packet | Client | Server | sendToAny | Description |
|----|--------|--------|--------|-----------|-------------|
| 100 | `ContainerOpenPacket` | recv | -- | true | Open a container GUI |
| 101 | `ContainerClosePacket` | recv | recv | true | Close a container |
| 102 | `ContainerClickPacket` | -- | recv | false | Inventory click action |
| 103 | `ContainerSetSlotPacket` | recv | recv* | true | Set a single inventory slot. *Server recv only in non-content-package builds (debug). |
| 104 | `ContainerSetContentPacket` | recv | -- | true | Set entire container contents |
| 105 | `ContainerSetDataPacket` | recv | -- | true | Container property update (furnace progress, etc.) |
| 106 | `ContainerAckPacket` | recv | recv | true | Transaction confirmation |
| 107 | `SetCreativeModeSlotPacket` | recv | recv | true | Creative mode inventory action |
| 108 | `ContainerButtonClickPacket` | -- | recv | false | Container button click (enchanting) |
| 130 | `SignUpdatePacket` | recv | recv | true | Sign text update |
| 131 | `ComplexItemDataPacket` | recv | -- | true | Map item data |
| 132 | `TileEntityDataPacket` | recv | -- | false | Tile entity NBT sync |

### 4J custom packets (IDs 150-167)

| ID | Packet | Client | Server | sendToAny | Description |
|----|--------|--------|--------|-----------|-------------|
| 150 | `CraftItemPacket` | -- | recv | false | Crafting request from client |
| 151 | `TradeItemPacket` | -- | recv | true | Villager trading |
| 152 | `DebugOptionsPacket` | -- | recv | false | Debug mode toggles |
| 153 | `ServerSettingsChangedPacket` | recv | recv | false | Server settings synchronization |
| 154 | `TexturePacket` | recv | recv | true | Texture pack data |
| 156 | `UpdateProgressPacket` | recv | -- | false | Loading progress bar |
| 157 | `TextureChangePacket` | recv | recv | true | Texture pack change notification |
| 158 | `UpdateGameRuleProgressPacket` | recv | -- | true | Game rule change progress |
| 159 | `KickPlayerPacket` | -- | recv | false | Kick a player from the game |
| 160 | `TextureAndGeometryPacket` | recv | recv | true | Texture + geometry (skin) data |
| 161 | `TextureAndGeometryChangePacket` | recv | recv | true | Texture + geometry change notification |
| 166 | `XZPacket` | recv | recv | false | XZ coordinate packet |

### Plugin channel (ID 250)

| ID | Packet | Client | Server | sendToAny | Description |
|----|--------|--------|--------|-----------|-------------|
| 250 | `CustomPayloadPacket` | recv | recv | true | Named channel data (plugin messages) |

### Commented-out packets

Several packet IDs are commented out in `staticCtor()`:
- **ID 27** (`PlayerInputPacket`): commented out, never registered
- **ID 203** (`ChatAutoCompletePacket`): added in 1.3.2 but 4J decided they didn't need it
- **ID 204** (`ClientInformationPacket`): same, added in 1.3.2 but skipped
- **ID 252** (`SharedKeyPacket`): added in 1.3.2, skipped
- **ID 253** (`ServerAuthDataPacket`): added in 1.3.2, skipped

## Connection lifecycle

### 1. Socket creation

When a new player joins, `CGameNetworkManager::CreateSocket()` creates a `Socket` object. For the host player, this is a local socket backed by in-memory queues. For remote players, the socket wraps the platform's `INetworkPlayer` network layer. The socket then goes to `ServerConnection::NewIncomingSocket()`.

### 2. Pending connection (PreLogin)

The server wraps the new socket in a `PendingConnection`, which creates a `Connection` with read/write threads. The connection has 30 seconds (`MAX_TICKS_BEFORE_LOGIN = 600 ticks`) to finish the login process.

The client sends a `PreLoginPacket` (ID 2) containing:
- Player XUIDs (offline and online) for all local players (up to `MINECRAFT_NET_MAX_PLAYERS`)
- UGC (user-generated content) privilege flags
- Friends-only bits
- The unique save name (for ban list checking)
- Server settings bitfield
- Host player index
- Texture pack ID
- **Network version number** (`m_netcodeVersion`, checked against `MINECRAFT_NET_VERSION`)

If the version doesn't match, the server disconnects with `eDisconnect_OutdatedServer` or `eDisconnect_OutdatedClient`. The player count in the PreLogin is clamped:

```cpp
if (m_dwPlayerCount > MINECRAFT_NET_MAX_PLAYERS)
    m_dwPlayerCount = MINECRAFT_NET_MAX_PLAYERS;
```

On success, the server sends back a `PreLoginPacket` response with its own UGC privilege information.

### 3. Login exchange

After the PreLogin succeeds, the client sends a `LoginPacket` (ID 1) with:
- `userName`: player's display name
- `clientVersion`: version number
- `m_offlineXuid` / `m_onlineXuid`: player identifiers
- `m_friendsOnlyUGC`: UGC restriction flag
- `m_ugcPlayersVersion`: UGC version
- `m_playerSkinId` / `m_playerCapeId`: cosmetic IDs
- `m_isGuest`: whether the player is a guest account

The server responds with a `LoginPacket` containing world information:
- `seed`: world generation seed
- `dimension`: current dimension (byte)
- `gameType`: game mode ID
- `difficulty`: world difficulty (byte)
- `mapHeight`: map height (byte)
- `maxPlayers`: max player count (byte, capped at 255)
- `m_pLevelType`: generator type
- `m_newSeaLevel`: whether to use post-1.8.2 sea level
- `m_uiGamePrivileges`: player privilege bitfield
- `m_xzSize`: console world width in blocks
- `m_hellScale`: nether-to-overworld scale ratio
- `m_multiplayerInstanceId`: session instance ID
- `m_playerIndex`: assigned player index (byte)

### 4. World data transfer

Once login completes, the `PendingConnection` gets promoted: its `Connection` is transferred to a new `PlayerConnection` and linked to a `ServerPlayer`. The server then sends:

1. `ChunkVisibilityAreaPacket` (ID 155): a 4J addition that sends the min/max X and Z chunk coordinates for the initial visible area, instead of one `ChunkVisibilityPacket` per chunk
2. `BlockRegionUpdatePacket` (ID 51) for each visible chunk, containing the compressed block data. Each packet has fields for the region origin (`x, y, z`), size (`xs, ys, zs`), a `buffer` of compressed block data, the `levelIdx`, and a `bIsFullChunk` flag
3. Entity spawn packets for nearby entities
4. Inventory and player state packets
5. Custom skin texture requests via `TextureAndGeometryPacket` (ID 160) if the player has a custom skin

The `ClientConnection` tracks its state through an enum: `eCCPreLoginSent` -> `eCCPreLoginReceived` -> `eCCLoginSent` -> `eCCLoginReceived` -> `eCCConnected`.

### 5. Play state

During gameplay, `Connection::tick()` processes incoming packets and the `PacketListener` implementation (either `PlayerConnection` on the server or `ClientConnection` on the client) handles each one through its virtual `handle*` methods.

### 6. Disconnection

Disconnection can happen for many reasons, tracked by `DisconnectPacket::eDisconnectReason`:

| Reason | Trigger |
|--------|---------|
| `eDisconnect_Quitting` | Player chose to leave |
| `eDisconnect_Closed` | Socket closed |
| `eDisconnect_LoginTooLong` | Login took more than 30 seconds |
| `eDisconnect_IllegalStance` | Invalid player stance |
| `eDisconnect_IllegalPosition` | Invalid player position |
| `eDisconnect_MovedTooQuickly` | Speed hack detection |
| `eDisconnect_NoFlying` | Flying in survival without permission |
| `eDisconnect_Kicked` | Kicked by host |
| `eDisconnect_TimeOut` | No input for 60 seconds |
| `eDisconnect_Overflow` | Outgoing buffer went over 1 MB |
| `eDisconnect_EndOfStream` | Network stream ended |
| `eDisconnect_ServerFull` | No slots available |
| `eDisconnect_OutdatedServer` / `eDisconnect_OutdatedClient` | Version mismatch |
| `eDisconnect_ConnectionCreationFailed` | Socket creation failed |
| `eDisconnect_NoMultiplayerPrivilegesHost` / `eDisconnect_NoMultiplayerPrivilegesJoin` | Platform privilege failure |
| `eDisconnect_NoUGC_AllLocal` / `eDisconnect_NoUGC_Single_Local` / `eDisconnect_NoUGC_Remote` | UGC content restrictions |
| `eDisconnect_ContentRestricted_AllLocal` / `eDisconnect_ContentRestricted_Single_Local` | Content restrictions |
| `eDisconnect_Banned` | Player is banned |
| `eDisconnect_NotFriendsWithHost` | Friends-only session restriction |
| `eDisconnect_NoFriendsInGame` | No friends in the session |
| `eDisconnect_NATMismatch` | NAT type incompatibility |
| `eDisconnect_UnexpectedPacket` | Packet arrived out of sequence |
| `eDisconnect_NetworkError` | Generic network error (Orbis only) |
| `eDisconnect_ExitedGame` | Player exited game (Xbox One only) |

## Entity tracking

The `EntityTracker` system (`Minecraft.Client/EntityTracker.h`) manages which entities are visible to which players and sends the right spawn/despawn/update packets.

### Tracker structure

Each `ServerLevel` has one `EntityTracker`. It keeps:
- `entities`: an `unordered_set` of all `TrackedEntity` objects
- `entityMap`: maps entity ID to `TrackedEntity` for fast lookup
- `maxRange`: the maximum tracking range, set from `PlayerList::getMaxRange()`

### Tracking ranges and update intervals

When an entity is added to the tracker, it gets a range (in blocks) and an update interval (in ticks). Here are the values from `EntityTracker::addEntity()`:

| Entity Type | Range | Update Interval | Track Deltas |
|---|---|---|---|
| `ServerPlayer` | 512 (32*16) | 2 | false |
| `FishingHook` | 64 (16*4) | 5 | true |
| `SmallFireball` | 64 (16*4) | 10 | false |
| `DragonFireball` | 64 (16*4) | 10 | false |
| `Arrow` | 64 (16*4) | 20 | false |
| `Fireball` | 64 (16*4) | 10 | false |
| `Snowball` | 64 (16*4) | 10 | true |
| `ThrownEnderpearl` | 64 (16*4) | 10 | true |
| `EyeOfEnderSignal` | 64 (16*4) | 4 | true |
| `ThrownEgg` | 64 (16*4) | 10 | true |
| `ThrownPotion` | 64 (16*4) | 10 | true |
| `ThrownExpBottle` | 64 (16*4) | 10 | true |
| `ItemEntity` | 64 (16*4) | 20 | true |
| `Minecart` | 80 (16*5) | 3 | true |
| `Boat` | 80 (16*5) | 3 | true |
| `Squid` | 64 (16*4) | 3 | true |
| Any `Creature` | 80 (16*5) | 3 | true |
| `EnderDragon` | 160 (16*10) | 3 | true |
| `PrimedTnt` | 160 (16*10) | 10 | true |
| `FallingTile` | 160 (16*10) | 20 | true |
| `Painting` | 160 (16*10) | MAX_INT | false |
| `ExperienceOrb` | 160 (16*10) | 20 | true |
| `EnderCrystal` | 256 (16*16) | MAX_INT | false |
| `ItemFrame` | 160 (16*10) | MAX_INT | false |

The range is capped to `maxRange` (set from `PlayerList::getMaxRange()`). Entity IDs are hard-limited to < 2048 with a debug break.

### Visibility checks

The `TrackedEntity::isVisible()` method determines if a given player should see the entity:

1. Computes the XZ distance between the player and the entity's updated position (`xpu`, `zpu`)
2. Compares against the tracking range (adjusted by `sp->getPlayerViewDistanceModifier()` for players beyond the minimum view distance of 4)
3. If the entity is not visible to this player, checks all other players on the **same system** (via `INetworkPlayer::IsSameSystem()`). If any splitscreen partner is in range, the entity counts as visible. This is a 4J addition for splitscreen.
4. If the entity is riding something, recursively checks that the mount is also visible (and already in `seenBy`), so mounts are always sent before riders.

### The tick cycle

Each tick, `EntityTracker::tick()` does the following:

1. Iterates all tracked entities, calling `TrackedEntity::tick()` on each
2. Collects all `ServerPlayer` entities that moved significantly (distance > 16 blocks squared)
3. For splitscreen: adds any other players on the same system as moved players, so their visibility is updated too
4. For each moved player, re-evaluates visibility of all tracked entities
5. Flushes `entitiesToRemove` for dead players

### Movement packet selection

`TrackedEntity::tick()` picks the smallest packet type for each entity movement:

1. **Teleport** (`TeleportEntityPacket`, ID 34): used when the delta is too large for relative encoding (>= 128 in any axis), or periodically for boats (every 400 ticks to fix sinking)
2. **Standard PosRot** (`MoveEntityPacket::PosRot`, ID 33): relative deltas as signed bytes for both position and rotation
3. **Small PosRot** (`MoveEntityPacketSmall::PosRot`, ID 165): 5 bits each for X/Z, 6 bits for Y, 5 bits for yRot. Used when X is in [-16,15], Z in [-16,15], Y in [-32,31], and there is no xRot change. Saves a full byte over the standard packet.
4. **Standard Pos** (`MoveEntityPacket::Pos`, ID 31): position deltas only
5. **Small Pos** (`MoveEntityPacketSmall::Pos`, ID 163): 4 bits each for X/Z, 5 bits for Y. Used when X is in [-8,7], Z in [-8,7], Y in [-16,15].
6. **Standard Rot** (`MoveEntityPacket::Rot`, ID 32): rotation deltas only
7. **Small Rot** (`MoveEntityPacketSmall::Rot`, ID 164): yRot delta only, no xRot. 5 bits for yRot delta.

The tolerance level for position is 4 (meaning deltas smaller than 4 are ignored). Same tolerance for rotation.

If `trackDelta` is true, velocity changes are sent via `SetEntityMotionPacket` (ID 28) when the velocity difference exceeds 0.02 squared.

Entity metadata (`SynchedEntityData`) is checked for dirtiness and sent via `SetEntityDataPacket` (ID 40) when changed.

Head rotation is tracked separately and sent via `RotateHeadPacket` (ID 35) when the delta exceeds the tolerance.

### Broadcasting with splitscreen awareness

`TrackedEntity::broadcast()` is splitscreen-aware:

- If the packet has `sendToAnyClient` set, it skips sending to players who share a system with someone who already got the packet. It builds a `sentTo` list and checks `INetworkPlayer::IsSameSystem()`.
- If `sendToAnyClient` is not set, it just sends to everyone in `seenBy`.

### Entity spawn packets

When a player enters an entity's range, `TrackedEntity::updatePlayer()` sends:

1. The appropriate spawn packet (via `getAddEntityPacket()`):
   - Players: `AddPlayerPacket` (ID 20) with XUID, position, rotation, and head rotation
   - Mobs/Creatures: `AddMobPacket` (ID 24) with mob type, position, rotation, head rotation
   - Items: `AddEntityPacket` (ID 23) with type `ITEM`
   - Projectiles: `AddEntityPacket` (ID 23) with type-specific data (owner ID, potion value, etc.)
   - Paintings: `AddPaintingPacket` (ID 25)
   - XP orbs: `AddExperienceOrbPacket` (ID 26)
   - Item frames: `AddEntityPacket` with snapped tile position
   - Fireballs: `AddEntityPacket` with velocity encoded as `power * 8000`
2. Entity metadata via `SetEntityDataPacket` (ID 40) if the entity has metadata and the spawn packet was not `AddMobPacket` (which includes metadata)
3. Velocity via `SetEntityMotionPacket` (ID 28) if `trackDelta` is true
4. Riding state via `SetRidingPacket` (ID 39) if the entity is mounted
5. Equipment via `SetEquippedItemPacket` (ID 5) for each slot
6. Sleep state via `EntityActionAtPositionPacket` (ID 17) if the entity is a sleeping player
7. Active potion effects via `UpdateMobEffectPacket` (ID 41) for each effect on mobs

When a player leaves an entity's range, the entity ID is added to `sp->entitiesToRemove` for batch removal via `RemoveEntitiesPacket` (ID 29).

## Block change propagation

Block changes flow through several packets depending on scope:

- **Single block**: `TileUpdatePacket` (ID 53) sends the block position, block ID, data value, and level index.
- **Multi-block in a chunk**: `ChunkTilesUpdatePacket` (ID 52) batches multiple block changes within a single chunk section.
- **Region update**: `BlockRegionUpdatePacket` (ID 51) sends a rectangular volume of block data as a compressed byte buffer. Fields: origin (`x, y, z`), size (`xs, ys, zs`), `buffer`, `levelIdx`, and `bIsFullChunk` flag.
- **Chunk visibility**: `ChunkVisibilityPacket` (ID 50) toggles whether a chunk column is visible (loaded) on the client.
- **Chunk area visibility**: `ChunkVisibilityAreaPacket` (ID 155) sends `m_minX`, `m_maxX`, `m_minZ`, `m_maxZ` for the initial join.
- **Block events**: `TileEventPacket` (ID 54) handles interactive block state (pistons, chests, note blocks).
- **Block destruction**: `TileDestructionPacket` (ID 55) shows block break progress.
- **Explosions**: `ExplodePacket` (ID 60) sends the explosion center and list of affected block positions.

The `PlayerList` has two methods that help with block updates:
- `isTrackingTile(x, y, z, dimension)`: checks if any player is tracking a given position
- `prioritiseTileChanges(x, y, z, dimension)`: bumps the priority of tile changes near players

## LAN / splitscreen multiplayer

LAN multiplayer is the core feature of LCE. The architecture supports multiple local players on a single console (splitscreen) alongside remote players over the network.

### Local vs. remote connections

The `Socket` class tells connections apart through the `m_hostLocal` flag:
- **Host's local connection**: Uses static in-memory queues (`s_hostQueue[2]`) shared between client and server ends, protected by `s_hostQueueLock[2]`. No serialization to the network happens.
- **Remote connections**: Use per-socket `m_queueNetwork[2]` and `m_queueLockNetwork[2]`, which push data through `INetworkPlayer::SendData()` to the platform networking layer.

### The sendToAnyClient system

A key 4J addition is the `sendToAnyClient` parameter on packet registration. When set to `false`, the server sends the packet to only one player per dimension per machine instead of broadcasting to everyone. This is a splitscreen optimization: since multiple local players share the same screen/system, sending duplicate world data to each one would be wasteful. The `Packet::canSendToAnyClient()` check handles this at send time.

Packets like chunk data (`ChunkVisibilityPacket`, `BlockRegionUpdatePacket`, `TileUpdatePacket`) are marked `sendToAnyClient = true` because all players need world state. Packets like `SetTimePacket` (ID 4) or `AddMobPacket` (ID 24) are `sendToAnyClient = false` since they only need to reach each machine once.

The `receiveAllPlayers[3]` array in `PlayerList` tracks which player per dimension per machine should receive all packet types. Methods:
- `addPlayerToReceiving()`: adds a player to the receiving list
- `removePlayerFromReceiving()`: removes a player
- `canReceiveAllPackets()`: checks if a given player is the designated receiver for their system/dimension

### Session management

`CGameNetworkManager` coordinates session lifecycle:
- `HostGame()` creates a session with configurable public/private slots (up to `MINECRAFT_NET_MAX_PLAYERS`)
- `JoinGame()` connects to a discovered session
- `SetLocalGame()` / `SetPrivateGame()` control session visibility
- `IsLocalGame()` tells LAN-only from online sessions apart
- Player change callbacks notify the game when players join or leave

### Platform network backends

Each console platform has its own `CPlatformNetworkManager` and `INetworkPlayer` implementations:

| Platform | Network Manager | Transport |
|----------|----------------|-----------|
| Xbox 360 | `CPlatformNetworkManagerXbox` | QNET |
| Xbox One (Durango) | `CPlatformNetworkManagerDurango` | QNET / DQR |
| PS3 | `CPlatformNetworkManagerSony` | SQR |
| PS Vita | `CPlatformNetworkManagerSony` | SQR (+ ad-hoc mode) |
| PS4 (Orbis) | `CPlatformNetworkManagerSony` | SQR |
| Stub (PC/debug) | `CPlatformNetworkManagerStub` | Stub/QNET stub |

The PS Vita also supports **ad-hoc mode** for direct wireless connections between consoles without network infrastructure, exposed through `CGameNetworkManager::usingAdhocMode()` and `setAdhocMode()`.

## Key source files

| File | Location |
|------|----------|
| `Packet.h` / `Packet.cpp` | `Minecraft.World/` |
| `PacketListener.h` / `PacketListener.cpp` | `Minecraft.World/` |
| `Connection.h` / `Connection.cpp` | `Minecraft.World/` |
| `Socket.h` | `Minecraft.World/` |
| `ClientConnection.h` / `ClientConnection.cpp` | `Minecraft.Client/` |
| `PlayerConnection.h` / `PlayerConnection.cpp` | `Minecraft.Client/` |
| `PendingConnection.h` / `PendingConnection.cpp` | `Minecraft.Client/` |
| `ServerConnection.h` / `ServerConnection.cpp` | `Minecraft.Client/` |
| `EntityTracker.h` / `EntityTracker.cpp` | `Minecraft.Client/` |
| `TrackedEntity.h` / `TrackedEntity.cpp` | `Minecraft.Client/` |
| `GameNetworkManager.h` / `GameNetworkManager.cpp` | `Minecraft.Client/Common/Network/` |
| `PlatformNetworkManagerInterface.h` | `Minecraft.Client/Common/Network/` |
| `NetworkPlayerInterface.h` | `Minecraft.Client/Common/Network/` |
| `Network Implementation Notes.txt` | `Minecraft.Client/` |

## MinecraftConsoles differences

MC registers **104 packets** compared to LCEMP's **98**. The core networking architecture (Socket, Connection, PacketListener, client/server split) is the same. Here are the new packets:

### New packets in MC

| ID | Packet | Direction | Purpose |
|----|--------|-----------|---------|
| 39 | `SetEntityLinkPacket` | S->C | Leash connections between entities (leads attached to fence posts) |
| 44 | `UpdateAttributesPacket` | S->C | Syncs entity attribute values (health, speed, etc.) to the client |
| 63 | `LevelParticlesPacket` | S->C | Spawns particle effects at a position with configurable parameters |
| 133 | `TileEditorOpenPacket` | S->C | Opens the command block editing UI on the client |
| 206 | `SetObjectivePacket` | S->C | Creates/updates/removes a scoreboard objective |
| 207 | `SetScorePacket` | S->C | Updates a score value on the scoreboard |
| 208 | `SetDisplayObjectivePacket` | S->C | Sets which objective appears in a display slot |
| 209 | `SetPlayerTeamPacket` | S->C | Creates/updates/removes a player team |

### Changes to existing packets

- **`AddMobPacket` (ID 24)**: In MC, this packet can also carry initial attribute data for the spawned mob, since the attribute system needs to sync on spawn.
- **`SetEntityDataPacket` (ID 40)**: Same structure, but MC mobs can have more synched data fields (like horse type, wither invulnerability timer, etc.)
- **Packet IDs 39 and 44**: In LCEMP these IDs are unused. MC assigns them to `SetEntityLinkPacket` and `UpdateAttributesPacket`.

### Platform backends

The platform networking layer is the same in both codebases. Both support Xbox 360/One, PS3/PS4/Vita, and the stub backend. The `sendToAnyClient` optimization, local socket system, and splitscreen handling are identical.
