---
title: Complete File Index
description: Index of all source files in both LCE modules.
---

LCE has two modules: **Minecraft.World** (game logic, networking, world simulation) and **Minecraft.Client** (rendering, UI, platform integration, server hosting). This page lists every `.cpp` and `.h` source file in both.

**LCEMP totals: 1,564 files in Minecraft.World, 1,392 files in Minecraft.Client, 2,956 files overall.**

**MinecraftConsoles totals: 1,837 files in Minecraft.World, ~2,150 source files in Minecraft.Client, ~3,987 source files overall.** (MinecraftConsoles also bundles media assets, DLC data, and third-party libraries that push the raw file count much higher.)

---

## Minecraft.World (LCEMP: 1,564 files)

All files live in a flat directory (`Minecraft.World/`) except for 7 headers in `x64headers/`.

### Tiles / Blocks (200 files)

Block type classes, tile entities, and tile items.

<details>
<summary>Tile classes (.h + .cpp pairs)</summary>

AirTile, AnvilTile, BedTile, BookshelfTile, BrewingStandTile, ButtonTile, CactusTile, CakeTile, CarrotTile, CauldronTile, ChestTile, ClayTile, ClothTile, CocoaTile, CoralTile, CropTile, DeadBushTile, DetectorRailTile, DiodeTile, DirectionalTile, DirtTile, DispenserTile, DoorTile, EggTile, EnchantmentTableTile, EnderChestTile, EntityTile, FarmTile, FenceGateTile, FenceTile, FireTile, FlowerPotTile, FurnaceTile, GlassTile, GrassTile, GravelTile, HalfSlabTile, HalfTransparentTile, HeavyTile, HellSandTile, HellStoneTile, HugeMushroomTile, IceTile, LadderTile, LeafTile, LeverTile, LightGemTile, LiquidTile, LiquidTileDynamic, LiquidTileStatic, LockedChestTile, MelonTile, MetalTile, MobSpawnerTile, MusicTile, MycelTile, NetherStalkTile, NotGateTile, ObsidianTile, OreTile, PistonBaseTile, PistonExtensionTile, PortalTile, PotatoTile, PressurePlateTile, PumpkinTile, QuartzBlockTile, RailTile, RecordPlayerTile, RedlightTile, RedStoneDustTile, RedStoneOreTile, ReedTile, SandStoneTile, SignTile, SkullTile, SmoothStoneBrickTile, SnowTile, SpringTile, StairTile, StemTile, StoneMonsterTile, StoneSlabTile, StoneTile, TheEndPortalFrameTile, ThinFenceTile, Tile, TntTile, TopSnowTile, TorchTile, TransparentTile, TrapDoorTile, TreeTile, TripWireSourceTile, TripWireTile, VineTile, WallTile, WaterLilyTile, WebTile, WoodSlabTile, WoodTile, WoolCarpetTile, WorkbenchTile

</details>

<details>
<summary>Tile entities</summary>

BrewingStandTileEntity, ChestTileEntity, DispenserTileEntity, EnchantmentTableEntity, EnderChestTileEntity, FurnaceTileEntity, MobSpawnerTileEntity, MusicTileEntity, PistonMovingPiece, PistonPieceEntity, SignTileEntity, SkullTileEntity, TheEndPortalTileEntity, TileEntity

</details>

<details>
<summary>Tile items</summary>

AnvilTileItem, AuxDataTileItem, ClothTileItem, ColoredTileItem, LeafTileItem, MultiTextureTileItem, PistonTileItem, SaplingTileItem, SmoothStoneBrickTileItem, StoneMonsterTileItem, StoneSlabTileItem, TileItem, TilePlanterItem, TreeTileItem, WaterLilyTileItem

</details>

### Items (84 files)

<details>
<summary>Item classes</summary>

ArmorItem, BedItem, BoatItem, BookItem, BottleItem, BowItem, BowlFoodItem, BucketItem, CarrotOnAStickItem, ClockItem, CoalItem, CompassItem, ComplexItem, DoorItem, DyePowderItem, EggItem (Item), EnchantedBookItem, EnderEyeItem, EnderpearlItem, ExperienceItem, FireChargeItem, FishingRodItem, FlintAndSteelItem, FoodItem, GoldenAppleItem, HangingEntityItem, HatchetItem, HoeItem, Item, ItemInstance, MapItem, MilkBucketItem, MinecartItem, MonsterPlacerItem, PickaxeItem, PotionItem, RecordingItem, RedStoneItem, SaddleItem, SeedFoodItem, SeedItem, ShearsItem, ShovelItem, SignItem, SkullItem, SnowballItem, WeaponItem

</details>

### Entities (134 files)

<details>
<summary>Entity classes</summary>

AgableMob, Animal, Arrow, Blaze, Boat, BossMob, BossMobPart, Bush, CaveSpider, Chicken, Cow, Creature, Creeper, EnderCrystal, EnderDragon, EnderMan, Entity, EntityIO, EntityPos, ExperienceOrb, EyeOfEnderSignal, FallingTile, Fireball, FishingHook, FlyingMob, Ghast, Giant, GlobalEntity, Golem, HangingEntity, ItemEntity, ItemFrame, LavaSlime, LightningBolt, Minecart, Mob, Monster, Mushroom, MushroomCow, Npc, Ozelot, Painting, PathfinderMob, Pig, PigZombie, Player, PrimedTnt, Sheep, Silverfish, Skeleton, Slime, SmallFireball, SnowMan, Snowball, Spider, Squid, TamableAnimal, Throwable, ThrownEgg, ThrownEnderpearl, ThrownExpBottle, ThrownPotion, Villager, VillagerGolem, WaterAnimal, Wolf, Zombie, DragonFireball

</details>

### Entity AI (96 files)

<details>
<summary>Goals and controls</summary>

