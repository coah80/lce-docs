# LCEMP Source Index

Master index of all classes and systems in `/Users/cole/Documents/LCEMP/`.

---

## Minecraft.Client -- Rendering

### Core Renderers
- `LevelRenderer.cpp/h` -- Main world renderer, manages chunk rendering, dimension render arrays
- `GameRenderer.cpp/h` -- Top-level game rendering (camera, HUD, overlays, post-processing)
- `EntityRenderDispatcher.cpp/h` -- Dispatches entity rendering to type-specific renderers
- `TileEntityRenderDispatcher.cpp/h` -- Dispatches tile entity rendering
- `TileRenderer.cpp/h` -- Block/tile rendering (block faces, tessellation)
- `ItemRenderer.cpp/h` -- 3D item rendering in world
- `ItemInHandRenderer.cpp/h` -- First-person held item rendering
- `ItemSpriteRenderer.cpp/h` -- 2D item sprite rendering
- `DefaultRenderer.cpp/h` -- Default/fallback entity renderer
- `ProgressRenderer.cpp/h` -- Loading/progress screen renderer

### Entity Renderers
- `ArrowRenderer.cpp/h` -- Arrow projectile rendering
- `BlazeRenderer.cpp/h` -- Blaze mob rendering
- `BoatRenderer.cpp/h` -- Boat entity rendering
- `ChestRenderer.cpp/h` -- Chest tile entity rendering
- `ChickenRenderer.cpp/h` -- Chicken mob rendering
- `CowRenderer.cpp/h` -- Cow mob rendering
- `CreeperRenderer.cpp/h` -- Creeper mob rendering
- `EnderDragonRenderer.cpp/h` -- Ender dragon boss rendering
- `EnderCrystalRenderer.cpp/h` -- End crystal rendering
- `EndermanRenderer.cpp/h` -- Enderman mob rendering
- `EnchantTableRenderer.cpp/h` -- Enchanting table tile entity rendering
- `EnderChestRenderer.cpp/h` -- Ender chest tile entity rendering
- `ExperienceOrbRenderer.cpp/h` -- XP orb rendering
- `FallingTileRenderer.cpp/h` -- Falling block rendering
- `FireballRenderer.cpp/h` -- Fireball projectile rendering
- `FishingHookRenderer.cpp/h` -- Fishing hook rendering
- `GhastRenderer.cpp/h` -- Ghast mob rendering
- `GiantMobRenderer.cpp/h` -- Giant zombie rendering
- `HumanoidMobRenderer.cpp/h` -- Base humanoid mob renderer
- `ItemFrameRenderer.cpp/h` -- Item frame entity rendering
- `LavaSlimeRenderer.cpp/h` -- Magma cube rendering
- `LightningBoltRenderer.cpp/h` -- Lightning bolt rendering
- `MinecartRenderer.cpp/h` -- Minecart rendering
- `MobRenderer.cpp/h` -- Base mob renderer class
- `MobSpawnerRenderer.cpp/h` -- Mob spawner tile entity rendering
- `MushroomCowRenderer.cpp/h` -- Mooshroom rendering
- `OzelotRenderer.cpp/h` -- Ocelot/cat rendering
- `PaintingRenderer.cpp/h` -- Painting entity rendering
- `PigRenderer.cpp/h` -- Pig mob rendering
- `PistonPieceRenderer.cpp/h` -- Piston moving piece rendering
- `PlayerRenderer.cpp/h` -- Player entity rendering
- `SheepRenderer.cpp/h` -- Sheep mob rendering
- `SignRenderer.cpp/h` -- Sign tile entity rendering
- `SilverfishRenderer.cpp/h` -- Silverfish mob rendering
- `SkullTileRenderer.cpp/h` -- Skull tile entity rendering
- `SlimeRenderer.cpp/h` -- Slime mob rendering
- `SnowManRenderer.cpp/h` -- Snow golem rendering
- `SpiderRenderer.cpp/h` -- Spider mob rendering
- `SquidRenderer.cpp/h` -- Squid mob rendering
- `TheEndPortalRenderer.cpp/h` -- End portal tile entity rendering
- `TileEntityRenderer.cpp/h` -- Base tile entity renderer class
- `TntRenderer.cpp/h` -- Primed TNT rendering
- `VillagerGolemRenderer.cpp/h` -- Iron golem rendering
- `VillagerRenderer.cpp/h` -- Villager NPC rendering
- `WolfRenderer.cpp/h` -- Wolf mob rendering
- `ZombieRenderer.cpp/h` -- Zombie mob rendering

### Models
- `Model.cpp/h` -- Base model class
- `ModelPart.cpp/h` -- Model part/bone
- `Cube.cpp/h` -- Cube geometry for models
- `Polygon.cpp/h` -- Polygon geometry
- `Vertex.cpp/h` -- Vertex data
- `HumanoidModel.cpp/h` -- Base humanoid model (biped)
- `QuadrupedModel.cpp/h` -- Base quadruped model
- `BlazeModel.cpp/h` -- Blaze model
- `BoatModel.cpp/h` -- Boat model
- `BookModel.cpp/h` -- Enchanting book model
- `ChestModel.cpp/h` -- Chest model
- `LargeChestModel.cpp/h` -- Double chest model
- `ChickenModel.cpp/h` -- Chicken model
- `CowModel.cpp/h` -- Cow model
- `CreeperModel.cpp/h` -- Creeper model
- `DragonModel.cpp/h` -- Ender dragon model
- `EnderCrystalModel.cpp/h` -- End crystal model
- `EndermanModel.cpp/h` -- Enderman model
- `GhastModel.cpp/h` -- Ghast model
- `LavaSlimeModel.cpp/h` -- Magma cube model
- `MinecartModel.cpp/h` -- Minecart model
- `OzelotModel.cpp/h` -- Ocelot model
- `PigModel.cpp/h` -- Pig model
- `SheepModel.cpp/h` -- Sheep model
- `SheepFurModel.cpp/h` -- Sheep wool overlay model
- `SignModel.cpp/h` -- Sign model
- `SilverfishModel.cpp/h` -- Silverfish model
- `SkeletonHeadModel.cpp/h` -- Skull model
- `SkeletonModel.cpp/h` -- Skeleton model
- `SlimeModel.cpp/h` -- Slime model
- `SnowManModel.cpp/h` -- Snow golem model
- `SpiderModel.cpp/h` -- Spider model
- `SquidModel.cpp/h` -- Squid model
- `VillagerGolemModel.cpp/h` -- Iron golem model
- `VillagerModel.cpp/h` -- Villager model
- `VillagerZombieModel.cpp/h` -- Zombie villager model
- `WolfModel.cpp/h` -- Wolf model
- `ZombieModel.cpp/h` -- Zombie model

### Particles
- `Particle.cpp/h` -- Base particle class
- `ParticleEngine.cpp/h` -- Particle system manager
- `BreakingItemParticle.cpp/h` -- Item break particles
- `BubbleParticle.cpp/h` -- Underwater bubble particles
- `CritParticle.cpp/h` -- Critical hit particles
- `CritParticle2.cpp/h` -- Enchanted critical hit particles
- `DragonBreathParticle.cpp/h` -- Dragon breath particles
- `DripParticle.cpp/h` -- Drip particles (water/lava)
- `EchantmentTableParticle.cpp/h` -- Enchantment table particles
- `EnderParticle.cpp/h` -- Enderman teleport particles
- `ExplodeParticle.cpp/h` -- Explosion particles
- `FlameParticle.cpp/h` -- Flame particles
- `FootstepParticle.cpp/h` -- Footstep particles
- `GuiParticle.cpp/h` -- GUI particle (menu background)
- `GuiParticles.cpp/h` -- GUI particle manager
- `HeartParticle.cpp/h` -- Heart/love particles
- `HugeExplosionParticle.cpp/h` -- Large explosion particles
- `HugeExplosionSeedParticle.cpp/h` -- Large explosion seed
- `LavaParticle.cpp/h` -- Lava drip particles
- `NetherPortalParticle.cpp/h` -- Nether portal particles
- `NoteParticle.cpp/h` -- Note block particles
- `PlayerCloudParticle.cpp/h` -- Sprint cloud particles
- `RedDustParticle.cpp/h` -- Redstone dust particles
- `SmokeParticle.cpp/h` -- Smoke particles
- `SnowShovelParticle.cpp/h` -- Snow shovel particles
- `SpellParticle.cpp/h` -- Spell/potion particles
- `SplashParticle.cpp/h` -- Water splash particles
- `SuspendedParticle.cpp/h` -- Void/suspended particles
- `SuspendedTownParticle.cpp/h` -- Mycelium particles
- `TakeAnimationParticle.cpp/h` -- Item pickup animation
- `TerrainParticle.cpp/h` -- Block break particles
- `WaterDropParticle.cpp/h` -- Water drop particles

### Textures
- `Texture.cpp/h` -- Base texture class
- `TextureManager.cpp/h` -- Texture loading and binding manager
- `TextureMap.cpp/h` -- Texture atlas/map
- `Textures.cpp/h` -- Texture constants/paths
- `TextureHolder.cpp/h` -- Texture reference holder
- `TexturePack.cpp/h` -- Texture pack base class
- `TexturePackRepository.cpp/h` -- Texture pack management
- `AbstractTexturePack.cpp/h` -- Abstract texture pack
- `DefaultTexturePack.cpp/h` -- Default texture pack
- `DLCTexturePack.cpp/h` -- DLC texture pack
- `FileTexturePack.cpp/h` -- File-based texture pack
- `FolderTexturePack.cpp/h` -- Folder-based texture pack
- `PreStitchedTextureMap.cpp/h` -- Pre-stitched texture atlas
- `StitchedTexture.cpp/h` -- Stitched texture
- `Stitcher.cpp/h` -- Texture stitcher/atlas builder
- `StitchSlot.cpp/h` -- Stitcher slot
- `BufferedImage.cpp/h` -- In-memory image buffer
- `MemTexture.cpp/h` -- Memory-backed texture
- `HttpTexture.cpp/h` -- HTTP-loaded texture (skins)
- `ClockTexture.cpp/h` -- Animated clock texture
- `CompassTexture.cpp/h` -- Animated compass texture
- `SimpleIcon.cpp/h` -- Simple texture icon
- `TexOffs.cpp/h` -- Texture offset data

