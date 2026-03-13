---
title: Glossary
description: A full index of every page in the LCE docs, organized by category.
---

Every page on this site, organized by section. Use this as a quick reference to find what you need.

## Overview

- [Introduction](/lce-docs/overview/introduction/) - What LCE is and what this documentation covers
- [Architecture](/lce-docs/overview/architecture/) - How the two-module setup works
- [Building & Compiling](/lce-docs/overview/building/) - How to build the project from source

## Minecraft.World

The game logic layer. Blocks, items, entities, world generation, networking, and everything that runs the actual game.

- [Overview](/lce-docs/world/overview/) - High-level look at the World module
- [Blocks (Tiles)](/lce-docs/world/blocks/) - Every block type and the Tile class system
- [Entities](/lce-docs/world/entities/) - All entity types and the Entity class hierarchy
- [Tile Entities](/lce-docs/world/tile-entities/) - Block entities like chests, furnaces, signs
- [World Generation](/lce-docs/world/worldgen/) - How worlds get generated
- [Biomes](/lce-docs/world/biomes/) - All biome types and the biome system
- [Structures](/lce-docs/world/structures/) - Generated structures like villages and strongholds
- [AI & Goals](/lce-docs/world/ai-goals/) - The Goal-based AI system for mobs
- [Enchantments](/lce-docs/world/enchantments/) - All enchantment types and the enchantment system
- [Effects (Potions)](/lce-docs/world/effects/) - Potion effects and the MobEffect system
- [Crafting & Recipes](/lce-docs/world/crafting/) - Recipe types and the crafting system
- [Container Menus](/lce-docs/world/containers/) - Inventory and container menu system
- [Networking & Packets](/lce-docs/world/networking/) - Packet types and multiplayer networking
- [Level Storage & IO](/lce-docs/world/storage/) - Save/load and level storage
- [Game Rules](/lce-docs/world/gamerules/) - All game rules and the GameRules system

### Items

- [Items Overview](/lce-docs/world/items/overview/) - The Item class system and registration
- [Tools & Weapons](/lce-docs/world/items/tools/) - Swords, pickaxes, shovels, axes, hoes, bows
- [Armor](/lce-docs/world/items/armor/) - Helmets, chestplates, leggings, boots
- [Food](/lce-docs/world/items/food/) - All food items and hunger mechanics
- [Combat Items](/lce-docs/world/items/combat/) - Arrows, snowballs, ender pearls, potions
- [Music Discs](/lce-docs/world/items/music-discs/) - All music disc items
- [Decorative & Placement](/lce-docs/world/items/decorative/) - Signs, paintings, doors, beds, buckets
- [Raw Materials](/lce-docs/world/items/materials/) - Ingots, gems, dyes, and crafting materials
- [Special Items](/lce-docs/world/items/special/) - Maps, clocks, compasses, written books, spawn eggs

## Minecraft.Client

The rendering and UI layer. Everything the player sees and interacts with.

- [Overview](/lce-docs/client/overview/) - High-level look at the Client module
- [Rendering Pipeline](/lce-docs/client/rendering/) - How frames get drawn
- [Models](/lce-docs/client/models/) - Entity and block models
- [Particles](/lce-docs/client/particles/) - The particle system
- [Screens & GUI](/lce-docs/client/screens/) - The SWF/Iggy UI system and all screen types
- [Input System](/lce-docs/client/input/) - Keyboard, mouse, and controller input
- [Textures & Resources](/lce-docs/client/textures/) - Texture loading, atlases, and resource management
- [Audio](/lce-docs/client/audio/) - Miles Sound System and audio playback
- [Settings](/lce-docs/client/settings/) - Game settings and options

## Platform Code

Platform-specific code for each console and PC target.

- [Overview](/lce-docs/platforms/overview/) - How platform abstraction works
- [Windows 64](/lce-docs/platforms/windows64/) - The Win64 PC build target
- [Xbox 360](/lce-docs/platforms/xbox360/) - Xbox 360 platform code
- [Xbox One (Durango)](/lce-docs/platforms/durango/) - Xbox One platform code
- [PS3](/lce-docs/platforms/ps3/) - PlayStation 3 platform code
- [PS4 (Orbis)](/lce-docs/platforms/orbis/) - PlayStation 4 platform code
- [PS Vita](/lce-docs/platforms/psvita/) - PS Vita platform code

## Modding Guide

Step-by-step guides for modifying the codebase.

- [Getting Started](/lce-docs/modding/getting-started/) - How to set up your environment and make your first change

### Blocks & World

- [Adding Blocks](/lce-docs/modding/adding-blocks/) - How to add new block types
- [Custom Materials](/lce-docs/modding/custom-materials/) - Creating custom block materials
- [Adding Biomes](/lce-docs/modding/adding-biomes/) - How to add new biomes
- [Custom World Generation](/lce-docs/modding/custom-worldgen/) - Modifying terrain generation
- [Custom Structures](/lce-docs/modding/custom-structures/) - Adding generated structures
- [Custom Dimensions](/lce-docs/modding/custom-dimensions/) - Creating new dimensions with portals
- [Fog & Sky Effects](/lce-docs/modding/fog-sky/) - Custom fog colors and sky rendering

### Items & Crafting