ArrowAttackGoal, AvoidPlayerGoal, BegGoal, BodyControl, BreakDoorGoal, BreedGoal, ControlledByPlayerGoal, DefendVillageTargetGoal, DoorInteractGoal, EatTileGoal, FleeSunGoal, FloatGoal, FollowOwnerGoal, FollowParentGoal, Goal, GoalSelector, HurtByTargetGoal, InteractGoal, JumpControl, LeapAtTargetGoal, LookAtPlayerGoal, LookAtTradingPlayerGoal, LookControl, MakeLoveGoal, MeleeAttackGoal, MoveControl, MoveIndoorsGoal, MoveThroughVillageGoal, MoveTowardsRestrictionGoal, MoveTowardsTargetGoal, NearestAttackableTargetGoal, NonTameRandomTargetGoal, OcelotSitOnTileGoal, OfferFlowerGoal, OpenDoorGoal, OwnerHurtByTargetGoal, OwnerHurtTargetGoal, OzelotAttackGoal, PanicGoal, PlayGoal, RandomLookAroundGoal, RandomStrollGoal, RestrictOpenDoorGoal, RestrictSunGoal, SitGoal, SwellGoal, TakeFlowerGoal, TargetGoal, TemptGoal, TradeWithPlayerGoal

</details>

### Networking / Packets (112 files)

<details>
<summary>Packet classes</summary>

AddEntityPacket, AddExperienceOrbPacket, AddGlobalEntityPacket, AddMobPacket, AddPaintingPacket, AddPlayerPacket, AnimatePacket, AwardStatPacket, BlockRegionUpdatePacket, ChatAutoCompletePacket, ChatPacket, ChunkTilesUpdatePacket, ChunkVisibilityAreaPacket, ChunkVisibilityPacket, ClientCommandPacket, ClientInformationPacket, ClientProtocolPacket, ComplexItemDataPacket, Connection, ContainerAckPacket, ContainerButtonClickPacket, ContainerClickPacket, ContainerClosePacket, ContainerOpenPacket, ContainerSetContentPacket, ContainerSetDataPacket, ContainerSetSlotPacket, CraftItemPacket, CustomPayloadPacket, DebugOptionsPacket, DisconnectPacket, EntityActionAtPositionPacket, EntityEventPacket, ExplodePacket, GameCommandPacket, GameEventPacket, GetInfoPacket, InteractPacket, KeepAlivePacket, KickPlayerPacket, LevelEventPacket, LevelSoundPacket, LoginPacket, MoveEntityPacket, MoveEntityPacketSmall, MovePlayerPacket, Packet, PacketListener, PlayerAbilitiesPacket, PlayerActionPacket, PlayerCommandPacket, PlayerInfoPacket, PlayerInputPacket, PreLoginPacket, RemoveEntitiesPacket, RemoveMobEffectPacket, RespawnPacket, RotateHeadPacket, ServerAuthDataPacket, ServerSettingsChangedPacket, SetCarriedItemPacket, SetCreativeModeSlotPacket, SetEntityDataPacket, SetEntityMotionPacket, SetEquippedItemPacket, SetExperiencePacket, SetHealthPacket, SetRidingPacket, SetSpawnPositionPacket, SetTimePacket, SignUpdatePacket, TakeItemEntityPacket, TeleportEntityPacket, TextureAndGeometryChangePacket, TextureAndGeometryPacket, TextureChangePacket, TexturePacket, TileDestructionPacket, TileEntityDataPacket, TileEventPacket, TileUpdatePacket, TradeItemPacket, UpdateGameRuleProgressPacket, UpdateMobEffectPacket, UpdateProgressPacket, UseItemPacket, XZPacket

</details>

### World Generation (120 files)

<details>
<summary>Biomes, features, structures, layers</summary>

**Biomes:** BeachBiome, Biome, BiomeCache, BiomeDecorator, BiomeSource, DesertBiome, ExtremeHillsBiome, FixedBiomeSource, ForestBiome, HellBiome, IceBiome, JungleBiome, MushroomIslandBiome, OceanBiome, PlainsBiome, RainforestBiome, RiverBiome, SwampBiome, TaigaBiome, TheEndBiome, TheEndBiomeDecorator

**Features:** BasicTree, BirchFeature, BonusChestFeature, CactusFeature, CanyonFeature, CaveFeature, ClayFeature, DeadBushFeature, DesertWellFeature, DungeonFeature, EndPodiumFeature, Feature, FlowerFeature, GroundBushFeature, HellFireFeature, HellPortalFeature, HellSpringFeature, HugeMushroomFeature, LakeFeature, LargeCaveFeature, LargeFeature, LargeHellCaveFeature, LightGemFeature, MegaTreeFeature, MineShaftFeature, MineShaftPieces, MineShaftStart, MonsterRoomFeature, NetherBridgeFeature, NetherBridgePieces, OreFeature, PineFeature, PumpkinFeature, RandomScatteredLargeFeature, ReedsFeature, SandFeature, ScatteredFeaturePieces, SpikeFeature, SpringFeature, SpruceFeature, StrongholdFeature, StrongholdPieces, StructureFeature, StructurePiece, StructureStart, SwampTreeFeature, TallGrassFeature, TreeFeature, VillageFeature, VillagePieces, VinesFeature, WaterlilyFeature

**Layers:** AddIslandLayer, AddMushroomIslandLayer, AddSnowLayer, BiomeInitLayer, BiomeOverrideLayer, DownfallLayer, DownfallMixerLayer, FuzzyZoomLayer, GrowMushroomIslandLayer, IslandLayer, Layer, RegionHillsLayer, RiverInitLayer, RiverLayer, RiverMixerLayer, ShoreLayer, SmoothLayer, SmoothZoomLayer, SwampRiversLayer, TemperatureLayer, TemperatureMixerLayer, VoronoiZoom, ZoomLayer

**Level sources:** CustomLevelSource, FlatLevelSource, HellFlatLevelSource, HellRandomLevelSource, RandomLevelSource, TheEndLevelRandomLevelSource

</details>

### Inventory / Containers (62 files)

<details>
<summary>Menus, slots, containers</summary>