### Rendering Infrastructure
- `Tesselator.cpp/h` -- Vertex buffer/tessellator for immediate-mode rendering
- `OffsettedRenderList.cpp/h` -- Offset render list (display lists)
- `Lighting.cpp/h` -- Lighting calculations
- `Camera.cpp/h` -- Camera system
- `Frustum.cpp/h` -- View frustum
- `FrustumCuller.cpp/h` -- Frustum culling
- `FrustumData.cpp/h` -- Frustum plane data
- `AllowAllCuller.cpp/h` -- No-op culler (allows all)
- `ViewportCuller.cpp/h` -- Viewport-based culling
- `Culler.h` -- Culler interface
- `Rect2i.cpp/h` -- 2D integer rectangle
- `Minimap.cpp/h` -- Minimap rendering
- `SkinBox.h` -- Skin rendering box

### Chunk Management (Client)
- `Chunk.cpp/h` -- Client-side chunk representation for rendering
- `DirtyChunkSorter.cpp/h` -- Sorts chunks by dirty state for re-rendering
- `DistanceChunkSorter.cpp/h` -- Sorts chunks by distance for render priority
- `MultiPlayerChunkCache.cpp/h` -- Multiplayer chunk cache
- `TrackedEntity.cpp/h` -- Client entity tracking
- `EntityTracker.cpp/h` -- Entity tracker system

---

## Minecraft.Client -- Screens/UI

### Core UI
- `Screen.cpp/h` -- Base screen class
- `GuiComponent.cpp/h` -- Base GUI component
- `Gui.cpp/h` -- In-game HUD overlay
- `GuiMessage.cpp/h` -- Chat message display
- `Button.cpp/h` -- Clickable button widget
- `SmallButton.cpp/h` -- Small button variant
- `SlideButton.cpp/h` -- Slider button
- `EditBox.cpp/h` -- Text input box
- `ScrolledSelectionList.cpp/h` -- Scrollable list widget
- `Font.cpp/h` -- Font rendering
- `ScreenSizeCalculator.cpp/h` -- Screen size/scaling

### Game Screens
- `TitleScreen.cpp/h` -- Main title/menu screen
- `PauseScreen.cpp/h` -- Pause menu
- `DeathScreen.cpp/h` -- Death screen
- `ChatScreen.cpp/h` -- Chat input screen
- `InBedChatScreen.cpp/h` -- Chat while in bed
- `OptionsScreen.cpp/h` -- Options menu
- `VideoSettingsScreen.cpp/h` -- Video settings
- `ControlsScreen.cpp/h` -- Controls settings
- `StatsScreen.cpp/h` -- Statistics screen
- `AchievementScreen.cpp/h` -- Achievements screen
- `AchievementPopup.cpp/h` -- Achievement popup notification
- `ErrorScreen.cpp/h` -- Error display screen
- `ConfirmScreen.cpp/h` -- Confirmation dialog
- `TextEditScreen.cpp/h` -- Sign text editing screen
- `NameEntryScreen.cpp/h` -- Name entry screen
- `TrapScreen.cpp/h` -- Hopper/dropper screen

### World/Server Screens
- `SelectWorldScreen.cpp/h` -- World selection
- `CreateWorldScreen.cpp/h` -- World creation
- `RenameWorldScreen.cpp/h` -- World rename
- `ReceivingLevelScreen.cpp/h` -- Loading/receiving level screen
- `ConnectScreen.cpp/h` -- Server connection screen
- `DisconnectedScreen.cpp/h` -- Disconnected message
- `JoinMultiplayerScreen.cpp/h` -- Multiplayer server list

### Container/Inventory Screens
- `AbstractContainerScreen.cpp/h` -- Base container screen
- `ContainerScreen.cpp/h` -- Generic container screen
- `InventoryScreen.cpp/h` -- Player inventory
- `CraftingScreen.cpp/h` -- Crafting table screen
- `FurnaceScreen.cpp/h` -- Furnace screen

---

## Minecraft.Client -- Input

- `Input.cpp/h` -- Base input handling
- `ConsoleInput.cpp/h` -- Console/gamepad input
- `ConsoleInputSource.h` -- Input source interface
- `KeyboardMouseInput.cpp/h` -- Keyboard and mouse input
- `KeyMapping.cpp/h` -- Key bindings

---

## Minecraft.Client -- Audio (Common/Audio/)

- `SoundEngine.cpp/h` -- Cross-platform sound engine
- `Consoles_SoundEngine.cpp/h` -- Console-specific sound engine
- `SoundNames.cpp` -- Sound name definitions
- `miniaudio.h` -- miniaudio library header

---

## Minecraft.Client -- Networking/Multiplayer

- `ClientConnection.cpp/h` -- Client network connection
- `PendingConnection.cpp/h` -- Pending connection state
- `PlayerConnection.cpp/h` -- Player network connection handler
- `ServerConnection.cpp/h` -- Server-side connection handler
- `PlayerList.cpp/h` -- Connected player list
- `PlayerChunkMap.cpp/h` -- Per-player chunk visibility
- `PlayerInfo.h` -- Player info data
- `LocalPlayer.cpp/h` -- Local player (singleplayer)
- `RemotePlayer.cpp/h` -- Remote player (multiplayer)
- `MultiPlayerLocalPlayer.cpp/h` -- Local player in multiplayer
- `MultiPlayerLevel.cpp/h` -- Multiplayer level
- `MultiPlayerGameMode.cpp/h` -- Multiplayer game mode handler

### Server (Integrated)
- `MinecraftServer.cpp/h` -- Integrated server
- `ServerLevel.cpp/h` -- Server-side level
- `ServerLevelListener.cpp/h` -- Server level event listener
- `ServerPlayer.cpp/h` -- Server-side player
- `ServerPlayerGameMode.cpp/h` -- Server-side game mode handler
- `DerivedServerLevel.cpp/h` -- Derived server level (Nether/End)
- `ServerChunkCache.cpp/h` -- Server chunk cache
- `ServerCommandDispatcher.cpp/h` -- Server command handling
- `ServerInterface.h` -- Server interface

---

## Minecraft.Client -- Game Logic

- `Minecraft.cpp/h` -- Main game class (entry point, game loop)
- `GameMode.cpp/h` -- Base game mode class
- `SurvivalMode.cpp/h` -- Survival game mode
- `CreativeMode.cpp/h` -- Creative game mode
- `DemoMode.cpp/h` -- Demo game mode
- `DemoLevel.cpp/h` -- Demo level
- `DemoUser.cpp/h` -- Demo user
- `Options.cpp/h` -- Game options/settings
- `Settings.cpp/h` -- Settings persistence
- `ClientConstants.cpp/h` -- Client-side constants
- `Timer.cpp/h` -- Game timer
- `MemoryTracker.cpp/h` -- Memory usage tracking
- `StatsCounter.cpp/h` -- Statistics counter
- `StatsSyncher.cpp/h` -- Stats synchronization
- `User.cpp/h` -- User/account info
- `ArchiveFile.cpp/h` -- Archive/zip file handling
- `StringTable.cpp/h` -- Localized string table
- `WstringLookup.cpp/h` -- Wide string lookup
- `TeleportCommand.cpp/h` -- Client-side teleport command

---

## Minecraft.Client -- Common Subsystems

### Common/App
- `App_Defines.h` -- Application-wide defines
- `App_enums.h` -- Application enumerations
- `App_structs.h` -- Application structures
- `BuildVer.h` -- Build version info
- `Minecraft_Macros.h` -- Minecraft-specific macros
- `Potion_Macros.h` -- Potion-related macros
- `Console_Awards_enum.h` -- Console achievement/trophy enums
- `Console_Debug_enum.h` -- Debug enumerations
- `Consoles_App.cpp/h` -- Console application main class
- `ConsoleGameMode.cpp/h` -- Console-specific game mode
- `Console_Utils.cpp` -- Console utility functions
- `C4JMemoryPool.h` -- 4J Studios memory pool
- `C4JMemoryPoolAllocator.h` -- Memory pool allocator

### Common/Colours
- `ColourTable.cpp/h` -- Color lookup table (map colors, etc.)

### Common/DLC
- `DLCManager.cpp/h` -- DLC pack management
- `DLCPack.cpp/h` -- Individual DLC pack
- `DLCFile.cpp/h` -- Base DLC file
- `DLCAudioFile.cpp/h` -- DLC audio content
- `DLCCapeFile.cpp/h` -- DLC cape content
- `DLCColourTableFile.cpp/h` -- DLC color table
- `DLCGameRules.h` -- DLC game rules
- `DLCGameRulesFile.cpp/h` -- DLC game rules file
- `DLCGameRulesHeader.cpp/h` -- DLC game rules header
- `DLCLocalisationFile.cpp/h` -- DLC localization
- `DLCSkinFile.cpp/h` -- DLC skin content
- `DLCTextureFile.cpp/h` -- DLC texture content
- `DLCUIDataFile.cpp/h` -- DLC UI data

