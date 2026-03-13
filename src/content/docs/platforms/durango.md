---
title: Xbox One (Durango)
description: Xbox One platform implementation.
---

The Xbox One port (codenamed "Durango") lives in `Minecraft.Client/Durango/`. It's a big step up from the Xbox 360 version, moving from QNET to Xbox Realtime Networking Sessions (XRNS) and from XUI to the Iggy UI framework.

## Key Files

| File | Purpose |
|------|---------|
| `Durango_App.h` | `CConsoleMinecraftApp` application class |
| `Durango_Minecraft.cpp` | Entry point, main game loop |
| `Durango_UIController.h/.cpp` | `ConsoleUIController` using Iggy + D3D11 |
| `Network/PlatformNetworkManagerDurango.h/.cpp` | Platform network manager |
| `Network/DQRNetworkManager.h/.cpp` | Low-level XRNS networking |
| `Network/DQRNetworkPlayer.h/.cpp` | Xbox One network player |
| `Network/DQRNetworkManager_SendReceive.cpp` | Data send/receive implementation |
| `Network/DQRNetworkManager_FriendSessions.cpp` | Friend session discovery |
| `Network/DQRNetworkManager_XRNSEvent.cpp` | XRNS event handling |
| `Network/DQRNetworkManager_Log.cpp` | Network debug logging |
| `Network/ChatIntegrationLayer.h/.cpp` | Voice chat integration |
| `Network/PartyController.h/.cpp` | Xbox party management |
| `Network/NetworkPlayerDurango.h/.cpp` | Durango-specific player wrapper |
| `Achievements/AchievementManager.h/.cpp` | Xbox One achievements |
| `Social/SocialManager.h` | Social manager interface |
| `DurangoExtras/DurangoStubs.h/.cpp` | Compatibility stubs |
| `DurangoExtras/xcompress.h` | Compression header |
| `XML/ATGXmlParser.h/.cpp` | XML parser |
| `XboxGameMode.h/.cpp` | Xbox-specific game mode |

## Application Class

`CConsoleMinecraftApp` extends `CMinecraftApp` with Xbox One-specific features:

- **Xbox Live service config**: `SERVICE_CONFIG_ID` and `TITLE_PRODUCT_ID` for Xbox Live Services
- **DLC management**: `InitialiseDLCDetails`, `ReadLocalDLCList`, `HandleDLCLicenseChange`
- **TMS++**: Title Managed Storage with file list retrieval and DLC file callbacks
- **Save incomplete handling**: `Callback_SaveGameIncomplete` with a message box for insufficient storage
- **Shutdown management**: Graceful shutdown flag for PLM (Process Lifecycle Management) events
- **Rich presence**: Per-player presence tracking with `m_xuidLastPresencePlayer` array

## Rendering

Uses Direct3D 11 through the 4J render abstraction. The UI controller initializes with `Microsoft::WRL::ComPtr` smart pointers for D3D11 objects:

```cpp
void init(Microsoft::WRL::ComPtr<ID3D11Device> dev,
          Microsoft::WRL::ComPtr<ID3D11DeviceContext> ctx,
          Microsoft::WRL::ComPtr<ID3D11RenderTargetView> pRenderTargetView,
          Microsoft::WRL::ComPtr<ID3D11DepthStencilView> pDepthStencilView,
          S32 w, S32 h);
```

This is different from Windows 64 which uses raw pointers, since Xbox One is built on a WinRT/COM-based API.

## UI Controller

`ConsoleUIController` inherits from `UIController` (Iggy-based, not XUI like Xbox 360):

- Custom draw callbacks for tile rendering within Iggy regions
- GDraw texture substitution for dynamic textures
- Shutdown method for clean resource release

## Networking

The networking stack is the most complex of any platform, built on Xbox Realtime Networking Sessions (XRNS).

### Architecture