AbstractContainerMenu, BrewingStandMenu, CompoundContainer, Container, ContainerMenu, CraftingContainer, CraftingMenu, EnchantmentContainer, EnchantmentMenu, FurnaceMenu, FurnaceResultSlot, InventoryMenu, Inventory, MerchantContainer, MerchantMenu, MerchantResultSlot, PlayerEnderChestContainer, RepairContainer, RepairMenu, RepairResultSlot, ResultContainer, ResultSlot, SimpleContainer, Slot, TrapMenu

</details>

### Enchantments (28 files)

<details>
<summary>Enchantment classes</summary>

ArrowDamageEnchantment, ArrowFireEnchantment, ArrowInfiniteEnchantment, ArrowKnockbackEnchantment, DamageEnchantment, DigDurabilityEnchantment, DiggingEnchantment, Enchantment, EnchantmentCategory, EnchantmentHelper, EnchantmentInstance, FireAspectEnchantment, KnockbackEnchantment, LootBonusEnchantment, OxygenEnchantment, ProtectionEnchantment, ThornsEnchantment, UntouchingEnchantment, WaterWorkerEnchantment

</details>

### Crafting / Recipes (20 files)

<details>
<summary>Recipe files</summary>

ArmorDyeRecipe, ArmorRecipes, ClothDyeRecipes, FoodRecipies, FurnaceRecipes, OreRecipies, Recipes, Recipy, ShapedRecipy, ShapelessRecipy, StructureRecipies, ToolRecipies, WeaponRecipies

</details>

### Commands (18 files)

<details>
<summary>Command classes</summary>

AdminLogCommand, Command, CommandDispatcher, DefaultGameModeCommand, EnchantItemCommand, ExperienceCommand, GameModeCommand, GiveItemCommand, KillCommand, TimeCommand, ToggleDownfallCommand

</details>

### Effects and Damage (18 files)

<details>
<summary>Mob effects and damage sources</summary>

DamageSource, EntityDamageSource, IndirectEntityDamageSource, InstantenousMobEffect, MobEffect, MobEffectInstance, PotionBrewing

</details>

### Statistics (20 files)

<details>
<summary>Stats classes</summary>

Achievement, Achievements, CommonStats, DurangoStats, GeneralStat, GenericStats, ItemStat, Stat, Stats

</details>

### Level / World (72 files)

<details>
<summary>Level management and storage</summary>

BlockDestructionProgress, CompressedTileStorage, DataLayer, DerivedLevelData, Dimension, EmptyLevelChunk, FlatLayer, HellDimension, Level, LevelChunk, LevelConflictException, LevelData, LevelSettings, LevelStorage, LevelStorageProfilerDecorator, LevelSummary, LevelType, MobSpawner, NetherSphere, NormalDimension, ReadOnlyChunkCache, Region, SkyIslandDimension, SparseDataStorage, SparseLightStorage, TheEndDimension, TickNextTickData, TileEventData, TilePos, Village, Villages, VillageSiege, WaterColor, WaterLevelChunk

**Storage:** ChunkStorageProfileDecorator, ConsoleSaveFile, ConsoleSaveFileConverter, ConsoleSaveFileInputStream, ConsoleSaveFileIO, ConsoleSaveFileOriginal, ConsoleSaveFileOutputStream, ConsoleSaveFileSplit, DirectoryLevelStorage, DirectoryLevelStorageSource, McRegionChunkStorage, McRegionLevelStorage, McRegionLevelStorageSource, MemoryChunkStorage, MemoryLevelStorage, MemoryLevelStorageSource, MockedLevelStorage, NbtSlotFile, OldChunkStorage, RegionFile, RegionFileCache, SavedData, SavedDataStorage, ZonedChunkStorage, ZoneFile, ZoneIo

</details>

### Pathfinding / Navigation (10 files)

<details>
<summary>Pathfinding classes</summary>

BinaryHeap, Node, Path, PathFinder, PathNavigation, RandomPos, Sensing

</details>

### Data / IO / Utility (90 files)

<details>
<summary>Streams, NBT, math, threading, etc.</summary>

**IO / Streams:** Buffer, BufferedOutputStream, BufferedReader, ByteArrayInputStream, ByteArrayOutputStream, ByteBuffer, DataInputStream, DataOutputStream, File, FileHeader, FileInputStream, FileOutputStream, FloatBuffer, InputStream, InputStreamReader, IntBuffer, NbtIo, OutputStream, Socket

**NBT Tags:** ByteArrayTag, ByteTag, CompoundTag, DoubleTag, EndTag, FloatTag, IntArrayTag, IntTag, ListTag, LongTag, ShortTag, StringTag, Tag

**Math / Noise:** AABB, Coord, Distort, Emboss, FastNoise, Facing, HitResult, ImprovedNoise, JavaMath, Mth, PerlinNoise, PerlinSimplexNoise, Pos, Random, Rotate, Scale, SimplexNoise, SmoothFloat, Synth, Vec3, WeighedRandom

**Threading / System:** C4JThread, Class, PerformanceTimer, SharedConstants, System, ThreadName

**Other utility:** Abilities, Arrays, ArrayWithLength, BasicTypeContainers, BlockReplacements, BlockGenMethods, Color, Definitions, DelayedRelease, DescFormatter, Direction, Explosion, FoliageColor, FoodConstants, FoodData, GrassColor, Hasher, I18n, IntCache, Language, Material, MaterialColor, MenuBackup, MobCategory, NumberFormaters, Rarity, Reference, Sponge, StringHelpers, SynchedEntityData, TallGrass, WeighedTreasure

</details>

### Merchant / Trading (12 files)

<details>
<summary>Trading system</summary>

ClientSideMerchant, Merchant, MerchantRecipe, MerchantRecipeList, MapItemSavedData

</details>

### Header Aggregates (56 files)

Umbrella headers that include groups of related files (e.g., `net.minecraft.world.level.tile.h`, `net.minecraft.world.entity.h`).

### x64headers/ (7 files)