### Common/GameRules
- `GameRule.cpp/h` -- Individual game rule
- `GameRuleDefinition.cpp/h` -- Game rule definition
- `GameRuleManager.cpp/h` -- Game rules manager
- `GameRulesInstance.h` -- Game rules instance
- `ConsoleGameRules.h` -- Console game rules constants
- `ConsoleGameRulesConstants.h` -- Game rules constants
- `LevelRules.cpp/h` -- Level-specific rules
- `LevelRuleset.cpp/h` -- Level ruleset
- `LevelGenerators.cpp/h` -- Level generator types
- `LevelGenerationOptions.cpp/h` -- Level generation options
- `BiomeOverride.cpp/h` -- Biome override rules
- `ConsoleGenerateStructure.cpp/h` -- Structure generation rules
- `ConsoleSchematicFile.cpp/h` -- Schematic file handling
- `StartFeature.cpp/h` -- Start feature rule
- Rule definitions: `AddEnchantmentRuleDefinition`, `AddItemRuleDefinition`, `ApplySchematicRuleDefinition`, `CollectItemRuleDefinition`, `CompleteAllRuleDefinition`, `CompoundGameRuleDefinition`, `NamedAreaRuleDefinition`, `UpdatePlayerRuleDefinition`, `UseTileRuleDefinition`
- Structure actions: `XboxStructureActionGenerateBox`, `XboxStructureActionPlaceBlock`, `XboxStructureActionPlaceContainer`, `XboxStructureActionPlaceSpawner`

### Common/Leaderboards
- `LeaderboardManager.cpp/h` -- Leaderboard management

### Common/Network
- `GameNetworkManager.cpp/h` -- Game network manager
- `NetworkPlayerInterface.h` -- Network player interface
- `PlatformNetworkManagerInterface.h` -- Platform network abstraction
- `PlatformNetworkManagerStub.cpp/h` -- Stub network manager
- `SessionInfo.h` -- Session information
- Sony-specific: `PlatformNetworkManagerSony`, `NetworkPlayerSony`, `SQRNetworkManager`, `SQRNetworkPlayer`, `SonyCommerce`, `SonyHttp`, `SonyRemoteStorage`

### Common/Telemetry
- `TelemetryManager.cpp/h` -- Telemetry/analytics

### Common/Trial
- `TrialMode.cpp/h` -- Trial/demo mode

### Common/Tutorial
- `Tutorial.cpp/h` -- Tutorial system base
- `FullTutorial.cpp/h` -- Full tutorial system
- `FullTutorialActiveTask.cpp/h` -- Active tutorial task
- `FullTutorialMode.cpp/h` -- Tutorial mode
- `TutorialMode.cpp/h` -- Tutorial mode base
- `TutorialTask.cpp/h` -- Base tutorial task
- `TutorialEnum.h` -- Tutorial enumerations
- `TutorialConstraint.h` -- Tutorial constraint interface
- `TutorialConstraints.h` -- Constraint collection
- `TutorialHint.cpp/h` -- Tutorial hint base
- `TutorialHints.h` -- Hint collection
- `TutorialMessage.cpp/h` -- Tutorial messages
- Tasks: `AreaTask`, `ChoiceTask`, `CompleteUsingItemTask`, `ControllerTask`, `CraftTask`, `EffectChangedTask`, `InfoTask`, `PickupTask`, `ProcedureCompoundTask`, `ProgressFlagTask`, `StatTask`, `StateChangeTask`, `UseItemTask`, `UseTileTask`, `XuiCraftingTask`
- Constraints: `AreaConstraint`, `ChangeStateConstraint`, `InputConstraint`
- Hints: `AreaHint`, `DiggerItemHint`, `LookAtEntityHint`, `LookAtTileHint`, `TakeItemHint`

### Common/UI (New UI System)
- `UI.h` -- UI system header
- `UIController.cpp/h` -- UI controller
- `IUIController.h` -- UI controller interface
- `UIScene.cpp/h` -- Base UI scene
- `UIEnums.h` -- UI enumerations
- `UIStructs.h` -- UI structures
- `UILayer.cpp/h` -- UI layering
- `UIGroup.cpp/h` -- UI group
- `UIBitmapFont.cpp/h` -- Bitmap font rendering
- `UIFontData.cpp/h` -- Font data
- `UITTFFont.cpp/h` -- TrueType font rendering
- Controls: `UIControl_Base`, `UIControl_BitmapIcon`, `UIControl_Button`, `UIControl_ButtonList`, `UIControl_CheckBox`, `UIControl_Cursor`, `UIControl_DLCList`, `UIControl_DynamicLabel`, `UIControl_EnchantmentBook`, `UIControl_EnchantmentButton`, `UIControl_HTMLLabel`, `UIControl_Label`, `UIControl_LeaderboardList`, `UIControl_MinecraftPlayer`, `UIControl_PlayerList`, `UIControl_PlayerSkinPreview`, `UIControl_Progress`, `UIControl_SaveList`, `UIControl_Slider`, `UIControl_SlotList`, `UIControl_SpaceIndicatorBar`, `UIControl_TextInput`, `UIControl_TexturePackList`, `UIControl_Touch`
- Components: `UIComponent_Chat`, `UIComponent_DebugUIConsole`, `UIComponent_DebugUIMarketingGuide`, `UIComponent_Logo`, `UIComponent_MenuBackground`, `UIComponent_Panorama`, `UIComponent_PressStartToPlay`, `UIComponent_Tooltips`, `UIComponent_TutorialPopup`
- Scenes: `UIScene_AbstractContainerMenu`, `UIScene_AnvilMenu`, `UIScene_BrewingStandMenu`, `UIScene_ConnectingProgress`, `UIScene_ContainerMenu`, `UIScene_ControlsMenu`, `UIScene_CraftingMenu`, `UIScene_CreateWorldMenu`, `UIScene_CreativeMenu`, `UIScene_Credits`, `UIScene_DeathMenu`, `UIScene_DebugOptions`, `UIScene_DebugOverlay`, `UIScene_DebugCreateSchematic`, `UIScene_DebugSetCamera`, `UIScene_DispenserMenu`, `UIScene_DLCMainMenu`, `UIScene_DLCOffersMenu`, `UIScene_EnchantingMenu`, `UIScene_EndPoem`, `UIScene_EULA`, `UIScene_FullscreenProgress`, `UIScene_FurnaceMenu`, `UIScene_HelpAndOptionsMenu`, `UIScene_HowToPlay`, `UIScene_HowToPlayMenu`, `UIScene_HUD`, `UIScene_InGameHostOptionsMenu`, `UIScene_InGameInfoMenu`, `UIScene_InGamePlayerOptionsMenu`, `UIScene_InGameSaveManagementMenu`, `UIScene_Intro`, `UIScene_InventoryMenu`, `UIScene_JoinMenu`, `UIScene_Keyboard`, `UIScene_LaunchMoreOptionsMenu`, `UIScene_LeaderboardsMenu`, `UIScene_LoadMenu`, `UIScene_LoadOrJoinMenu`, `UIScene_MainMenu`, `UIScene_MessageBox`, `UIScene_PauseMenu`, `UIScene_QuadrantSignin`, `UIScene_ReinstallMenu`, `UIScene_SaveMessage`, `UIScene_SettingsAudioMenu`, `UIScene_SettingsControlMenu`, `UIScene_SettingsGraphicsMenu`, `UIScene_SettingsMenu`, `UIScene_SettingsOptionsMenu`, `UIScene_SettingsUIMenu`, `UIScene_SignEntryMenu`, `UIScene_SkinSelectMenu`, `UIScene_TeleportMenu`, `UIScene_Timer`, `UIScene_TradingMenu`, `UIScene_TrialExitUpsell`
- Interface scenes: `IUIScene_AbstractContainerMenu`, `IUIScene_AnvilMenu`, `IUIScene_BrewingMenu`, `IUIScene_ContainerMenu`, `IUIScene_CraftingMenu`, `IUIScene_CreativeMenu`, `IUIScene_DispenserMenu`, `IUIScene_EnchantingMenu`, `IUIScene_FurnaceMenu`, `IUIScene_InventoryMenu`, `IUIScene_PauseMenu`, `IUIScene_StartGame`, `IUIScene_TradingMenu`

### Common/XUI (Xbox UI System)
- `XUI_BasePlayer.cpp/h` -- Base XUI player
- `XUI_Chat.cpp/h` -- XUI chat
- `XUI_ConnectingProgress.cpp/h` -- Connection progress
- `XUI_HUD.cpp/h` -- XUI HUD
- `XUI_MainMenu.cpp/h` -- Main menu
- `XUI_PauseMenu.cpp/h` -- Pause menu
- `XUI_Intro.cpp/h` -- Intro sequence
- And many more XUI scene/control files (DLC, settings, crafting, enchanting, etc.)

### Common/Media
- `xuiscene_*.h` -- XUI scene layout definitions for various screen sizes (480, small, standard)

---

## Minecraft.World -- Entities

### Base Entity Hierarchy
- `Entity.cpp/h` -- Base entity class (position, collision, NBT serialization)
- `Mob.cpp/h` -- Base mob class (AI, health, equipment, effects)
- `Creature.cpp/h` -- Base creature (pathfinding mob)
- `PathfinderMob.cpp/h` -- Mob with pathfinding
- `Monster.cpp/h` -- Base hostile mob
- `Animal.cpp/h` -- Base passive animal
- `AgableMob.cpp/h` -- Mob with age (baby/adult)
- `TamableAnimal.cpp/h` -- Tamable animal base
- `WaterAnimal.cpp/h` -- Water-dwelling animal
- `FlyingMob.cpp/h` -- Flying mob base
- `BossMob.cpp/h` -- Boss mob base
- `BossMobPart.cpp/h` -- Boss mob multi-part hitbox
- `Golem.cpp/h` -- Golem base
- `Npc.cpp/h` -- NPC base class
- `Player.cpp/h` -- Player entity

