---
title: Tutorial System
description: The full tutorial system in LCE with states, hints, tasks, and constraints.
---

LCE has a full tutorial system built by 4J Studios that guides new players through the basics of Minecraft. The tutorial runs in a special pre-built world with area-based triggers, crafting tasks, and a hint system that teaches controls and mechanics. Tutorial progress is stored in the player's profile as a 512-bit bitmask.

## Architecture

The tutorial system spans several directories and classes:

```
Common/Tutorial/
├── Tutorial.h              # Base tutorial class
├── FullTutorial.h          # Full tutorial with progress tracking
├── FullTutorialMode.h      # Game mode for tutorial worlds
├── TutorialMode.h          # Base tutorial game mode
├── TutorialEnum.h          # All states, hints, and telemetry enums
├── TutorialTask.h          # Base task class
├── TutorialTasks.h         # Task subclasses (20+ task types)
├── TutorialHint.h          # Base hint class
├── TutorialHints.h         # Hint subclasses
├── TutorialConstraint.h    # Base constraint class
├── TutorialConstraints.h   # Constraint subclasses
├── TutorialMessage.h       # Tutorial popup messages
├── FullTutorialActiveTask.h # Active task manager
└── (20+ .cpp implementations)
```

### Tutorial (base class)

`Tutorial` is the central manager. Each local player gets their own instance. It holds the current state, active tasks, hints, constraints, and handles popup message display through the UI.

```cpp
class Tutorial {
    eTutorial_State m_CurrentState;
    vector<TutorialTask *> tasks;
    vector<TutorialTask *> activeTasks[e_Tutorial_State_Max];
    vector<TutorialHint *> hints[e_Tutorial_State_Max];
    vector<TutorialConstraint *> constraints[e_Tutorial_State_Max];
    TutorialTask *currentTask[e_Tutorial_State_Max];

    int m_iPad;                    // which player this tutorial belongs to
    bool m_allTutorialsComplete;
    bool m_fullTutorialComplete;
    bool m_isFullTutorial;
};
```

The tutorial fires every game tick. It checks if the current task is complete, advances to the next one, evaluates hint triggers, and manages the popup UI.

## Game Modes

The tutorial uses a chain of game mode classes:

```
MultiPlayerGameMode
  └── TutorialMode          # Base: overrides block breaking, item use, input
        └── FullTutorialMode  # Full tutorial with task execution
              ├── ConsoleGameMode  # Normal gameplay (isImplemented = true)
              └── TrialMode        # Demo version (see Trial Mode section)
```

### TutorialMode

**File**: `Common/Tutorial/TutorialMode.h`

The base tutorial game mode that hooks into gameplay events:

| Override | What it does |
|---|---|
| `startDestroyBlock()` | Can block the player from breaking certain blocks |
| `destroyBlock()` | Tracks block breaking for tutorial tasks |
| `tick()` | Runs tutorial logic each game tick |
| `useItemOn()` | Tracks item usage on blocks |
| `attack()` | Tracks combat actions |
| `isInputAllowed()` | Can restrict player input during tutorial steps |

`TutorialMode` owns a `Tutorial*` pointer that manages the actual tutorial state.

### FullTutorialMode

Extends `TutorialMode` with the full tutorial task execution system. This is the game mode used when the player starts a tutorial world.

### ConsoleGameMode

**File**: `Common/ConsoleGameMode.h`

A simple class that extends `TutorialMode` and just returns `true` from `isImplemented()`. This is the normal game mode used during regular gameplay. It inherits the tutorial infrastructure but doesn't activate any tutorial logic.

## Tutorial States

**File**: `Common/Tutorial/TutorialEnum.h`

The `eTutorial_State` enum defines 30+ states that the tutorial can be in. Each state represents a phase of the tutorial:

| State | What the player learns |
|---|---|
| `Gameplay` | Free play with hints |
| `Inventory_Menu` | Opening and using the inventory |
| `Crafting_Menu_2x2` | Crafting with the 2x2 grid |
| `Crafting_Menu_3x3` | Crafting with a crafting table |
| `Furnace` | Using the furnace |
| `Riding` | Riding entities |
| `Bed` | Sleeping in beds |
| `Portal` | Using nether portals |
| `CreativeMode` | Creative mode basics |
| `Brewing` | Brewing potions |
| `Enchanting` | Enchanting items |
| `Farming` | Growing crops |
| `Breeding` | Breeding animals |
| `Golem` | Building iron golems |
| `Trading` | Trading with villagers |
| `Anvil` | Using the anvil |
| `Enderchests` | Using ender chests |

States can transition to each other based on player actions and task completion.

## Tutorial Hints

The `eTutorial_Hint` enum defines 200+ hints covering every block, mob, and item in the game. Hints are the popup messages that appear when the player encounters something new. Examples include:

- Block hints: dirt, stone, wood, ore types, crafting table, furnace, etc.
- Mob hints: zombie, skeleton, creeper, spider, enderman, etc.
- Item hints: sword, pickaxe, bow, food items, potions, etc.
- Mechanic hints: swimming, falling, night time, rain, etc.