Platform-specific headers for Xbox 360 / x64: `extraX64.h`, `qnet.h`, `xmcore.h`, `xrnm.h`, `xsocialpost.h`, `xuiapp.h`, `xuiresource.h`

### Build Support (4 files)

`stdafx.cpp`, `stdafx.h`, `Minecraft.World.cpp`, `Minecraft.World.h`

---

## Additional Files in MinecraftConsoles Minecraft.World

MinecraftConsoles adds about 275 new files to `Minecraft.World/`. These fall into several categories.

### New Tile / Block Classes

BeaconTile, BeaconTileEntity, BaseEntityTile, BasePressurePlateTile, BaseRailTile, ColoredTile, ComparatorTile, ComparatorTileEntity, DaylightDetectorTile, DaylightDetectorTileEntity, DropperTile, DropperTileEntity, GlowstoneTile, HayBlockTile, HopperTile, HopperTileEntity, JukeboxTile, NetherrackTile, NetherWartTile, NoteBlockTile, PoweredMetalTile, PoweredRailTile, RepeaterTile, RotatedPillarTile, SoulSandTile, StainedGlassBlock, StainedGlassPaneBlock, StoneButtonTile, WeightedPressurePlateTile, WoodButtonTile, CommandBlockEntity

### New Item Classes

EmptyMapItem, FireworksItem, FireworksChargeItem, LeashItem, NameTagItem, SimpleFoiledItem, SnowItem, SpawnEggItem, WrittenBookItem, WoolTileItem

### New Entity Classes

AmbientCreature, Bat, EntityHorse, FireworksRocketEntity, LargeFireball, LeashFenceKnotEntity, LivingEntity, MinecartChest, MinecartContainer, MinecartFurnace, MinecartHopper, MinecartRideable, MinecartSpawner, MinecartTNT, MultiEntityMob, MultiEntityMobPart, Ocelot, Witch, WitherBoss, WitherSkull

### New Entity AI

OcelotAttackGoal (renamed from OzelotAttackGoal), RangedAttackGoal, RunAroundLikeCrazyGoal

### New Packet Classes

LevelParticlesPacket, SetDisplayObjectivePacket, SetEntityLinkPacket, SetObjectivePacket, SetPlayerTeamPacket, SetScorePacket, TileEditorOpenPacket, UpdateAttributesPacket

### Attribute System (new)

Attribute, AttributeInstance, AttributeModifier, BaseAttribute, BaseAttributeMap, ModifiableAttributeInstance, RangedAttribute, ServersideAttributeMap, SharedMonsterAttributes

### Scoreboard System (new)

DummyCriteria, HealthCriteria, Objective, ObjectiveCriteria, PlayerTeam, Score, Scoreboard, ScoreboardSaveData, ScoreHolder, Team

### New Command Classes

CommandBlock, CommandBlockEntity, EffectCommand, GameDifficultyCommand, GameRuleCommand, PlaySoundCommand, SetPlayerTimeoutCommand, ShowSeedCommand, SpreadPlayersCommand, WeatherCommand

### New Container / Menu Classes

AnvilMenu, BeaconMenu, FireworksMenu, HopperMenu, HorseInventoryMenu, MinecartContainer, WorldlyContainer

### New World Generation Files

FlatGeneratorInfo, FlatLayerInfo, StructureFeatureIO, StructureFeatureSavedData

### Game Rules System (new)

GameRules

### Dispenser Behavior System (new)

AbstractProjectileDispenseBehavior, Behavior, BehaviorRegistry, DefaultDispenseItemBehavior, DispenseItemBehavior, ItemDispenseBehaviors

### New Mob Effects

AbsoptionMobEffect, AttackDamageMobEffect, HealthBoostMobEffect

### New Crafting

FireworksRecipe, MapCloningRecipe, MapExtendingRecipe

### Entity Selectors and Misc

BlockSource, BlockSourceImpl, Calendar, CombatEntry, CombatTracker, EntitySelector, FacingEnum, HtmlString, LocatableSource, Location, MobGroupData, OwnableEntity, PlayerSelector, Position, PositionImpl, Projectile, RangedAttackMob, Redstone, Source

### New Aggregate Headers

`net.minecraft.core.h`, `net.minecraft.world.entity.ai.attributes.h`, `net.minecraft.world.entity.ambient.h`, `net.minecraft.world.level.levelgen.flat.h`, `net.minecraft.world.level.redstone.h`, `net.minecraft.world.scores.criteria.h`, `net.minecraft.world.scores.h`

:::note
MinecraftConsoles also renamed several LCEMP files (the class stayed the same, but the code name changed). For example, `HellSandTile` became `SoulSandTile`, `HellStoneTile` became `NetherrackTile`, `MusicTile` became `NoteBlockTile`, `NetherStalkTile` became `NetherWartTile`, `LightGemTile` became `GlowstoneTile`, `DiodeTile` became `RepeaterTile`, and `RecordPlayerTile` became `JukeboxTile`. Both old and new versions exist in the MinecraftConsoles source since the old names are still referenced in some places.
:::

---

## Minecraft.Client (LCEMP: 1,392 files)

The Client module has a deeper directory structure with platform-specific subdirectories.

### Root Directory: Rendering (174 files)

Core rendering, models, entity renderers, and particle effects at the top level.

<details>
<summary>Entity renderers</summary>

ArrowRenderer, BlazeRenderer, BoatRenderer, ChestRenderer, ChickenRenderer, CowRenderer, CreeperRenderer, DefaultRenderer, EnchantTableRenderer, EnderChestRenderer, EnderCrystalRenderer, EnderDragonRenderer, EndermanRenderer, EntityRenderDispatcher, EntityRenderer, EntityTileRenderer, ExperienceOrbRenderer, FallingTileRenderer, FireballRenderer, FishingHookRenderer, GhastRenderer, GiantMobRenderer, HumanoidMobRenderer, ItemFrameRenderer, ItemInHandRenderer, ItemRenderer, ItemSpriteRenderer, LavaSlimeRenderer, LightningBoltRenderer, MinecartRenderer, MobRenderer, MobSpawnerRenderer, MushroomCowRenderer, OzelotRenderer, PaintingRenderer, PigRenderer, PistonPieceRenderer, PlayerRenderer, SheepRenderer, SignRenderer, SilverfishRenderer, SkullTileRenderer, SlimeRenderer, SnowManRenderer, SpiderRenderer, SquidRenderer, TheEndPortalRenderer, TileEntityRenderDispatcher, TileEntityRenderer, TileRenderer, TntRenderer, VillagerGolemRenderer, VillagerRenderer, WolfRenderer, ZombieRenderer