### Passive Mobs
- `Chicken.cpp/h` -- Chicken
- `Cow.cpp/h` -- Cow
- `MushroomCow.cpp/h` -- Mooshroom
- `Pig.cpp/h` -- Pig
- `Sheep.cpp/h` -- Sheep
- `Wolf.cpp/h` -- Wolf
- `Ozelot.cpp/h` -- Ocelot/Cat
- `Squid.cpp/h` -- Squid
- `Villager.cpp/h` -- Villager NPC
- `VillagerGolem.cpp/h` -- Iron golem
- `SnowMan.cpp/h` -- Snow golem

### Hostile Mobs
- `Blaze.cpp/h` -- Blaze
- `CaveSpider.cpp/h` -- Cave spider
- `Creeper.cpp/h` -- Creeper
- `EnderDragon.cpp/h` -- Ender dragon
- `EnderMan.cpp/h` -- Enderman
- `Ghast.cpp/h` -- Ghast
- `Giant.cpp/h` -- Giant zombie
- `LavaSlime.cpp/h` -- Magma cube
- `PigZombie.cpp/h` -- Zombie pigman
- `Silverfish.cpp/h` -- Silverfish
- `Skeleton.cpp/h` -- Skeleton
- `Slime.cpp/h` -- Slime
- `Spider.cpp/h` -- Spider
- `Zombie.cpp/h` -- Zombie
- `Enemy.cpp/h` -- Enemy marker interface

### Entity Items/Objects
- `ItemEntity.cpp/h` -- Dropped item entity
- `ExperienceOrb.cpp/h` -- XP orb entity
- `FallingTile.cpp/h` -- Falling block entity
- `PrimedTnt.cpp/h` -- Primed TNT entity
- `Boat.cpp/h` -- Boat entity
- `Minecart.cpp/h` -- Minecart entity
- `Painting.cpp/h` -- Painting entity
- `ItemFrame.cpp/h` -- Item frame entity
- `HangingEntity.cpp/h` -- Base hanging entity
- `EnderCrystal.cpp/h` -- Ender crystal entity
- `LightningBolt.cpp/h` -- Lightning bolt
- `GlobalEntity.cpp/h` -- Global entity (lightning)
- `FishingHook.cpp/h` -- Fishing hook entity
- `EyeOfEnderSignal.cpp/h` -- Eye of ender signal

### Projectiles
- `Arrow.cpp/h` -- Arrow projectile
- `Throwable.cpp/h` -- Base throwable
- `Snowball.cpp/h` -- Snowball projectile
- `ThrownEgg.cpp/h` -- Thrown egg
- `ThrownEnderpearl.cpp/h` -- Thrown ender pearl
- `ThrownExpBottle.cpp/h` -- Thrown exp bottle
- `ThrownPotion.cpp/h` -- Thrown splash potion
- `Fireball.cpp/h` -- Large fireball
- `SmallFireball.cpp/h` -- Small fireball
- `DragonFireball.cpp/h` -- Dragon fireball

### Entity Data/Utility
- `EntityIO.cpp/h` -- Entity serialization/deserialization
- `SynchedEntityData.cpp/h` -- Synchronized entity data (network)
- `EntityPos.cpp/h` -- Entity position packet data
- `EntityDamageSource.cpp/h` -- Entity-caused damage
- `IndirectEntityDamageSource.cpp/h` -- Indirect entity damage
- `DamageSource.cpp/h` -- Damage source types
- `MobType.h` -- Mob type enum
- `MobCategory.cpp/h` -- Mob spawn category
- `MobSpawner.cpp/h` -- Mob spawning logic
- `BodyControl.cpp/h` -- Mob body rotation control

---

## Minecraft.World -- AI Goals

### Core AI
- `Goal.cpp/h` -- Base AI goal
- `GoalSelector.cpp/h` -- AI goal selector/scheduler
- `Sensing.cpp/h` -- Mob sensing (sight, etc.)
- `LookControl.cpp/h` -- Look direction control
- `MoveControl.cpp/h` -- Movement control
- `JumpControl.cpp/h` -- Jump control
- `PathNavigation.cpp/h` -- Path navigation
- `PathFinder.cpp/h` -- A* pathfinding
- `Path.cpp/h` -- Navigation path
- `Node.cpp/h` -- Pathfinding node
- `BinaryHeap.cpp/h` -- Priority queue for pathfinding
- `RandomPos.cpp/h` -- Random position generation

### Movement Goals
- `FloatGoal.cpp/h` -- Stay afloat in water
- `PanicGoal.cpp/h` -- Panic/flee when hurt
- `FleeSunGoal.cpp/h` -- Flee from sunlight
- `RandomStrollGoal.cpp/h` -- Random wandering
- `MoveTowardsRestrictionGoal.cpp/h` -- Move toward home area
- `MoveTowardsTargetGoal.cpp/h` -- Move toward target
- `MoveThroughVillageGoal.cpp/h` -- Navigate through village
- `MoveIndoorsGoal.cpp/h` -- Move indoors
- `ControlledByPlayerGoal.cpp/h` -- Player-controlled movement (saddled pig)
- `RandomLookAroundGoal.cpp/h` -- Random head movement

### Combat Goals
- `MeleeAttackGoal.cpp/h` -- Melee attack
- `ArrowAttackGoal.cpp/h` -- Ranged bow attack
- `LeapAtTargetGoal.cpp/h` -- Leap at target (spiders)
- `OzelotAttackGoal.cpp/h` -- Ocelot attack
- `SwellGoal.cpp/h` -- Creeper swell/explode

### Target Goals
- `TargetGoal.cpp/h` -- Base targeting goal
- `NearestAttackableTargetGoal.cpp/h` -- Find nearest attackable target
- `HurtByTargetGoal.cpp/h` -- Target entity that hurt this mob
- `OwnerHurtByTargetGoal.cpp/h` -- Target entity that hurt owner
- `OwnerHurtTargetGoal.cpp/h` -- Target entity owner attacked
- `DefendVillageTargetGoal.cpp/h` -- Iron golem defend village
- `NonTameRandomTargetGoal.cpp/h` -- Wild ocelot targeting

### Interaction Goals
- `LookAtPlayerGoal.cpp/h` -- Look at nearby player
- `LookAtTradingPlayerGoal.cpp/h` -- Look at trading player
- `InteractGoal.cpp/h` -- Entity interaction
- `AvoidPlayerGoal.cpp/h` -- Avoid player (ocelot)
- `BreedGoal.cpp/h` -- Breeding behavior
- `TemptGoal.cpp/h` -- Tempted by food item
- `FollowOwnerGoal.cpp/h` -- Follow owner (tamed)
- `FollowParentGoal.cpp/h` -- Follow parent (baby)
- `BegGoal.cpp/h` -- Wolf begging
- `PlayGoal.cpp/h` -- Villager playing
- `MakeLoveGoal.cpp/h` -- Villager breeding
- `TradeWithPlayerGoal.cpp/h` -- Villager trading
- `OfferFlowerGoal.cpp/h` -- Iron golem offer flower
- `TakeFlowerGoal.cpp/h` -- Villager take flower
- `EatTileGoal.cpp/h` -- Sheep eat grass
- `SitGoal.cpp/h` -- Tamed sit
- `OcelotSitOnTileGoal.cpp/h` -- Ocelot sit on blocks
- `RestrictSunGoal.cpp/h` -- Restrict to shaded areas
- `RestrictOpenDoorGoal.cpp/h` -- Restrict open door
- `DoorInteractGoal.cpp/h` -- Door interaction base
- `OpenDoorGoal.cpp/h` -- Open door
- `BreakDoorGoal.cpp/h` -- Break door (zombie)

---

## Minecraft.World -- Blocks (Tiles)

### Core
- `Tile.cpp/h` -- Base block/tile class
- `TileItem.cpp/h` -- Block as item
- `TileEntity.cpp/h` -- Base tile entity
- `Material.cpp/h` -- Block material
- `MaterialColor.cpp/h` -- Map material colors

### Natural Blocks
- `AirTile.cpp/h` -- Air
- `DirtTile.cpp/h` -- Dirt
- `GrassTile.cpp/h` -- Grass block
- `GravelTile.cpp/h` -- Gravel
- `StoneTile.cpp/h` -- Stone
- `SandStoneTile.cpp/h` -- Sandstone
- `ClayTile.cpp/h` -- Clay block
- `OreTile.cpp/h` -- Ore blocks
- `MetalTile.cpp/h` -- Metal blocks (iron, gold, diamond)
- `ObsidianTile.cpp/h` -- Obsidian
- `IceTile.cpp/h` -- Ice
- `SnowTile.cpp/h` -- Snow block
- `TopSnowTile.cpp/h` -- Snow layer
- `MycelTile.cpp/h` -- Mycelium

### Plants/Vegetation
- `Sapling.cpp/h` -- Sapling
- `TreeTile.cpp/h` -- Wood log
- `LeafTile.cpp/h` -- Leaves
- `Bush.cpp/h` -- Bush plant base
- `TallGrass.cpp/h` -- Tall grass
- `DeadBushTile.cpp/h` -- Dead bush
- `CropTile.cpp/h` -- Crops base
- `CarrotTile.cpp/h` -- Carrot crops
- `PotatoTile.cpp/h` -- Potato crops
- `CactusTile.cpp/h` -- Cactus
- `ReedTile.cpp/h` -- Sugar cane
- `PumpkinTile.cpp/h` -- Pumpkin
- `MelonTile.cpp/h` -- Melon
- `StemTile.cpp/h` -- Pumpkin/melon stem
- `CocoaTile.cpp/h` -- Cocoa
- `VineTile.cpp/h` -- Vines
- `WaterLilyTile.cpp/h` -- Lily pad
- `Mushroom.cpp/h` -- Mushroom
- `HugeMushroomTile.cpp/h` -- Huge mushroom
- `FlowerPotTile.cpp/h` -- Flower pot
- `NetherStalkTile.cpp/h` -- Nether wart