Three layers:
1. **`CPlatformNetworkManagerDurango`** is the game-facing interface implementing `CPlatformNetworkManager`
2. **`DQRNetworkManager`** handles the low-level XRNS session management
3. **`DQRNetworkManagerEventHandlers`** (WinRT ref class) handles XRNS events

### DQRNetworkManager

The core networking class manages:

- **Session lifecycle**: `CreateAndJoinSession`, `JoinSession`, `LeaveRoom`, `StartGame`
- **XRNS session**: `WXNRs::Session^` with event handlers for data received, address changes, status updates
- **Xbox Live multiplayer**: `MXSM::MultiplayerSession^` for matchmaking and session documents
- **Secure device associations**: `WXN::SecureDeviceAssociationTemplate^` for encrypted peer-to-peer
- **Party integration**: `PartyController` for the Xbox party system
- **Chat integration**: `ChatIntegrationLayer` for voice chat

### State Machine

There's an extensive internal state machine with these states:
- `INITIALISING` -> `IDLE`
- `HOSTING` -> `HOSTING_WAITING_TO_PLAY` -> `PLAYING`
- `JOINING` -> `JOINING_WAITING_FOR_RESERVATIONS` -> `JOINING_GET_SDA` -> `JOINING_CREATE_SESSION` -> `PLAYING`
- `LEAVING` / `ENDING`

### Player Synchronization

`RoomSyncData` struct synchronizes player information across machines:
- XUID (as decimal string)
- Session address (XRNS address)
- SmallId (permanent per-session player ID)
- Channel (local index within a machine)
- Player name (up to 21 characters)

### Message Threading

XRNS communication runs on a dedicated work thread with message queues:
- `m_RTSMessageQueueIncoming` for events from XRNS to main thread
- `m_RTSMessageQueueOutgoing` for commands from main thread to XRNS
- Both protected by `CRITICAL_SECTION` locks

Message types include: `DATA_RECEIVED`, `ADDED_SESSION_ADDRESS`, `REMOVED_SESSION_ADDRESS`, `STATUS_ACTIVE`, `STATUS_TERMINATED`, `START_CLIENT`, `START_HOST`, `TERMINATE`, `SEND_DATA`.

### Friend Session Discovery

Friend party search uses Xbox Live Social and Multiplayer services:
- `FriendPartyManagerSearch` lists friend parties
- `GetFriends` returns friend list as `Platform::String^` vector
- Permission filtering via `FilterPartiesByPermission`
- Session join with reservation waiting and retry logic (up to 5 attempts)

## Chat Integration

`ChatIntegrationLayer` provides voice chat through the Xbox One chat system, integrated with the party controller and session management.

## Party System

`PartyController` handles:
- Party membership changes
- Invite processing (`SetInviteReceivedFlag`, `SetPartyProcessJoinParty`)
- Boot-to-session from party invites
- Forced sign-out detection

## Achievements

`AchievementManager` in the `Achievements/` subdirectory manages Xbox One achievements. These use the newer event-based system rather than Xbox 360's direct achievement APIs.

## Unique Platform Features

- **WinRT integration**: Uses C++/CX with `ref class`, `Platform::String^`, `Windows::Foundation::Collections` throughout networking
- **Process Lifecycle Management**: Shutdown flag and graceful termination support for suspend/resume
- **Secure networking**: All peer-to-peer traffic is encrypted via Xbox Secure Device Associations
- **Party-first networking**: Players join via the Xbox party system rather than direct session search
- **Gamertag resolution**: Async display name lookups via Xbox Live profile service
- **DLC license changes**: Runtime handling of DLC license acquisition/revocation
- **Base64 encoding**: `base64.h/.cpp` for encoding session data in multiplayer documents
- **Build versioning**: `Xbox_BuildVer.h` for version tracking
- **Presence IDs**: `PresenceIds.h` for Xbox Live rich presence configuration
- **Service config**: `ServiceConfig/` directory with localized help documents and event definitions