- [Adding Items](/lce-docs/modding/adding-items/) - How to add new items
- [Adding Recipes](/lce-docs/modding/adding-recipes/) - Crafting and smelting recipes
- [Custom Potions & Brewing](/lce-docs/modding/custom-potions/) - New potion effects and brewing recipes
- [Custom Enchantments](/lce-docs/modding/custom-enchantments/) - Advanced enchantment customization
- [Custom Loot Tables](/lce-docs/modding/custom-loot/) - Loot table creation and modification
- [Making a Full Ore](/lce-docs/modding/full-ore/) - End-to-end ore, tools, armor, and worldgen

### Entities & Mobs

- [Adding Entities](/lce-docs/modding/adding-entities/) - How to add new entities
- [Custom AI Behaviors](/lce-docs/modding/custom-ai/) - Goal-based AI for mobs
- [Custom Death Messages](/lce-docs/modding/custom-death-messages/) - Adding death message strings
- [Custom Villager Trades](/lce-docs/modding/custom-trades/) - Modifying villager trade lists

### UI & Visuals

- [Custom GUI Screens](/lce-docs/modding/custom-screens/) - SWF-based screen creation
- [Custom Container Menus](/lce-docs/modding/custom-containers/) - Inventory and crafting menus
- [Creative Mode Tabs](/lce-docs/modding/creative-tabs/) - Adding creative inventory tabs
- [Custom Paintings](/lce-docs/modding/custom-paintings/) - Adding new painting motifs
- [Custom Achievements](/lce-docs/modding/custom-achievements/) - Adding achievements

### Assets & Resources

- [Block Textures](/lce-docs/modding/block-textures/) - Terrain atlas and block texture system
- [Entity Models](/lce-docs/modding/entity-models/) - ModelPart-based entity models
- [Custom Animations](/lce-docs/modding/custom-animations/) - Entity animation system
- [Custom Particles](/lce-docs/modding/custom-particles/) - Adding particle effects
- [Custom Sounds & Music](/lce-docs/modding/custom-sounds/) - Audio and sound events
- [Texture Packs](/lce-docs/modding/texture-packs/) - The texture pack system and DLC format

### Gameplay & Systems

- [Custom Game Rules](/lce-docs/modding/custom-gamerules/) - Adding new game rules
- [Adding Commands](/lce-docs/modding/adding-commands/) - Chat commands
- [World Size Limits](/lce-docs/modding/world-size/) - Changing world boundaries
- [Splitscreen Modding](/lce-docs/modding/splitscreen/) - Splitscreen multiplayer system
- [Increasing Player Limit](/lce-docs/modding/player-limit/) - Changing max player count
- [Multiplayer & Packets](/lce-docs/modding/multiplayer/) - Custom packets and networking

## Mod Templates

Complete starter mods you can follow end-to-end. Each one teaches multiple systems at once.

- [Random Wooden House](/lce-docs/templates/random-house/) - A structure that spawns randomly with custom loot
- [Purple Dimension](/lce-docs/templates/purple-dimension/) - A custom dimension with terrain, fog, blocks, and a portal
- [Ruby Ore & Tools](/lce-docs/templates/ruby-tools/) - Full ore to tools to armor pipeline
- [Custom Mob](/lce-docs/templates/custom-mob/) - A hostile mob with AI, model, renderer, sounds, and drops
- [Enchantment & Potion](/lce-docs/templates/enchantment-potion/) - Vampiric enchantment and Levitation potion
- [Custom Workbench](/lce-docs/templates/custom-workbench/) - A 4x4 crafting grid with custom GUI
- [Textures from Scratch](/lce-docs/templates/texture-tutorial/) - Making, loading, and replacing textures

## MinecraftConsoles

Documentation for smartcmd's MinecraftConsoles fork, which builds on the LCE codebase with more content.

- [Overview & Differences](/lce-docs/mc/overview/) - What MinecraftConsoles adds and changes
- [Attribute System](/lce-docs/mc/attributes/) - Entity attribute system
- [Scoreboard & Teams](/lce-docs/mc/scoreboard/) - Scoreboard and team system
- [Horse Entities](/lce-docs/mc/horses/) - Horse entity implementation
- [Redstone Mechanics](/lce-docs/mc/redstone/) - Redstone system changes
- [Hoppers & Droppers](/lce-docs/mc/hoppers-droppers/) - Hopper and dropper mechanics
- [Minecart Variants](/lce-docs/mc/minecarts/) - Minecart types
- [Fireworks](/lce-docs/mc/fireworks/) - Firework rockets and stars
- [Behavior System](/lce-docs/mc/behaviors/) - Entity behavior system
- [New Blocks & Items](/lce-docs/mc/new-content/) - Blocks and items added by MinecraftConsoles
- [New Entities & Models](/lce-docs/mc/new-entities/) - Entities and models added
- [Commands](/lce-docs/mc/commands/) - Command system changes
- [Build System & CI](/lce-docs/mc/build/) - Build system and CI setup

## Reference

Lookup tables and indexes for quick reference.

- [Block ID Registry](/lce-docs/reference/block-ids/) - Every block ID
- [Item ID Registry](/lce-docs/reference/item-ids/) - Every item ID
- [Entity Type Registry](/lce-docs/reference/entity-types/) - Every entity type
- [Packet ID Registry](/lce-docs/reference/packet-ids/) - Every packet ID
- [Tile Class Index](/lce-docs/reference/tile-classes/) - Every Tile subclass
- [Complete File Index](/lce-docs/reference/file-index/) - Every source file in the codebase