### Building Blocks
- `ClothTile.cpp/h` -- Wool
- `BookshelfTile.cpp/h` -- Bookshelf
- `GlassTile.cpp/h` -- Glass
- `HalfSlabTile.cpp/h` -- Slabs
- `StoneSlabTile.cpp/h` -- Stone slabs
- `WoodSlabTile.cpp/h` -- Wood slabs
- `StairTile.cpp/h` -- Stairs
- `FenceTile.cpp/h` -- Fence
- `FenceGateTile.cpp/h` -- Fence gate
- `ThinFenceTile.cpp/h` -- Iron bars/glass panes
- `WallTile.cpp/h` -- Cobblestone wall
- `DoorTile.cpp/h` -- Door
- `TrapDoorTile.cpp/h` -- Trapdoor
- `LadderTile.cpp/h` -- Ladder
- `SmoothStoneBrickTile.cpp/h` -- Stone bricks
- `QuartzBlockTile.cpp/h` -- Quartz block
- `WoolCarpetTile.cpp/h` -- Carpet
- `CoralTile.cpp/h` -- Coral
- `Sponge.cpp/h` -- Sponge

### Functional Blocks
- `WorkbenchTile.cpp/h` -- Crafting table
- `FurnaceTile.cpp/h` -- Furnace
- `ChestTile.cpp/h` -- Chest
- `EnderChestTile.cpp/h` -- Ender chest
- `AnvilTile.cpp/h` -- Anvil
- `BrewingStandTile.cpp/h` -- Brewing stand
- `EnchantmentTableTile.cpp/h` -- Enchanting table
- `DispenserTile.cpp/h` -- Dispenser
- `BedTile.cpp/h` -- Bed
- `CakeTile.cpp/h` -- Cake
- `SignTile.cpp/h` -- Sign
- `SkullTile.cpp/h` -- Skull/head
- `MusicTile.cpp/h` -- Note block
- `RecordPlayerTile.cpp/h` -- Jukebox
- `MobSpawnerTile.cpp/h` -- Mob spawner
- `EggTile.cpp/h` -- Dragon egg
- `LockedChestTile.cpp/h` -- Locked chest

### Redstone
- `RedStoneDustTile.cpp/h` -- Redstone dust
- `RedStoneOreTile.cpp/h` -- Redstone ore
- `RedlightTile.cpp/h` -- Redstone lamp
- `NotGateTile.cpp/h` -- Redstone torch
- `DiodeTile.cpp/h` -- Repeater
- `LeverTile.cpp/h` -- Lever
- `ButtonTile.cpp/h` -- Button
- `PressurePlateTile.cpp/h` -- Pressure plate
- `HeavyTile.cpp/h` -- Weighted pressure plate
- `TripWireTile.cpp/h` -- Tripwire
- `TripWireSourceTile.cpp/h` -- Tripwire hook
- `TntTile.cpp/h` -- TNT
- `PistonBaseTile.cpp/h` -- Piston base
- `PistonExtensionTile.cpp/h` -- Piston extension
- `PistonMovingPiece.cpp/h` -- Piston moving piece
- `PistonPieceEntity.cpp/h` -- Piston piece tile entity
- `DetectorRailTile.cpp/h` -- Detector rail
- `RailTile.cpp/h` -- Rail

### Liquids
- `LiquidTile.cpp/h` -- Base liquid
- `LiquidTileDynamic.cpp/h` -- Flowing liquid
- `LiquidTileStatic.cpp/h` -- Still liquid
- `SpringTile.cpp/h` -- Spring block

### Portals
- `PortalTile.cpp/h` -- Nether portal
- `TheEndPortalFrameTile.cpp/h` -- End portal frame
- `DirectionalTile.cpp/h` -- Directional block base

### Tile Entities
- `FurnaceTileEntity.cpp/h` -- Furnace data
- `ChestTileEntity.cpp/h` -- Chest inventory
- `DispenserTileEntity.cpp/h` -- Dispenser inventory
- `BrewingStandTileEntity.cpp/h` -- Brewing stand data
- `EnchantmentTableEntity.cpp/h` -- Enchanting table data
- `SignTileEntity.cpp/h` -- Sign text
- `SkullTileEntity.cpp/h` -- Skull data
- `MusicTileEntity.cpp/h` -- Note block data
- `MobSpawnerTileEntity.cpp/h` -- Spawner data
- `EnderChestTileEntity.cpp/h` -- Ender chest data
- `TheEndPortalTileEntity.cpp/h` -- End portal data
- `PistonPieceEntity.cpp/h` -- Piston piece data

### Tile Items (Specialized)
- `AnvilTileItem.cpp/h`, `AuxDataTileItem.cpp/h`, `ClothTileItem.cpp/h`, `ColoredTileItem.cpp/h`, `LeafTileItem.cpp/h`, `MultiTextureTileItem.cpp/h`, `PistonTileItem.cpp/h`, `SaplingTileItem.cpp/h`, `StoneSlabTileItem.cpp/h`, `SmoothStoneBrickTileItem.cpp/h`, `StoneMonsterTileItem.cpp/h`, `TreeTileItem.cpp/h`, `WaterLilyTileItem.cpp/h`

---

## Minecraft.World -- Items

### Core
- `Item.cpp/h` -- Base item class
- `ItemInstance.cpp/h` -- Item stack instance

### Tools
- `DiggerItem.cpp/h` -- Base tool item
- `PickaxeItem.cpp/h` -- Pickaxe
- `ShovelItem.cpp/h` -- Shovel
- `HatchetItem.cpp/h` -- Axe
- `HoeItem.cpp/h` -- Hoe
- `WeaponItem.cpp/h` -- Sword
- `ShearsItem.cpp/h` -- Shears
- `FlintAndSteelItem.cpp/h` -- Flint and steel
- `FishingRodItem.cpp/h` -- Fishing rod
- `BowItem.cpp/h` -- Bow
- `CarrotOnAStickItem.cpp/h` -- Carrot on a stick

### Armor
- `ArmorItem.cpp/h` -- Armor item

### Food
- `FoodItem.cpp/h` -- Base food item
- `BowlFoodItem.cpp/h` -- Bowl food (mushroom stew)
- `SeedFoodItem.cpp/h` -- Seed food (melon seeds)
- `GoldenAppleItem.cpp/h` -- Golden apple
- `MilkBucketItem.cpp/h` -- Milk bucket
- `FoodConstants.cpp/h` -- Food nutrition values
- `FoodData.cpp/h` -- Player food data

### Misc Items
- `BucketItem.cpp/h` -- Bucket
- `BedItem.cpp/h` -- Bed item
- `BoatItem.cpp/h` -- Boat item
- `MinecartItem.cpp/h` -- Minecart item
- `DoorItem.cpp/h` -- Door item
- `SignItem.cpp/h` -- Sign item
- `DyePowderItem.cpp/h` -- Dye
- `CoalItem.cpp/h` -- Coal
- `RedStoneItem.cpp/h` -- Redstone dust item
- `SaddleItem.cpp/h` -- Saddle
- `MapItem.cpp/h` -- Map
- `ClockItem.cpp/h` -- Clock
- `CompassItem.cpp/h` -- Compass
- `BookItem.cpp/h` -- Book
- `EnchantedBookItem.cpp/h` -- Enchanted book
- `RecordingItem.cpp/h` -- Music disc
- `ExperienceItem.cpp/h` -- Bottle o' enchanting
- `BottleItem.cpp/h` -- Glass bottle
- `PotionItem.cpp/h` -- Potion
- `SeedItem.cpp/h` -- Seeds
- `EggItem.cpp/h` -- Egg item
- `SnowballItem.cpp/h` -- Snowball item
- `EnderpearlItem.cpp/h` -- Ender pearl
- `EnderEyeItem.cpp/h` -- Eye of ender
- `FireChargeItem.cpp/h` -- Fire charge
- `SkullItem.cpp/h` -- Skull item
- `MonsterPlacerItem.cpp/h` -- Spawn egg
- `HangingEntityItem.cpp/h` -- Painting/item frame item
- `TilePlanterItem.cpp/h` -- Tile planter item
- `ComplexItem.cpp/h` -- Complex item (map)

---

## Minecraft.World -- Crafting & Recipes

- `Recipes.cpp/h` -- Recipe registry
- `Recipy.h` -- Recipe interface
- `ShapedRecipy.cpp/h` -- Shaped crafting recipe
- `ShapelessRecipy.cpp/h` -- Shapeless crafting recipe
- `FurnaceRecipes.cpp/h` -- Smelting recipes
- `ArmorRecipes.cpp/h` -- Armor recipes
- `WeaponRecipies.cpp/h` -- Weapon recipes
- `ToolRecipies.cpp/h` -- Tool recipes
- `OreRecipies.cpp/h` -- Ore/block recipes
- `FoodRecipies.cpp/h` -- Food recipes
- `StructureRecipies.cpp/h` -- Structure block recipes
- `ArmorDyeRecipe.cpp/h` -- Armor dyeing
- `ClothDyeRecipes.cpp/h` -- Wool dyeing

---

## Minecraft.World -- Enchantments

