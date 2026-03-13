---
title: Packet ID Registry
description: Complete table of all network packet IDs in LCEMP.
---

Every packet in LCEMP is registered in `Packet::staticCtor()` inside `Minecraft.World/Packet.cpp`. The `map()` call signature is:

```cpp
map(id, receiveOnClient, receiveOnServer, sendToAnyClient, renderStats, typeid, createFn)
```

**Direction key:**

- **S->C** -- Server sends to client (`receiveOnClient = true`, `receiveOnServer = false`)
- **C->S** -- Client sends to server (`receiveOnClient = false`, `receiveOnServer = true`)
- **Both** -- Either direction (`receiveOnClient = true`, `receiveOnServer = true`)

## Packet Table

| ID | Class Name | Direction | Broadcast | Purpose |
|----|-----------|-----------|-----------|---------|
| 0 | `KeepAlivePacket` | Both | yes | Connection keepalive heartbeat |
| 1 | `LoginPacket` | Both | yes | Login / session establishment |
| 2 | `PreLoginPacket` | Both | yes | Pre-login handshake |
| 3 | `ChatPacket` | Both | yes | Chat message |
| 4 | `SetTimePacket` | S->C | no | Set world time |
| 5 | `SetEquippedItemPacket` | S->C | no | Set entity equipped item |
| 6 | `SetSpawnPositionPacket` | S->C | yes | Set world spawn position |
| 7 | `InteractPacket` | C->S | no | Player interact with entity |
| 8 | `SetHealthPacket` | S->C | yes | Set player health / food / saturation |
| 9 | `RespawnPacket` | Both | yes | Player respawn / dimension change |
| 10 | `MovePlayerPacket` | Both | yes | Full player movement |
| 11 | `MovePlayerPacket::Pos` | Both | yes | Player position only |
| 12 | `MovePlayerPacket::Rot` | Both | yes | Player rotation only |
| 13 | `MovePlayerPacket::PosRot` | Both | yes | Player position and rotation |
| 14 | `PlayerActionPacket` | C->S | no | Block dig / drop / swap actions |
| 15 | `UseItemPacket` | C->S | no | Right-click / place block |
| 16 | `SetCarriedItemPacket` | C->S | no | Change held item slot |
| 17 | `EntityActionAtPositionPacket` | S->C | yes | Entity action at position (sleep in bed) |
| 18 | `AnimatePacket` | Both | yes | Entity animation (arm swing, etc.) |
| 19 | `PlayerCommandPacket` | C->S | no | Player command (sneak, sprint, etc.) |
| 20 | `AddPlayerPacket` | S->C | no | Spawn named player entity |
| 22 | `TakeItemEntityPacket` | S->C | yes | Entity picks up item |
| 23 | `AddEntityPacket` | S->C | no | Spawn object / vehicle entity |
| 24 | `AddMobPacket` | S->C | no | Spawn mob entity |
| 25 | `AddPaintingPacket` | S->C | no | Spawn painting entity |
| 26 | `AddExperienceOrbPacket` | S->C | no | Spawn experience orb (added 1.8.2) |
| 28 | `SetEntityMotionPacket` | S->C | yes | Set entity velocity (knockback) |
| 29 | `RemoveEntitiesPacket` | S->C | no | Destroy / remove entities |
| 30 | `MoveEntityPacket` | S->C | no | Entity movement (base) |
| 31 | `MoveEntityPacket::Pos` | S->C | no | Entity relative position |
| 32 | `MoveEntityPacket::Rot` | S->C | no | Entity rotation |
| 33 | `MoveEntityPacket::PosRot` | S->C | no | Entity relative position + rotation |
| 34 | `TeleportEntityPacket` | S->C | no | Entity teleport (absolute position) |
| 35 | `RotateHeadPacket` | S->C | no | Entity head rotation (added 1.2.3) |
| 38 | `EntityEventPacket` | S->C | yes | Entity status event (damage, death, etc.) |
| 39 | `SetRidingPacket` | S->C | yes | Attach entity to vehicle |
| 40 | `SetEntityDataPacket` | S->C | yes | Entity metadata (synched data) |
| 41 | `UpdateMobEffectPacket` | S->C | yes | Apply / update mob potion effect |
| 42 | `RemoveMobEffectPacket` | S->C | yes | Remove mob potion effect |
| 43 | `SetExperiencePacket` | S->C | yes | Set player experience bar |
| 50 | `ChunkVisibilityPacket` | S->C | yes | Chunk load / unload notification |
| 51 | `BlockRegionUpdatePacket` | S->C | yes | Full chunk data transfer |
| 52 | `ChunkTilesUpdatePacket` | S->C | yes | Multiple block changes in a chunk |
| 53 | `TileUpdatePacket` | S->C | yes | Single block change |
| 54 | `TileEventPacket` | S->C | yes | Block action (note block, piston, chest) |
| 55 | `TileDestructionPacket` | S->C | no | Block break animation progress (added 1.3.2) |
| 60 | `ExplodePacket` | S->C | yes | Explosion event |
| 61 | `LevelEventPacket` | S->C | yes | Level event (sounds, particles) |
| 62 | `LevelSoundPacket` | S->C | yes | Named sound event (added 1.3.2) |
| 70 | `GameEventPacket` | S->C | no | Game state change (rain, credits, etc.) |
| 71 | `AddGlobalEntityPacket` | S->C | no | Spawn global entity (lightning bolt) |
| 100 | `ContainerOpenPacket` | S->C | yes | Open container window |
| 101 | `ContainerClosePacket` | Both | yes | Close container window |
| 102 | `ContainerClickPacket` | C->S | no | Click slot in container |
| 103 | `ContainerSetSlotPacket` | Both | yes | Set single container slot |
| 104 | `ContainerSetContentPacket` | S->C | yes | Set entire container contents |
| 105 | `ContainerSetDataPacket` | S->C | yes | Update container property (furnace progress, etc.) |
| 106 | `ContainerAckPacket` | Both | yes | Container transaction acknowledgement |
| 107 | `SetCreativeModeSlotPacket` | Both | yes | Creative mode inventory action (added 1.8.2) |
| 108 | `ContainerButtonClickPacket` | C->S | no | Button click in container (added 1.0.1) |
| 130 | `SignUpdatePacket` | Both | yes | Edit sign text |
| 131 | `ComplexItemDataPacket` | S->C | yes | Map item data |
| 132 | `TileEntityDataPacket` | S->C | no | Tile entity NBT data (added 1.0.1) |
| 150 | `CraftItemPacket` | C->S | no | Craft item request (4J added) |
| 151 | `TradeItemPacket` | C->S | yes | Villager trade request (4J added) |
| 152 | `DebugOptionsPacket` | C->S | no | Debug options toggle (4J added) |
| 153 | `ServerSettingsChangedPacket` | Both | no | Server settings sync (4J added) |
| 154 | `TexturePacket` | Both | yes | Texture pack data (4J added) |
| 155 | `ChunkVisibilityAreaPacket` | S->C | yes | Chunk visibility area bounds (4J added) |
| 156 | `UpdateProgressPacket` | S->C | no | Loading / generation progress (4J added) |
| 157 | `TextureChangePacket` | Both | yes | Texture pack change notification (4J added) |
| 158 | `UpdateGameRuleProgressPacket` | S->C | yes | Game rule progress update (4J added) |
| 159 | `KickPlayerPacket` | C->S | no | Kick player request (4J added) |
| 160 | `TextureAndGeometryPacket` | Both | yes | Texture + geometry pack data (4J added) |
| 161 | `TextureAndGeometryChangePacket` | Both | yes | Texture + geometry change (4J added) |
| 162 | `MoveEntityPacketSmall` | S->C | no | Small entity movement (base, 4J added) |
| 163 | `MoveEntityPacketSmall::Pos` | S->C | no | Small entity relative position (4J added) |
| 164 | `MoveEntityPacketSmall::Rot` | S->C | no | Small entity rotation (4J added) |
| 165 | `MoveEntityPacketSmall::PosRot` | S->C | no | Small entity position + rotation (4J added) |
| 166 | `XZPacket` | Both | no | XZ coordinate packet (4J added) |
| 167 | `GameCommandPacket` | C->S | no | In-game command execution (4J added) |
| 200 | `AwardStatPacket` | S->C | yes | Award statistic to player |
| 201 | `PlayerInfoPacket` | Both | no | Player list info (repurposed by 4J, 1.8.2) |
| 202 | `PlayerAbilitiesPacket` | Both | yes | Player abilities (fly, creative, etc., added 1.3.2) |
| 205 | `ClientCommandPacket` | C->S | yes | Client command (respawn, stats, added 1.3.2) |
| 250 | `CustomPayloadPacket` | Both | yes | Plugin channel / custom payload (added 1.1 / TU9) |
| 254 | `GetInfoPacket` | C->S | no | Server list ping (added 1.8.2) |
| 255 | `DisconnectPacket` | Both | yes | Disconnect / kick reason |