</details>

<details>
<summary>Models</summary>

BlazeModel, BoatModel, BookModel, ChestModel, ChickenModel, CowModel, CreeperModel, Cube, DragonModel, EnderCrystalModel, EndermanModel, GhastModel, HumanoidModel, LargeChestModel, LavaSlimeModel, MinecartModel, Model, ModelPart, OzelotModel, PigModel, Polygon, QuadrupedModel, SheepFurModel, SheepModel, SignModel, SilverfishModel, SkeletonHeadModel, SkeletonModel, SlimeModel, SnowManModel, SpiderModel, SquidModel, TexOffs, Vertex, VillagerGolemModel, VillagerModel, VillagerZombieModel, WolfModel, ZombieModel

</details>

<details>
<summary>Particles</summary>

BreakingItemParticle, BubbleParticle, CritParticle, CritParticle2, DragonBreathParticle, DripParticle, EchantmentTableParticle, EnderParticle, ExplodeParticle, FlameParticle, FootstepParticle, GuiParticle, GuiParticles, HeartParticle, HugeExplosionParticle, HugeExplosionSeedParticle, LavaParticle, NetherPortalParticle, NoteParticle, Particle, ParticleEngine, PlayerCloudParticle, RedDustParticle, SmokeParticle, SnowShovelParticle, SpellParticle, SplashParticle, SuspendedParticle, SuspendedTownParticle, TakeAnimationParticle, TerrainParticle, WaterDropParticle

</details>

### Root Directory: Screens / UI (82 files)

<details>
<summary>Screen classes</summary>

AbstractContainerScreen, AchievementPopup, AchievementScreen, Button, ChatScreen, ConfirmScreen, ConnectScreen, ContainerScreen, ControlsScreen, CraftingScreen, CreateWorldScreen, DeathScreen, DisconnectedScreen, EditBox, ErrorScreen, FurnaceScreen, Gui, GuiComponent, GuiMessage, InBedChatScreen, InventoryScreen, JoinMultiplayerScreen, NameEntryScreen, OptionsScreen, PauseScreen, ReceivingLevelScreen, RenameWorldScreen, Screen, ScrolledSelectionList, SelectWorldScreen, SlideButton, SmallButton, StatsScreen, TextEditScreen, TitleScreen, TrapScreen, VideoSettingsScreen, ProgressRenderer

</details>

### Root Directory: Core Engine (90 files)

<details>
<summary>Core client classes</summary>

AllowAllCuller, Camera, Chunk, ClientConnection, ClientConstants, ClockTexture, CompassTexture, CreativeMode, Culler, DemoLevel, DemoMode, DemoUser, DerivedServerLevel, DirtyChunkSorter, DistanceChunkSorter, EntityTracker, Font, Frustum, FrustumCuller, FrustumData, GameMode, GameRenderer, Input, KeyboardMouseInput, KeyMapping, LevelRenderer, Lighting, LocalPlayer, MemoryTracker, Minecraft, MinecraftServer, Minimap, MobSkinMemTextureProcessor, MobSkinTextureProcessor, MultiPlayerChunkCache, MultiPlayerGameMode, MultiPlayerLevel, MultiPlayerLocalPlayer, OffsettedRenderList, Options, PendingConnection, PlayerChunkMap, PlayerConnection, PlayerList, Rect2i, RemotePlayer, ScreenSizeCalculator, ServerChunkCache, ServerCommandDispatcher, ServerConnection, ServerLevel, ServerLevelListener, ServerPlayer, ServerPlayerGameMode, Settings, SimpleIcon, StatsCounter, StatsSyncher, SurvivalMode, SkinBox, StringTable, Tesselator, Timer, TrackedEntity, User, ViewportCuller, WstringLookup

</details>

### Root Directory: Textures (38 files)

<details>
<summary>Texture system</summary>

AbstractTexturePack, ArchiveFile, BufferedImage, DefaultTexturePack, DLCTexturePack, FileTexturePack, FolderTexturePack, HttpTexture, HttpTextureProcessor, MemTexture, MemTextureProcessor, PreStitchedTextureMap, StitchedTexture, Stitcher, StitchSlot, Texture, TextureHolder, TextureManager, TextureMap, TexturePack, TexturePackRepository, Textures

</details>

### Root Directory: Server (18 files)

<details>
<summary>Server-side classes at root</summary>

ConsoleInput, ConsoleInputSource, PlayerInfo, ServerInterface, TeleportCommand

</details>

### Common/ (282 files)

Shared code used across all platforms.

<details>
<summary>Common/Audio/ (5 files)</summary>

`Consoles_SoundEngine.cpp`, `Consoles_SoundEngine.h`, `SoundEngine.cpp`, `SoundEngine.h`, `SoundNames.cpp`

</details>

<details>
<summary>Common/Colours/ (2 files)</summary>

`ColourTable.cpp`, `ColourTable.h`

</details>

<details>
<summary>Common/DLC/ (11 files)</summary>

`DLCAudioFile.h`, `DLCColourTableFile.h`, `DLCGameRules.h`, `DLCGameRulesFile.h`, `DLCGameRulesHeader.h`, `DLCLocalisationFile.h`, `DLCManager.h`, `DLCPack.h`, `DLCSkinFile.h`, `DLCTextureFile.h`, `DLCUIDataFile.h`

</details>

<details>
<summary>Common/GameRules/ (34 files)</summary>