- `Enchantment.cpp/h` -- Base enchantment class
- `EnchantmentCategory.cpp/h` -- Enchantment categories
- `EnchantmentHelper.cpp/h` -- Enchantment utility methods
- `EnchantmentInstance.cpp/h` -- Enchantment instance
- `ProtectionEnchantment.cpp/h` -- Protection enchantments
- `DamageEnchantment.cpp/h` -- Damage enchantments (Sharpness, etc.)
- `KnockbackEnchantment.cpp/h` -- Knockback
- `FireAspectEnchantment.cpp/h` -- Fire aspect
- `DiggingEnchantment.cpp/h` -- Efficiency
- `DigDurabilityEnchantment.cpp/h` -- Unbreaking
- `UntouchingEnchantment.cpp/h` -- Silk touch
- `LootBonusEnchantment.cpp/h` -- Fortune/Looting
- `ArrowDamageEnchantment.cpp/h` -- Power
- `ArrowKnockbackEnchantment.cpp/h` -- Punch
- `ArrowFireEnchantment.cpp/h` -- Flame
- `ArrowInfiniteEnchantment.cpp/h` -- Infinity
- `OxygenEnchantment.cpp/h` -- Respiration
- `WaterWorkerEnchantment.cpp/h` -- Aqua affinity
- `ThornsEnchantment.cpp/h` -- Thorns

---

## Minecraft.World -- Potions/Effects

- `MobEffect.cpp/h` -- Base mob effect
- `MobEffectInstance.cpp/h` -- Effect instance (duration, amplifier)
- `InstantenousMobEffect.cpp/h` -- Instant effects (healing, harming)
- `PotionBrewing.cpp/h` -- Potion brewing recipes

---

## Minecraft.World -- Inventory/Containers

- `Container.cpp/h` -- Base container interface
- `SimpleContainer.cpp/h` -- Simple container
- `CompoundContainer.cpp/h` -- Compound container (double chest)
- `Inventory.cpp/h` -- Player inventory
- `PlayerEnderChestContainer.cpp/h` -- Player ender chest
- `Slot.cpp/h` -- Inventory slot
- `ArmorSlot.cpp/h` -- Armor slot
- `ResultSlot.cpp/h` -- Crafting result slot
- `FurnaceResultSlot.cpp/h` -- Furnace result slot
- `MerchantResultSlot.cpp/h` -- Trading result slot
- `RepairResultSlot.cpp/h` -- Anvil result slot
- `EnchantmentSlot.h` -- Enchanting slot
- `AbstractContainerMenu.cpp/h` -- Base container menu
- `ContainerMenu.cpp/h` -- Generic container menu
- `CraftingMenu.cpp/h` -- Crafting menu
- `CraftingContainer.cpp/h` -- Crafting grid
- `InventoryMenu.cpp/h` -- Player inventory menu
- `FurnaceMenu.cpp/h` -- Furnace menu
- `BrewingStandMenu.cpp/h` -- Brewing stand menu
- `EnchantmentMenu.cpp/h` -- Enchantment menu
- `EnchantmentContainer.cpp/h` -- Enchantment container
- `RepairMenu.cpp/h` -- Anvil repair menu
- `RepairContainer.cpp/h` -- Anvil repair container
- `TrapMenu.cpp/h` -- Hopper menu
- `MerchantMenu.cpp/h` -- Trading menu
- `MerchantContainer.cpp/h` -- Trading container
- `MenuBackup.cpp/h` -- Menu state backup

---

## Minecraft.World -- Trading

- `Merchant.h` -- Merchant interface
- `ClientSideMerchant.cpp/h` -- Client-side merchant
- `MerchantRecipe.cpp/h` -- Single trade recipe
- `MerchantRecipeList.cpp/h` -- Trade recipe list

---

## Minecraft.World -- World/Level

### Core Level
- `Level.cpp/h` -- Main world/level class
- `LevelChunk.cpp/h` -- World chunk (16x256x16 block column)
- `EmptyLevelChunk.cpp/h` -- Empty chunk placeholder
- `WaterLevelChunk.cpp/h` -- Water-filled chunk
- `LevelData.cpp/h` -- Level metadata (seed, spawn, time, etc.)
- `DerivedLevelData.cpp/h` -- Derived level data (per-dimension)
- `LevelSettings.cpp/h` -- Level creation settings
- `LevelType.cpp/h` -- Level type (normal, flat, etc.)
- `LevelListener.h` -- Level event listener interface
- `ProgressListener.h` -- Progress callback interface

### Dimensions
- `Dimension.cpp/h` -- Base dimension class
- `NormalDimension.h` -- Overworld dimension
- `HellDimension.cpp/h` -- Nether dimension
- `TheEndDimension.cpp/h` -- End dimension
- `SkyIslandDimension.cpp` -- Sky island dimension (unused?)

### Chunk Storage
- `ChunkSource.h` -- Chunk source interface
- `ChunkStorage.h` -- Chunk storage interface
- `MemoryChunkStorage.cpp/h` -- In-memory chunk storage
- `McRegionChunkStorage.cpp/h` -- Region file chunk storage
- `ZonedChunkStorage.cpp/h` -- Zoned chunk storage
- `OldChunkStorage.cpp/h` -- Old format chunk storage
- `ChunkStorageProfileDecorator.cpp/h` -- Storage profiling
- `ReadOnlyChunkCache.cpp/h` -- Read-only chunk cache
- `CompressedTileStorage.cpp/h` -- Compressed tile storage

### Level Storage
- `LevelStorage.cpp/h` -- Level storage base
- `LevelStorageSource.h` -- Storage source interface
- `DirectoryLevelStorage.cpp/h` -- Directory-based level storage
- `DirectoryLevelStorageSource.cpp/h` -- Directory storage source
- `McRegionLevelStorage.cpp/h` -- McRegion level storage
- `McRegionLevelStorageSource.cpp/h` -- McRegion storage source
- `MemoryLevelStorage.cpp/h` -- In-memory level storage
- `MemoryLevelStorageSource.cpp/h` -- Memory storage source
- `MockedLevelStorage.cpp/h` -- Mocked storage (testing)
- `LevelStorageProfilerDecorator.cpp/h` -- Storage profiler
- `LevelSummary.cpp/h` -- Level summary for world list

### Region Files
- `Region.cpp/h` -- Region data
- `RegionFile.cpp/h` -- Region file I/O
- `RegionFileCache.cpp/h` -- Region file cache
- `ZoneFile.cpp/h` -- Zone file
- `ZoneIo.cpp/h` -- Zone I/O

### Console Save Format
- `ConsoleSaveFile.h` -- Console save file interface
- `ConsoleSaveFileOriginal.cpp/h` -- Original save format
- `ConsoleSaveFileSplit.cpp/h` -- Split save format
- `ConsoleSaveFileConverter.cpp/h` -- Format converter
- `ConsoleSaveFileInputStream.cpp/h` -- Save file input stream
- `ConsoleSaveFileOutputStream.cpp/h` -- Save file output stream
- `ConsoleSaveFileIO.h` -- Save file I/O interface
- `ConsoleSavePath.h` -- Save path

### Saved Data
- `SavedData.cpp/h` -- Persistent world data base
- `SavedDataStorage.cpp/h` -- Saved data storage
- `MapItemSavedData.cpp/h` -- Map item saved data
- `Villages.cpp/h` -- Village saved data
- `Village.cpp/h` -- Individual village data
- `VillageSiege.cpp/h` -- Village siege event

### Portal
- `PortalForcer.cpp/h` -- Portal placement/creation

---

## Minecraft.World -- World Generation

### Level Sources (Chunk Generators)
- `RandomLevelSource.cpp/h` -- Normal overworld terrain generator
- `FlatLevelSource.cpp/h` -- Flat world generator
- `HellRandomLevelSource.cpp/h` -- Nether terrain generator
- `HellFlatLevelSource.cpp/h` -- Flat nether generator
- `TheEndLevelRandomLevelSource.cpp/h` -- End terrain generator
- `CustomLevelSource.cpp/h` -- Custom terrain generator
- `LevelSource.h` -- Level source interface

### Biomes
- `Biome.cpp/h` -- Base biome class
- `BiomeSource.cpp/h` -- Biome source/provider
- `BiomeCache.cpp/h` -- Biome result cache
- `BiomeDecorator.cpp/h` -- Biome decoration (ores, trees, flowers)
- `FixedBiomeSource.cpp/h` -- Fixed/single biome source
- `TheEndBiome.cpp/h` -- End biome
- `TheEndBiomeDecorator.cpp/h` -- End biome decoration
- Overworld biomes: `PlainsBiome`, `ForestBiome`, `DesertBiome`, `ExtremeHillsBiome`, `TaigaBiome`, `SwampBiome`, `JungleBiome`, `IceBiome`, `OceanBiome`, `RainforestBiome`, `BeachBiome`, `MushroomIslandBiome`, `RiverBiome`, `HellBiome`

### Biome Layer System
- `Layer.cpp/h` -- Base biome layer
- `IslandLayer.cpp/h` -- Initial island layer
- `AddIslandLayer.cpp/h` -- Add island detail
- `AddMushroomIslandLayer.cpp/h` -- Mushroom island placement
- `AddSnowLayer.cpp/h` -- Snow biome placement
- `BiomeInitLayer.cpp/h` -- Biome initialization
- `BiomeOverrideLayer.cpp/h` -- Biome override layer
- `DownfallLayer.cpp/h` -- Rainfall layer
- `DownfallMixerLayer.cpp/h` -- Rainfall mixing
- `FuzzyZoomLayer.cpp/h` -- Fuzzy zoom
- `GrowMushroomIslandLayer.cpp/h` -- Grow mushroom islands
- `RegionHillsLayer.cpp/h` -- Hills layer
- `RiverInitLayer.cpp/h` -- River initialization
- `RiverLayer.cpp/h` -- River generation
- `RiverMixerLayer.cpp/h` -- River mixing
- `ShoreLayer.cpp/h` -- Shore/beach layer
- `SmoothLayer.cpp/h` -- Smooth biome boundaries
- `SmoothZoomLayer.cpp/h` -- Smooth zoom
- `SwampRiversLayer.cpp/h` -- Swamp rivers
- `TemperatureLayer.cpp/h` -- Temperature layer
- `TemperatureMixerLayer.cpp/h` -- Temperature mixing
- `VoronoiZoom.cpp/h` -- Voronoi zoom (final zoom)
- `ZoomLayer.cpp/h` -- Zoom layer