**Total registered packets: 88** (IDs 0--255, with gaps)

## Unused / Commented-Out IDs

The following IDs appear in comments but are not registered:

| ID | Class Name | Notes |
|----|-----------|-------|
| 21 | *(gap)* | No packet registered at this ID |
| 27 | `PlayerInputPacket` | Commented out |
| 203 | `ChatAutoCompletePacket` | "Don't think we need them" (1.3.2) |
| 204 | `ClientInformationPacket` | "Don't think we need them" (1.3.2) |
| 252 | `SharedKeyPacket` | "Don't think we need them" (1.3.2) |
| 253 | `ServerAuthDataPacket` | "Don't think we need them" (1.3.2) |

## Notes

- The **Broadcast** column corresponds to the `sendToAnyClient` parameter. When `yes`, the packet is sent to all connected clients. When `no`, it is sent per-dimension per-machine (a 4J splitscreen optimization).
- Packets marked **(4J added)** are custom additions by 4J Studios for the Legacy Console Edition and do not exist in vanilla Java Edition.
- `MoveEntityPacketSmall` (162--165) is an optimized variant of `MoveEntityPacket` (30--33) for smaller position deltas.
- `ContainerSetSlotPacket` (103) has conditional direction: in non-content-package builds it can also be sent C->S for debug purposes.

**Source file:** `Minecraft.World/Packet.cpp`