AddEnchantmentRuleDefinition, AddItemRuleDefinition, ApplySchematicRuleDefinition, BiomeOverride, CollectItemRuleDefinition, CompleteAllRuleDefinition, CompoundGameRuleDefinition, ConsoleGameRules, ConsoleGameRulesConstants, ConsoleGenerateStructure, ConsoleGenerateStructureAction, ConsoleSchematicFile, GameRule, GameRuleDefinition, GameRuleManager, GameRulesInstance, LevelGenerationOptions, LevelGenerators, LevelRules, LevelRuleset, NamedAreaRuleDefinition, StartFeature, UpdatePlayerRuleDefinition, UseTileRuleDefinition, XboxStructureActionGenerateBox, XboxStructureActionPlaceBlock, XboxStructureActionPlaceContainer, XboxStructureActionPlaceSpawner

</details>

<details>
<summary>Common/Leaderboards/ (2 files)</summary>

`LeaderboardManager.cpp`, `LeaderboardManager.h`

</details>

<details>
<summary>Common/Network/ (8 files)</summary>

`GameNetworkManager.cpp`, `GameNetworkManager.h`, `NetworkPlayerInterface.h`, `PlatformNetworkManagerInterface.h`, `PlatformNetworkManagerStub.cpp`, `PlatformNetworkManagerStub.h`, `SessionInfo.h`

</details>

<details>
<summary>Common/Telemetry/ (2 files)</summary>

`TelemetryManager.cpp`, `TelemetryManager.h`

</details>

<details>
<summary>Common/Trial/ (2 files)</summary>

`TrialMode.cpp`, `TrialMode.h`

</details>

<details>
<summary>Common/Tutorial/ (52 files)</summary>

AreaConstraint, AreaHint, AreaTask, ChangeStateConstraint, ChoiceTask, CompleteUsingItemTask, ControllerTask, CraftTask, DiggerItemHint, EffectChangedTask, FullTutorial, FullTutorialActiveTask, FullTutorialMode, InfoTask, InputConstraint, LookAtEntityHint, LookAtTileHint, PickupTask, ProcedureCompoundTask, ProgressFlagTask, StateChangeTask, StatTask, TakeItemHint, Tutorial, TutorialConstraint, TutorialConstraints, TutorialEnum, TutorialHint, TutorialHints, TutorialMessage, TutorialMode, TutorialTask, TutorialTasks, UseItemTask, UseTileTask, XuiCraftingTask

</details>

<details>
<summary>Common/UI/ (124 files)</summary>

**Framework:** IUIController, UI, UIBitmapFont, UIControl, UIControl_Base, UIController, UIEnums, UIFontData, UIGroup, UILayer, UIScene, UIStructs, UITTFFont

**Components:** UIComponent_Chat, UIComponent_DebugUIConsole, UIComponent_DebugUIMarketingGuide, UIComponent_Logo, UIComponent_MenuBackground, UIComponent_Panorama, UIComponent_PressStartToPlay, UIComponent_Tooltips, UIComponent_TutorialPopup

**Controls:** UIControl_BitmapIcon, UIControl_Button, UIControl_ButtonList, UIControl_CheckBox, UIControl_Cursor, UIControl_DLCList, UIControl_DynamicLabel, UIControl_EnchantmentBook, UIControl_EnchantmentButton, UIControl_HTMLLabel, UIControl_Label, UIControl_LeaderboardList, UIControl_MinecraftPlayer, UIControl_PlayerList, UIControl_PlayerSkinPreview, UIControl_Progress, UIControl_SaveList, UIControl_Slider, UIControl_SlotList, UIControl_SpaceIndicatorBar, UIControl_TextInput, UIControl_TexturePackList, UIControl_Touch

**Scenes:** UIScene_AbstractContainerMenu, UIScene_AnvilMenu, UIScene_BrewingStandMenu, UIScene_ConnectingProgress, UIScene_ContainerMenu, UIScene_ControlsMenu, UIScene_CraftingMenu, UIScene_CreateWorldMenu, UIScene_CreativeMenu, UIScene_Credits, UIScene_DeathMenu, UIScene_DebugCreateSchematic, UIScene_DebugOptions, UIScene_DebugOverlay, UIScene_DebugSetCamera, UIScene_DispenserMenu, UIScene_DLCMainMenu, UIScene_DLCOffersMenu, UIScene_EnchantingMenu, UIScene_EndPoem, UIScene_EULA, UIScene_FullscreenProgress, UIScene_FurnaceMenu, UIScene_HelpAndOptionsMenu, UIScene_HowToPlay, UIScene_HowToPlayMenu, UIScene_HUD, UIScene_InGameHostOptionsMenu, UIScene_InGameInfoMenu, UIScene_InGamePlayerOptionsMenu, UIScene_InGameSaveManagementMenu, UIScene_Intro, UIScene_InventoryMenu, UIScene_JoinMenu, UIScene_Keyboard, UIScene_LaunchMoreOptionsMenu, UIScene_LeaderboardsMenu, UIScene_LoadMenu, UIScene_LoadOrJoinMenu, UIScene_MainMenu, UIScene_MessageBox, UIScene_PauseMenu, UIScene_QuadrantSignin, UIScene_ReinstallMenu, UIScene_SaveMessage, UIScene_SettingsAudioMenu, UIScene_SettingsControlMenu, UIScene_SettingsGraphicsMenu, UIScene_SettingsMenu, UIScene_SettingsOptionsMenu, UIScene_SettingsUIMenu, UIScene_SignEntryMenu, UIScene_SkinSelectMenu, UIScene_TeleportMenu, UIScene_Timer, UIScene_TradingMenu, UIScene_TrialExitUpsell

**IUI interfaces:** IUIScene_AbstractContainerMenu, IUIScene_AnvilMenu, IUIScene_BrewingMenu, IUIScene_ContainerMenu, IUIScene_CraftingMenu, IUIScene_CreativeMenu, IUIScene_DispenserMenu, IUIScene_EnchantingMenu, IUIScene_FurnaceMenu, IUIScene_InventoryMenu, IUIScene_PauseMenu, IUIScene_StartGame, IUIScene_TradingMenu