### Features (World Decorations)
- `Feature.cpp/h` -- Base feature class
- `BasicTree.cpp/h` -- Basic/oak tree
- `BirchFeature.cpp/h` -- Birch tree
- `PineFeature.cpp/h` -- Pine tree
- `SpruceFeature.cpp/h` -- Spruce tree
- `TreeFeature.cpp/h` -- Generic tree
- `MegaTreeFeature.cpp/h` -- Mega/large tree
- `SwampTreeFeature.cpp/h` -- Swamp tree
- `GroundBushFeature.cpp/h` -- Ground bush
- `HugeMushroomFeature.cpp/h` -- Huge mushroom
- `OreFeature.cpp/h` -- Ore vein
- `ClayFeature.cpp/h` -- Clay deposit
- `SandFeature.cpp/h` -- Sand deposit
- `LakeFeature.cpp/h` -- Lake
- `SpringFeature.cpp/h` -- Water/lava spring
- `CactusFeature.cpp/h` -- Cactus
- `ReedsFeature.cpp/h` -- Sugar cane
- `PumpkinFeature.cpp/h` -- Pumpkin patch
- `FlowerFeature.cpp/h` -- Flowers
- `TallGrassFeature.cpp/h` -- Tall grass
- `DeadBushFeature.cpp/h` -- Dead bush
- `WaterlilyFeature.cpp/h` -- Lily pad
- `VinesFeature.cpp/h` -- Vines
- `BonusChestFeature.cpp/h` -- Bonus chest
- `DungeonFeature.cpp/h` -- Dungeon
- `MonsterRoomFeature.cpp/h` -- Monster room
- `DesertWellFeature.cpp/h` -- Desert well
- `EndPodiumFeature.cpp/h` -- End podium/exit portal
- `SpikeFeature.cpp/h` -- End spikes/pillars
- `HellFireFeature.cpp/h` -- Nether fire
- `HellPortalFeature.cpp/h` -- Nether portal feature
- `HellSpringFeature.cpp/h` -- Nether lava spring
- `LightGemFeature.cpp/h` -- Glowstone cluster
- `CaveFeature.cpp/h` -- Cave carving
- `LargeCaveFeature.cpp/h` -- Large cave
- `CanyonFeature.cpp/h` -- Ravine/canyon
- `LargeHellCaveFeature.cpp/h` -- Large nether cave
- `BlockGenMethods.cpp/h` -- Block generation helpers
- `BlockReplacements.cpp/h` -- Block replacement rules

### Structures
- `StructureFeature.cpp/h` -- Base structure feature
- `StructurePiece.cpp/h` -- Structure piece/component
- `StructureStart.cpp/h` -- Structure start
- `LargeFeature.cpp/h` -- Large structure base
- `NetherBridgeFeature.cpp/h` -- Nether fortress
- `NetherBridgePieces.cpp/h` -- Nether fortress pieces
- `NetherSphere.cpp/h` -- Nether sphere structure
- `StrongholdFeature.cpp/h` -- Stronghold
- `StrongholdPieces.cpp/h` -- Stronghold pieces
- `MineShaftFeature.cpp/h` -- Mineshaft
- `MineShaftPieces.cpp/h` -- Mineshaft pieces
- `MineShaftStart.cpp/h` -- Mineshaft start
- `VillageFeature.cpp/h` -- Village
- `VillagePieces.cpp/h` -- Village building pieces
- `HouseFeature.cpp/h` -- Village house
- `TownFeature.h` -- Town feature
- `RandomScatteredLargeFeature.cpp/h` -- Scattered structures (temples)
- `ScatteredFeaturePieces.cpp/h` -- Scattered structure pieces

### Noise
- `ImprovedNoise.cpp/h` -- Improved Perlin noise
- `PerlinNoise.cpp/h` -- Perlin noise octaves
- `PerlinSimplexNoise.cpp/h` -- Perlin simplex noise
- `SimplexNoise.cpp/h` -- Simplex noise
- `FastNoise.cpp/h` -- Fast noise implementation
- `Synth.cpp/h` -- Noise synthesis
- `FlatLayer.cpp/h` -- Flat world layer definition

### Transforms
- `Distort.cpp/h`, `Emboss.cpp/h`, `Rotate.cpp/h`, `Scale.cpp/h` -- Noise transforms

---

## Minecraft.World -- Networking (Packets)

### Connection
- `Connection.cpp/h` -- Network connection
- `Packet.cpp/h` -- Base packet class
- `PacketListener.cpp/h` -- Packet handler

### Login/Session
- `PreLoginPacket.cpp/h` -- Pre-login handshake
- `LoginPacket.cpp/h` -- Login packet
- `SharedKeyPacket.h` -- Encryption key
- `ServerAuthDataPacket.h` -- Server auth
- `GetInfoPacket.cpp/h` -- Server info request
- `KickPlayerPacket.cpp/h` -- Kick/disconnect
- `DisconnectPacket.cpp/h` -- Disconnect
- `KeepAlivePacket.cpp/h` -- Keep-alive ping
- `ClientInformationPacket.h` -- Client info
- `ClientProtocolPacket.h` -- Protocol version

### Entity Packets
- `AddEntityPacket.cpp/h` -- Spawn entity
- `AddMobPacket.cpp/h` -- Spawn mob
- `AddPlayerPacket.cpp/h` -- Spawn player
- `AddPaintingPacket.cpp/h` -- Spawn painting
- `AddExperienceOrbPacket.cpp/h` -- Spawn XP orb
- `AddGlobalEntityPacket.cpp/h` -- Spawn global entity
- `RemoveEntitiesPacket.cpp/h` -- Remove entities
- `MoveEntityPacket.cpp/h` -- Entity movement
- `MoveEntityPacketSmall.cpp/h` -- Small entity movement
- `TeleportEntityPacket.cpp/h` -- Entity teleport
- `MovePlayerPacket.cpp/h` -- Player movement
- `RotateHeadPacket.cpp/h` -- Head rotation
- `SetEntityMotionPacket.cpp/h` -- Entity velocity
- `SetEntityDataPacket.cpp/h` -- Entity metadata
- `EntityEventPacket.cpp/h` -- Entity event
- `EntityActionAtPositionPacket.cpp/h` -- Entity action at position
- `AnimatePacket.cpp/h` -- Entity animation
- `SetRidingPacket.cpp/h` -- Mount/ride
- `SetEquippedItemPacket.cpp/h` -- Equipment change
- `TakeItemEntityPacket.cpp/h` -- Item pickup

### Player Packets
- `PlayerActionPacket.cpp/h` -- Player dig/place action
- `PlayerCommandPacket.cpp/h` -- Player command (sneak, sprint)
- `PlayerAbilitiesPacket.cpp/h` -- Player abilities
- `PlayerInputPacket.cpp/h` -- Player input
- `PlayerInfoPacket.cpp/h` -- Player list info
- `SetCarriedItemPacket.cpp/h` -- Held item change
- `SetExperiencePacket.cpp/h` -- XP update
- `SetHealthPacket.cpp/h` -- Health update
- `RespawnPacket.cpp/h` -- Respawn

### World Packets
- `TileUpdatePacket.cpp/h` -- Block update
- `ChunkTilesUpdatePacket.cpp/h` -- Multi-block update
- `BlockRegionUpdatePacket.cpp/h` -- Block region update
- `TileDestructionPacket.cpp/h` -- Block break animation
- `TileEventPacket.cpp/h` -- Block event (piston, etc.)
- `TileEntityDataPacket.cpp/h` -- Tile entity data
- `LevelEventPacket.cpp/h` -- Level event (sound, particle)
- `LevelSoundPacket.cpp/h` -- Level sound
- `ExplodePacket.cpp/h` -- Explosion
- `GameEventPacket.cpp/h` -- Game event (rain, etc.)
- `SetTimePacket.cpp/h` -- Time update
- `SetSpawnPositionPacket.cpp/h` -- Spawn position
- `ChunkVisibilityPacket.cpp/h` -- Chunk visibility
- `ChunkVisibilityAreaPacket.cpp/h` -- Chunk visibility area
- `TexturePacket.cpp/h` -- Texture pack
- `TextureChangePacket.cpp/h` -- Texture change
- `TextureAndGeometryPacket.cpp/h` -- Texture and geometry
- `TextureAndGeometryChangePacket.cpp/h` -- Texture and geometry change

### Container Packets
- `ContainerOpenPacket.cpp/h` -- Open container
- `ContainerClosePacket.cpp/h` -- Close container
- `ContainerClickPacket.cpp/h` -- Container click
- `ContainerAckPacket.cpp/h` -- Container transaction ack
- `ContainerSetSlotPacket.cpp/h` -- Set slot item
- `ContainerSetContentPacket.cpp/h` -- Set full contents
- `ContainerSetDataPacket.cpp/h` -- Set container data
- `ContainerButtonClickPacket.cpp/h` -- Button click
- `SetCreativeModeSlotPacket.cpp/h` -- Creative mode slot
- `CraftItemPacket.cpp/h` -- Craft item

### Chat/Commands
- `ChatPacket.cpp/h` -- Chat message
- `ChatAutoCompletePacket.h` -- Tab completion
- `GameCommandPacket.cpp/h` -- Game command
- `ClientCommandPacket.cpp/h` -- Client command
- `CustomPayloadPacket.cpp/h` -- Plugin message