Hints are displayed through `UIComponent_TutorialPopup` in the UI system.

### Hint Trigger Types

```cpp
enum eHintType {
    e_Hint_DiggerItem,      // tool usage hint
    e_Hint_HoldToMine,      // hold button to mine
    e_Hint_NoIngredients,   // missing crafting ingredients
    e_Hint_ToolDamaged,     // tool durability warning
    e_Hint_TakeItem,        // pick up an item
    e_Hint_Area,            // entered a specific area
    e_Hint_LookAtTile,      // looked at a specific block
    e_Hint_LookAtEntity,    // looked at a specific mob
    e_Hint_SwimUp,          // drowning, swim up
};
```

### Hint Subclasses

Different hint types trigger in different ways:

| Class | Trigger |
|---|---|
| `AreaHint` | Player enters a specific area |
| `LookAtTileHint` | Player looks at a specific block type |
| `LookAtEntityHint` | Player looks at a specific mob type |
| `TakeItemHint` | Player picks up a specific item |
| `DiggerItemHint` | Player uses a digging tool |

## Tutorial Tasks

Tasks are the objectives the player needs to complete. Each task has a description (localized string ID), a prompt (action text), pre-completion support (skip if already done), constraints (restrictions while the task is current), and a completion action. The base `TutorialTask` class provides:

```cpp
class TutorialTask {
    virtual bool isCompleted() = 0;
    virtual void taskCompleted();
    virtual void setAsCurrentTask(bool active = true);
    virtual void enableConstraints(bool enable, bool delayRemove = false);
};
```

### Task Subclasses

| Class | What the player must do |
|---|---|
| `CraftTask` | Craft a specific item |
| `PickupTask` | Pick up a specific item |
| `UseItemTask` | Use a specific item |
| `UseTileTask` | Use (right-click) a specific block |
| `CompleteUsingItemTask` | Complete an action using a specific item |
| `ControllerTask` | Press a specific button or input |
| `AreaTask` | Enter a specific area in the tutorial world |
| `EffectChangedTask` | Get a specific status effect |
| `StatTask` | Reach a certain stat value |
| `ProgressFlagTask` | Reach a progress milestone |
| `StateChangeTask` | Transition to a specific tutorial state |
| `InfoTask` | Read an information popup |
| `ChoiceTask` | Make a choice between options |
| `ProcedureCompoundTask` | Complete multiple sub-tasks in order |
| `XuiCraftingTask` | Craft something using the XUI crafting menu (Xbox) |

## Tutorial Constraints

Constraints restrict what the player can do during certain tutorial states. They prevent the player from skipping ahead or getting lost.

| Class | What it restricts |
|---|---|
| `AreaConstraint` | Keeps the player within a specific area |
| `InputConstraint` | Blocks certain inputs (movement, combat, etc.) |
| `ChangeStateConstraint` | Prevents state transitions until conditions are met |

## Progress Storage

Tutorial progress is stored in the player's profile data as a compact bitmask:

```cpp
#define TUTORIAL_PROFILE_STORAGE_BITS  512
#define TUTORIAL_PROFILE_STORAGE_BYTES 64
```

That is 64 bytes of binary data stored in the `GAME_SETTINGS` struct. It tracks:

- Which tutorial states have been completed
- Which hints have been shown
- Progress flags for multi-step tasks

### FullTutorial Progress

The `FullTutorial` class (extending `Tutorial`) adds more detailed progress tracking:

```cpp
// FullTutorial.h
bool isTrial;                    // true if this is trial/demo mode
int progressFlags;               // bitmask of progress stages
bool completedStates[];          // which states are done
```

The `progressFlags` bitmask tracks 5 major progress stages:

| Flag | Value | Milestone |
|---|---|---|
| `FULL_TUTORIAL_PROGRESS_2_X_2_Crafting` | 1 | Completed 2x2 crafting |
| `FULL_TUTORIAL_PROGRESS_3_X_3_Crafting` | 2 | Completed 3x3 crafting |
| `FULL_TUTORIAL_PROGRESS_CRAFT_FURNACE` | 4 | Crafted a furnace |
| `FULL_TUTORIAL_PROGRESS_USE_FURNACE` | 8 | Used a furnace |
| `EXTENDED_TUTORIAL_PROGRESS_USE_BREWING_STAND` | 16 | Used a brewing stand |

## Tutorial Popup UI

The tutorial uses `UIComponent_TutorialPopup` (on the console UI system) or an XUI scene (on Xbox 360) to display messages. The popup has a title label, a description label, an icon holder that can show item icons or category icons, and fade-in/out timers. It can also shift the scene behind it to the side so the popup does not overlap gameplay.

Icon types:

| Icon | Description |
|---|---|
| `e_ICON_TYPE_IGGY` | Iggy/SWF icon |
| `e_ICON_TYPE_ARMOUR` | Armor category |
| `e_ICON_TYPE_BREWING` | Brewing category |
| `e_ICON_TYPE_DECORATION` | Decoration category |
| `e_ICON_TYPE_FOOD` | Food category |
| `e_ICON_TYPE_MATERIALS` | Materials category |
| `e_ICON_TYPE_MECHANISMS` | Mechanisms category |
| `e_ICON_TYPE_MISC` | Miscellaneous |
| `e_ICON_TYPE_REDSTONE_AND_TRANSPORT` | Redstone and transport |
| `e_ICON_TYPE_STRUCTURES` | Structures category |
| `e_ICON_TYPE_TOOLS` | Tools category |
| `e_ICON_TYPE_TRANSPORT` | Transport category |

## Game Code Integration

The tutorial hooks into many game systems through methods on the `Tutorial` class:

| Method | Called when |
|---|---|
| `useItemOn(level, item, x, y, z)` | Player uses an item on a block |
| `completeUsingItem(item)` | Player finishes using an item |
| `startDestroyBlock(item, tile)` | Player starts breaking a block |
| `destroyBlock(tile)` | Player finishes breaking a block |
| `attack(player, entity)` | Player attacks an entity |
| `itemDamaged(item)` | A tool takes durability damage |
| `handleUIInput(action)` | A UI action was performed |
| `createItemSelected(item, canMake)` | Player selected a recipe in creative/crafting |
| `onCrafted(item)` | Player crafted an item |
| `onTake(item, countAnyAux, countThisAux)` | Player picked up an item |
| `onSelectedItemChanged(item)` | Hotbar selection changed |
| `onLookAt(id, data)` | Player is looking at a block |
| `onLookAtEntity(type)` | Player is looking at a mob |
| `onEffectChanged(effect, removed)` | A mob effect was gained or lost |

## Level Diff System

The tutorial world uses a diff system to apply binary patches to chunks. The `FullTutorial` uses a pre-built tutorial world with a specific layout:

```cpp
typedef struct {
    WORD index;
    DWORD diffsSize;
    BYTE *diffs;
    DWORD lastByteChanged;
} TutorialDiff_Chunk;

typedef struct {
    DWORD diffCount;
    TutorialDiff_Chunk *diffs;
} TutorialDiff_File;
```

These are binary diffs applied to chunks to set up the tutorial world from a base world template. The freeze time value (`TUTORIAL_FREEZE_TIME_VALUE = 8000`) keeps the sun at morning position during the tutorial.

## Tutorial Telemetry

The tutorial system has its own telemetry events:

```cpp
enum eTutorial_Telemetry
{
    eTutorial_Telemetry_TrialStart,
    eTutorial_Telemetry_Halfway,
    eTutorial_Telemetry_Complete
};
```

These fire at the start, midpoint, and completion of the tutorial to track completion rates.

## Completion Actions

When a task or state completes, the system can take different actions:

```cpp
enum eTutorial_CompletionAction
{
    eTutorial_CompletionAction_None,
    eTutorial_CompletionAction_Complete_State,
    eTutorial_CompletionAction_Complete_State_Gameplay_Constraints,
    eTutorial_CompletionAction_Jump_To_Last_Task
};
```

| Action | What happens |
|---|---|
| `None` | Nothing, just record completion |
| `Complete_State` | Mark the current state as done, move to next |
| `Complete_State_Gameplay_Constraints` | Complete state and remove gameplay constraints |
| `Jump_To_Last_Task` | Skip to the final task in the current state |

## Trial Mode

**File**: `Common/Trial/TrialMode.h`

`TrialMode` extends `FullTutorialMode` and is used for the demo/trial version of the game. It adds a gameplay timer that limits how long the player can play before being prompted to buy the full game.

```cpp
class TrialMode : public FullTutorialMode
{
public:
    virtual bool isImplemented() { return true; }
};
```

The timer UI is handled by `UIScene_Timer` and `UIScene_TrialExitUpsell` in the UI system.

## Key Files

| File | What it does |
|---|---|
| `Common/Tutorial/Tutorial.h` | Base tutorial class |
| `Common/Tutorial/FullTutorial.h` | Full tutorial with progress flags and completion tracking |
| `Common/Tutorial/TutorialMode.h` | Game mode that hooks into gameplay events |
| `Common/Tutorial/FullTutorialMode.h` | Game mode with full task execution |
| `Common/Tutorial/TutorialEnum.h` | All enums: 30+ states, 200+ hints, telemetry, completion actions |
| `Common/Tutorial/TutorialTask.h` | Base task class |
| `Common/Tutorial/TutorialTasks.h` | 15+ task subclasses |
| `Common/Tutorial/TutorialHint.h` | Base hint class |
| `Common/Tutorial/TutorialHints.h` | Hint subclasses (area, look-at, take-item, etc.) |
| `Common/Tutorial/TutorialConstraint.h` | Base constraint class |
| `Common/Tutorial/TutorialConstraints.h` | Constraint subclasses (area, input, state) |
| `Common/Tutorial/TutorialMessage.h` | Tutorial popup message handling |
| `Common/ConsoleGameMode.h` | Normal game mode (extends TutorialMode) |
| `Common/Trial/TrialMode.h` | Demo mode with timer |
| `Common/App_structs.h` | `GAME_SETTINGS` with 64-byte tutorial progress data |