</details>

<details>
<summary>Common/XUI/ (90 files)</summary>

Xbox UI (XUI) scene and control implementations. Includes SlotProgressControl, XUI_BasePlayer, XUI_Chat, XUI_ConnectingProgress, XUI_Control_ComboBox, XUI_Controls, plus ~40 XUI_Ctrl_* control classes, ~20 XUI_Scene_* scene classes, and ~15 XUI settings/menu/debug screens.

</details>

<details>
<summary>Common/ root headers (8 files)</summary>

`App_Defines.h`, `App_enums.h`, `App_structs.h`, `BuildVer.h`, `C4JMemoryPool.h`, `C4JMemoryPoolAllocator.h`, `ConsoleGameMode.cpp`, `ConsoleGameMode.h`, `Consoles_App.cpp`, `Consoles_App.h`, `Console_Awards_enum.h`, `Console_Debug_enum.h`, `Console_Utils.cpp`, `Minecraft_Macros.h`, `Potion_Macros.h`, `xuiscene_base.h`

</details>

<details>
<summary>Common/zlib/ (11 files)</summary>

`crc32.h`, `deflate.h`, `gzguts.h`, `inffast.h`, `inffixed.h`, `inflate.h`, `inftrees.h`, `trees.h`, `zconf.h`, `zlib.h`, `zutil.h`

</details>

### Platform: Durango / Xbox One (58 files)

<details>
<summary>Durango/ subdirectories</summary>

**Achievements:** AchievementManager

**Root:** ApplicationView, Durango_App, Durango_Minecraft, Durango_UIController, Minecraft_Macros, PresenceIds, Resource, targetver, Xbox_Awards_enum, Xbox_BuildVer, Xbox_Debug_enum, Xbox_Utils, XboxGameMode

**DurangoExtras:** DurangoStubs, xcompress

**Leaderboards:** DurangoLeaderboardManager, DurangoStatsDebugger, GameProgress

**Network:** base64, ChatIntegrationLayer, DQRNetworkManager (+ _FriendSessions, _Log, _SendReceive, _XRNSEvent), DQRNetworkPlayer, NetworkPlayerDurango, PartyController, PlatformNetworkManagerDurango

**Social:** SocialManager

**XML:** ATGXmlParser, xmlFilesCallback

**ServiceConfig:** Events-XBLA.8-149E11AEEvents

</details>

### Platform: Xbox 360 (26 files)

<details>
<summary>Xbox/ subdirectories</summary>

**Root:** Xbox_App, Xbox_BuildVer, Xbox_Minecraft, Xbox_UIController

**Leaderboards:** XboxLeaderboardManager

**Network:** NetworkPlayerXbox, PlatformNetworkManagerXbox

**Social:** SocialManager

**XML:** ATGXmlParser, xmlFilesCallback

**GameConfig:** Minecraft.spa

</details>

### Platform: PS3 (40 files)

<details>
<summary>PS3/ subdirectories</summary>

**Root:** PS3_App, PS3_Minecraft (Xbox_Minecraft.cpp), PS3_PlayerUID, PS3_UIController, XboxGameMode

**Assert:** assert

**Audio:** PS3_SoundEngine

**GameConfig:** Minecraft.spa

**Leaderboards:** base64, PS3LeaderboardManager

**Network:** SonyCommerce_PS3, SonyHttp_PS3, SonyRemoteStorage_PS3, SonyVoiceChat, SQRNetworkManager_PS3

**PS3Extras:** C4JSpursJob, C4JThread_SPU, EdgeZLib, PS3Maths, PS3Strings, Ps3Stubs, Ps3Types, ShutdownManager, TLSStorage, winerror

**Social:** SocialManager

**XML:** ATGXmlParser, xmlFilesCallback

</details>

### Platform: PS4 / Orbis (44 files)

<details>
<summary>Orbis/ subdirectories</summary>

**Root:** Orbis_App, Orbis_Minecraft, Orbis_PlayerUID, Orbis_UIController, ps4__np_conf, user_malloc, user_malloc_for_tls, user_new, Xbox_BuildVer

**Assert:** assert

**Leaderboards:** base64, OrbisLeaderboardManager

**Minecraft_Macros.h**

**Network:** Orbis_NPToolkit, PsPlusUpsellWrapper_Orbis, SonyCommerce_Orbis, SonyHttp_Orbis, SonyRemoteStorage_Orbis, SonyVoiceChat_Orbis, SonyVoiceChatParty_Orbis, SQRNetworkManager_Orbis

**OrbisExtras:** OrbisMaths, OrbisStubs, OrbisTypes, ShutdownManager, TLSStorage, winerror

**Social:** SocialManager

**XML:** ATGXmlParser

</details>

### Platform: PS Vita (42 files)

<details>
<summary>PSVita/ subdirectories</summary>

**Root:** PSVita_App, PSVita_Minecraft, PSVita_PlayerUID, PSVita_UIController

**Assert:** assert

**GameConfig:** Minecraft.spa

**Leaderboards:** base64, PSVitaLeaderboardManager

**Network:** PSVita_NPToolkit, SonyCommerce_Vita, SonyHttp_Vita, SonyRemoteStorage_Vita, SonyVoiceChat_Vita, SQRNetworkManager_AdHoc_Vita, SQRNetworkManager_Vita

**PSVitaExtras:** Conf, CustomMap, CustomSet, libdivide, PSVitaMaths, PSVitaStrings, PsVitaStubs, PSVitaTLSStorage, PSVitaTypes, ShutdownManager, TLSStorage, user_new, zconf, zlib

**Social:** SocialManager

**XML:** ATGXmlParser

</details>

### Platform: Windows 64-bit (18 files)

<details>
<summary>Windows64/ subdirectories</summary>

**Root:** Windows64_App, Windows64_Minecraft, Windows64_PostProcess, Windows64_UIController, Minecraft_Macros, Resource, Xbox_BuildVer

**Leaderboards:** WindowsLeaderboardManager