### Effects/Stats
- `UpdateMobEffectPacket.cpp/h` -- Add/update effect
- `RemoveMobEffectPacket.cpp/h` -- Remove effect
- `AwardStatPacket.cpp/h` -- Award statistic
- `ComplexItemDataPacket.cpp/h` -- Complex item data (maps)

### Misc Packets
- `DebugOptionsPacket.cpp/h` -- Debug options
- `SignUpdatePacket.cpp/h` -- Sign text update
- `InteractPacket.cpp/h` -- Entity interaction
- `UseItemPacket.cpp/h` -- Use item
- `UpdateProgressPacket.cpp/h` -- Progress update
- `UpdateGameRuleProgressPacket.cpp/h` -- Game rule progress
- `TradeItemPacket.cpp/h` -- Trading
- `ServerSettingsChangedPacket.cpp/h` -- Server settings
- `XZPacket.cpp/h` -- XZ position packet
- `BlockDestructionProgress.cpp/h` -- Block destruction progress

---

## Minecraft.World -- Commands

- `Command.cpp/h` -- Base command class
- `CommandDispatcher.cpp/h` -- Command dispatcher
- `CommandSender.h` -- Command sender interface
- `CommandsEnum.h` -- Command enumerations
- `GameModeCommand.cpp/h` -- /gamemode
- `GiveItemCommand.cpp/h` -- /give
- `KillCommand.cpp/h` -- /kill
- `TimeCommand.cpp/h` -- /time
- `ExperienceCommand.cpp/h` -- /xp
- `EnchantItemCommand.cpp/h` -- /enchant
- `DefaultGameModeCommand.cpp/h` -- /defaultgamemode
- `ToggleDownfallCommand.cpp/h` -- /toggledownfall
- `AdminLogCommand.h` -- Admin log command

---

## Minecraft.World -- Stats/Achievements

- `Stat.cpp/h` -- Base stat
- `Stats.cpp/h` -- Stats registry
- `GeneralStat.cpp/h` -- General stat
- `GenericStats.cpp/h` -- Generic stats
- `ItemStat.cpp/h` -- Item-related stat
- `CommonStats.cpp/h` -- Common statistics
- `DurangoStats.cpp/h` -- Xbox-specific stats
- `StatFormatter.h` -- Stat formatting
- `Achievement.cpp/h` -- Achievement
- `Achievements.cpp/h` -- Achievement registry

---

## Minecraft.World -- Utility/Core

### Math/Geometry
- `AABB.cpp/h` -- Axis-aligned bounding box
- `BoundingBox.cpp/h` -- Structure bounding box
- `Vec3.cpp/h` -- 3D vector
- `Pos.cpp/h` -- Block position
- `TilePos.cpp/h` -- Tile position
- `ChunkPos.cpp/h` -- Chunk position
- `Coord.h` -- Coordinate type
- `HitResult.cpp/h` -- Ray trace hit result
- `Direction.cpp/h` -- Direction enum
- `Facing.cpp/h` -- Block facing
- `Mth.cpp/h` -- Math utilities
- `JavaMath.cpp/h` -- Java math compatibility
- `Random.cpp/h` -- Random number generator
- `Color.cpp/h` -- Color utilities
- `GrassColor.cpp/h` -- Grass color
- `FoliageColor.cpp/h` -- Foliage color
- `WaterColor.cpp/h` -- Water color
- `SmoothFloat.cpp/h` -- Smoothed float value
- `IntCache.cpp/h` -- Integer array cache

### I/O
- `File.cpp/h` -- File abstraction
- `FileHeader.cpp/h` -- File header
- `InputStream.cpp/h` -- Input stream base
- `FileInputStream.cpp/h` -- File input
- `ByteArrayInputStream.cpp/h` -- Byte array input
- `OutputStream.h` -- Output stream
- `FileOutputStream.cpp/h` -- File output
- `ByteArrayOutputStream.cpp/h` -- Byte array output
- `BufferedOutputStream.cpp/h` -- Buffered output
- `BufferedReader.cpp/h` -- Buffered reader
- `InputStreamReader.cpp/h` -- Stream reader
- `DataInputStream.cpp/h` -- Data input (typed read)
- `DataOutputStream.cpp/h` -- Data output (typed write)
- `Buffer.cpp/h` -- Buffer base
- `ByteBuffer.cpp/h` -- Byte buffer
- `FloatBuffer.cpp/h` -- Float buffer
- `IntBuffer.cpp/h` -- Int buffer
- `Socket.cpp/h` -- Socket wrapper

### NBT
- `Tag.cpp/h` -- Base NBT tag
- `NbtIo.cpp/h` -- NBT I/O
- `NbtSlotFile.cpp/h` -- NBT slot file
- `CompoundTag.h`, `ListTag.h`, `ByteTag.h`, `ShortTag.h`, `IntTag.h`, `LongTag.h`, `FloatTag.h`, `DoubleTag.h`, `StringTag.h`, `ByteArrayTag.h`, `IntArrayTag.h`, `EndTag.h`
- `compression.cpp/h` -- Compression utilities

### Data/Serialization
- `SparseDataStorage.cpp/h` -- Sparse data storage
- `SparseLightStorage.cpp/h` -- Sparse light data
- `DataLayer.cpp/h` -- Nibble data layer (light, etc.)
- `Hasher.cpp/h` -- Hash utilities
- `HashExtension.h` -- Hash extensions
- `WeighedRandom.cpp/h` -- Weighted random selection
- `WeighedTreasure.cpp/h` -- Weighted treasure loot

### Threading/System
- `C4JThread.cpp/h` -- Thread wrapper
- `ThreadName.cpp/h` -- Thread naming
- `PerformanceTimer.cpp/h` -- Performance timer
- `SharedConstants.cpp/h` -- Shared constants
- `Definitions.h` -- Global definitions
- `system.cpp` / `System.h` -- System utilities
- `TickNextTickData.cpp/h` -- Scheduled tick data
- `Explosion.cpp/h` -- Explosion logic
- `Abilities.cpp/h` -- Player abilities
- `Rarity.cpp/h` -- Item rarity
- `DecorationMaterial.h` -- Decoration material type

### Localization
- `I18n.cpp/h` -- Internationalization
- `Language.cpp/h` -- Language data
- `StringHelpers.cpp/h` -- String utilities

### Java Compat
- `Class.cpp/h` -- Java class simulation
- `Reference.h` -- Reference wrapper
- `Arrays.h` -- Array utilities
- `ArrayWithLength.h` -- Array with length
- `BasicTypeContainers.cpp/h` -- Basic type containers
- `Exceptions.h` -- Exception types
- `NumberFormaters.h` -- Number formatting
- `FlippedIcon.cpp/h` -- Flipped icon
- `Icon.h` / `IconRegister.h` -- Icon interfaces
- `DelayedRelease.cpp/h` -- Delayed resource release

---

## Minecraft.Server

### Core
- `Core/DedicatedServer.cpp/h` -- Dedicated server main class
- `Core/DedicatedServer_Main.cpp` -- Server entry point
- `Core/ServerProperties.cpp/h` -- Server properties (server.properties)
- `Core/ServerLists.cpp/h` -- Ban/whitelist/op lists
- `Core/ServerLogger.cpp/h` -- Server logging

### Commands
- `Commands/ServerCommand.h` -- Server command base
- `Commands/ServerCommands.cpp/h` -- Command registration
- `Commands/ConsoleCommandDispatcher.cpp/h` -- Console command dispatch
- `Commands/ConsoleCommandSender.cpp/h` -- Console command sender
- `Commands/ServerTextList.h` -- Server text list
- Individual commands: `BanCommand`, `BanIpCommand`, `BanListCommand`, `DeOpCommand`, `DebugCommand`, `DefaultGameModeCommand`, `EnchantServerCommand`, `GameModeServerCommand`, `GiveServerCommand`, `HelpCommand`, `KickServerCommand`, `KillServerCommand`, `ListServerCommand`, `MeCommand`, `OpCommand`, `PardonCommand`, `PardonIpCommand`, `SaveAllCommand`, `SaveOffCommand`, `SaveOnCommand`, `SayCommand`, `SeedCommand`, `StopCommand`, `TimeServerCommand`, `ToggleDownfallServerCommand`, `TpCommand`, `WhitelistCommand`, `XpCommand`

### Platform/Linux
- `Linux/PosixNetLayer.cpp/h` -- POSIX networking layer
- `Linux/WinsockNetLayer.h` -- Winsock networking layer
- `Linux/LinuxCompat.h` -- Linux compatibility
- `Linux/stubs/` -- Windows API stubs for Linux (DirectXMath.h, d3d11.h, windows.h, WinSock2.h, etc.)

### Stubs
- `Stubs/ServerStubs.cpp` -- Stub implementations for server (1)
- `Stubs/ServerStubs2.cpp` -- Stub implementations for server (2)
- `Stubs/ServerStubs3.cpp` -- Stub implementations for server (3)

---

## Common (Shared Headers)

Note: The `Common/` directory at the project root contains shared headers that mirror `Minecraft.Client/Common/` -- includes App defines, enums, structs, Audio, GameRules, UI interfaces, Tutorial, Colours, Leaderboards, and other shared subsystems. These are the interface/header versions used by both client and server.

---

## File Counts Summary

| Directory | Approx Files |
|-----------|-------------|
| Minecraft.Client (top-level) | ~518 |
| Minecraft.Client/Common | ~700 |
| Minecraft.World | ~1568 |
| Common | ~80 |
| Minecraft.Server | ~90 |
| **Total** | **~2956** |
