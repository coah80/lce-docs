---
title: Telemetry
description: The CTelemetryManager system that tracks gameplay events in LCE.
---

LCE includes a telemetry system built by 4J Studios that records gameplay events and sends them to an analytics backend (Sentient). The `CTelemetryManager` class tracks everything from session starts to combat events. This page documents what gets tracked and how the system works.

## CTelemetryManager

**File**: `Common/Telemetry/TelemetryManager.h`

The telemetry manager is a singleton accessed through a global pointer:

```cpp
extern CTelemetryManager *TelemetryManager;
```

### Lifecycle

The manager has a simple lifecycle:

| Method | When it runs |
|---|---|
| `Init()` | Game startup, initializes the Sentient SDK connection |
| `Tick()` | Every game tick, processes queued events |
| `Flush()` | Periodic flush, sends buffered data to the backend |
| `Shutdown()` | Game exit, final flush and cleanup |

### Session Tracking

Two methods bracket every play session:

- `RecordPlayerSessionStart()` -- called when the player enters a world
- `RecordPlayerSessionExit()` -- called when the player leaves

### Heartbeat

`RecordHeartBeat()` is called periodically during gameplay. It sends a status ping with the current game state so the backend can track active playtime and session health.

### Level Events

These methods track world loading and saving:

| Method | When it fires |
|---|---|
| `RecordLevelStart()` | Player enters or creates a world |
| `RecordLevelExit()` | Player leaves a world |
| `RecordLevelSave()` | World is saved (manual or autosave) |
| `RecordLevelResume()` | Player resumes a previously loaded world |
| `RecordPause()` | Game is paused |
| `RecordUnpause()` | Game is unpaused |

### Menu and UI Events

| Method | When it fires |
|---|---|
| `RecordMenuShown()` | A menu screen is displayed |
| `RecordUpsellPresented()` | A DLC purchase prompt is shown to the player |
| `RecordUpsellResponded()` | The player responds to a purchase prompt (buy or dismiss) |

### Achievement Tracking

`RecordAchievementUnlocked()` fires when a player unlocks an achievement/trophy. This is separate from the platform's native achievement system (Xbox Live, PSN trophies) -- it records the event in the telemetry stream for analytics.

### Media

`RecordMediaShareUpload()` fires when a player uploads a screenshot or recording through the platform's share features.

### Combat Events

| Method | When it fires |
|---|---|
| `RecordPlayerDiedOrFailed()` | Player dies or fails an objective |
| `RecordEnemyKilledOrOvercome()` | Player kills a mob or overcomes a challenge |

### Customization Events

| Method | When it fires |
|---|---|
| `RecordTexturePackLoaded()` | A texture pack is selected and loaded |
| `RecordSkinChanged()` | The player changes their skin |

### Ban Events

| Method | When it fires |
|---|---|
| `RecordBanLevel()` | A player is banned from a level |
| `RecordUnBanLevel()` | A player is unbanned |

## Helper Methods

The telemetry manager provides several helper methods that gather context for events:

| Method | What it returns |
|---|---|
| `GetSecondsSinceInitialize()` | Time elapsed since `Init()` was called |
| `GetMode()` | Current game mode (survival, creative, etc.) |
| `GetSubMode()` | Sub-mode within the current mode |
| `GetLevelId()` | Identifier for the current world/level |

These helpers are used internally to stamp each event with timing and context data.

## Sentient SDK

The actual transmission of telemetry data is handled by the Sentient SDK, a third-party analytics library. Sentient's headers are bundled per-platform:

- `Xbox/Sentient/Include/` (Xbox 360, with full SDK headers)
- `{Platform}/Sentient/` (other platforms)

The telemetry manager acts as a wrapper that translates game events into Sentient API calls. The Sentient SDK handles batching, compression, and network transmission to the analytics backend.

## What Gets Tracked

Here is a summary of every event type the telemetry system can record:

| Category | Events |
|---|---|
| **Session** | Start, exit, heartbeat |
| **Level** | Start, exit, save, resume, pause, unpause |
| **UI** | Menu shown, upsell presented, upsell responded |
| **Achievements** | Achievement unlocked |
| **Media** | Screenshot/recording upload |
| **Combat** | Player death, enemy killed |
| **Customization** | Texture pack loaded, skin changed |
| **Moderation** | Player banned, player unbanned |

## Key Files

| File | What it does |
|---|---|
| `Common/Telemetry/TelemetryManager.h` | Manager class declaration with all recording methods |
| `Common/Telemetry/TelemetryManager.cpp` | Implementation (wraps Sentient SDK calls) |
| `{Platform}/Sentient/` | Platform-specific Sentient SDK headers |