**Network:** WinsockNetLayer

**Social:** SocialManager

**XML:** ATGXmlParser

**GameConfig:** Minecraft.spa

</details>

### Windows_Libs/ (32 files)

<details>
<summary>Windows development libraries</summary>

**Dev/Render:** 4J_Render, CompiledShaders, Profiler, Renderer, RendererCBuff, RendererCore, RendererMatrix, RendererState, RendererTexture, RendererVertex, stdafx, and shader headers (PS_*, VS_*)

**Dev/Render/libpng:** png, pngconf, pngdebug, pnginfo, pnglibconf, pngpriv, pngstruct

**Dev/Render/microprofile:** microprofile, microprofile.config, microprofile_html, microprofile_icons, stb_sprintf

**Dev/Render/zlib:** zconf, zlib

**Dev/Storage:** 4J_Storage, STO_DLC, STO_Main, STO_SaveGame, stdafx

</details>

### Root Build Support (4 files)

`stdafx.cpp`, `stdafx.h`, `stubs.cpp`, `stubs.h`

---

## Additional Files in MinecraftConsoles Minecraft.Client

MinecraftConsoles adds a lot to the Client module. Here's what's new beyond the LCEMP baseline.

### New Renderers and Models

**Renderers:** BatRenderer, BeaconRenderer, CaveSpiderRenderer, HorseRenderer, LeashKnotRenderer, LivingEntityRenderer, MinecartSpawnerRenderer, OcelotRenderer (replaces OzelotRenderer), SkeletonRenderer, TntMinecartRenderer, WitchRenderer, WitherBossRenderer, WitherSkullRenderer

**Models:** BatModel, LeashKnotModel, ModelHorse, OcelotModel, SkiModel, WitchModel, WitherBossModel

**Particles:** FireworksParticles

**Other:** BossMobGuiInfo, ServerScoreboard, TextureAtlas, ResourceLocation, DispenserBootstrap

### New UI Files (Common/UI/)

**Scenes:** UIScene_BeaconMenu, UIScene_FireworksMenu, UIScene_HopperMenu, UIScene_HorseInventoryMenu, UIScene_LanguageSelector, UIScene_NewUpdateMessage

**Controls:** UIControl_BeaconEffectButton, UIControl_MinecraftHorse

**IUI interfaces:** IUIScene_BeaconMenu, IUIScene_CommandBlockMenu, IUIScene_FireworksMenu, IUIScene_HopperMenu, IUIScene_HorseInventoryMenu, IUIScene_HUD

**Utility:** UISplitScreenHelpers, UIString

### New Tutorial Files

HorseChoiceTask, RideEntityTask

### New Common Files

`Common/DummyTexturePack/`, `Common/PostProcesser.h`

### Sony Shared Network Layer (Common/Network/Sony/)

MinecraftConsoles refactored the Sony networking code into a shared directory used by all three Sony platforms (PS3, PS4, Vita). These files contain the base implementations:

| File | Purpose |
|------|---------|
| `SQRNetworkManager.h/.cpp` | Base NP Matching2 network manager |
| `SQRNetworkPlayer.h/.cpp` | Base Sony network player |
| `PlatformNetworkManagerSony.h/.cpp` | Base `CPlatformNetworkManager` for Sony |
| `NetworkPlayerSony.h/.cpp` | Base network player for Sony |
| `SonyCommerce.h/.cpp` | Shared PlayStation Store integration |
| `SonyHttp.h/.cpp` | Shared HTTP client |
| `SonyRemoteStorage.h/.cpp` | Shared cloud save / remote storage |
| `sceRemoteStorage/` | Platform-specific remote storage headers (ps3, ps4, psvita subdirectories) |

Platform-specific files (e.g., `SQRNetworkManager_PS3.cpp`, `SQRNetworkManager_Orbis.cpp`) extend these shared base classes with platform-specific details.

### Per-Platform Additions in MinecraftConsoles

Each platform directory gained several new subdirectories in MinecraftConsoles:

**All platforms:** `4JLibs/inc/` (4J_Render.h, 4J_Input.h, 4J_Profile.h, 4J_Storage.h), `Iggy/` (gdraw and include), `Miles/include/` (Miles Sound System), `Sentient/` (telemetry)

**Xbox 360 extras:** `Audio/` (SoundEngine), `Font/` (XUI_Font, XUI_FontData, XUI_FontRenderer), `Network/extra.h`, `Sentient/Include/` (full Sentient SDK headers)

**PS3 extras:** `Media/` (all xuiscene_*.h layout headers, 480/small/normal variants), `SPU_Tasks/` (full Cell SPU job sources with subdirectories for ChunkUpdate, CompressedTile, LevelRenderer, PerlinNoise, Texture_blit, and more), `PS3Extras/boost_1_53_0/` (Boost library subset), `PS3Extras/DirectX/` (DirectX math compatibility headers), `PS3Extras/HeapInspector/` (memory debugging tool), `Passphrase/` (NP conf), `4JLibs/STO_TitleSmallStorage` (small save data)

**PS4 extras:** `GameConfig/Minecraft.spa.h` (not in LCEMP)

**Windows 64 extras:** `KeyboardMouseInput.h/.cpp` (full keyboard/mouse input class), `PostProcesser.cpp`, `Windows64_Xuid.h` (persistent player UID system with uid.dat file)

### Platform Media Directories

MinecraftConsoles includes media/asset directories for each platform that were not in LCEMP:

- `DurangoMedia/` with DLC, localization, media assets, and sound
- `OrbisMedia/` with DLC, localization, and media assets
- `PS3Media/` with DLC, localization, and media assets
- `PSVitaMedia/` with DLC, localization, media, tutorial, and a compiled .self binary
- `Windows64Media/` (referenced as `redist64/`) with DLC, localization, media, sound, and tutorial

Additional top-level directories: `music/`, `TROPDIR/` (PlayStation trophy data), `PS3_GAME/`, `PS4_GAME/`, `sce_sys/` (PlayStation system metadata)
