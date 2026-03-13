---
title: Item ID Registry
description: Complete table of all item IDs in LCEMP.
---

Items are registered in `Item::staticCtor()` in
[`Minecraft.World/Item.cpp`](/lcemp-docs/reference/file-index/). Block IDs 0-255 also
take up space in the item ID range (blocks are automatically wrapped in `TileItem`). True
item IDs start at 256.

The constructor argument (e.g., `new Item(9)`) is an **internal slot index**. The actual
item ID is `256 + slot`, declared as `*_Id` constants in `Item.h`.

## Item ID Table

| ID | Field Name | Class | Texture Name |
|----|-----------|-------|-------------|
| 256 | `shovel_iron` | `ShovelItem` | shovelIron |
| 257 | `pickAxe_iron` | `PickaxeItem` | pickaxeIron |
| 258 | `hatchet_iron` | `HatchetItem` | hatchetIron |
| 259 | `flintAndSteel` | `FlintAndSteelItem` | flintAndSteel |
| 260 | `apple` | `FoodItem` | apple |
| 261 | `bow` | `BowItem` | bow |
| 262 | `arrow` | `Item` | arrow |
| 263 | `coal` | `CoalItem` | coal |
| 264 | `diamond` | `Item` | diamond |
| 265 | `ironIngot` | `Item` | ingotIron |
| 266 | `goldIngot` | `Item` | ingotGold |
| 267 | `sword_iron` | `WeaponItem` | swordIron |
| 268 | `sword_wood` | `WeaponItem` | swordWood |
| 269 | `shovel_wood` | `ShovelItem` | shovelWood |
| 270 | `pickAxe_wood` | `PickaxeItem` | pickaxeWood |
| 271 | `hatchet_wood` | `HatchetItem` | hatchetWood |
| 272 | `sword_stone` | `WeaponItem` | swordStone |
| 273 | `shovel_stone` | `ShovelItem` | shovelStone |
| 274 | `pickAxe_stone` | `PickaxeItem` | pickaxeStone |
| 275 | `hatchet_stone` | `HatchetItem` | hatchetStone |
| 276 | `sword_diamond` | `WeaponItem` | swordDiamond |
| 277 | `shovel_diamond` | `ShovelItem` | shovelDiamond |
| 278 | `pickAxe_diamond` | `PickaxeItem` | pickaxeDiamond |
| 279 | `hatchet_diamond` | `HatchetItem` | hatchetDiamond |
| 280 | `stick` | `Item` | stick |
| 281 | `bowl` | `Item` | bowl |
| 282 | `mushroomStew` | `BowlFoodItem` | mushroomStew |
| 283 | `sword_gold` | `WeaponItem` | swordGold |
| 284 | `shovel_gold` | `ShovelItem` | shovelGold |
| 285 | `pickAxe_gold` | `PickaxeItem` | pickaxeGold |
| 286 | `hatchet_gold` | `HatchetItem` | hatchetGold |
| 287 | `string` | `TilePlanterItem` | string |
| 288 | `feather` | `Item` | feather |
| 289 | `sulphur` | `Item` | sulphur |
| 290 | `hoe_wood` | `HoeItem` | hoeWood |
| 291 | `hoe_stone` | `HoeItem` | hoeStone |
| 292 | `hoe_iron` | `HoeItem` | hoeIron |
| 293 | `hoe_diamond` | `HoeItem` | hoeDiamond |
| 294 | `hoe_gold` | `HoeItem` | hoeGold |
| 295 | `seeds_wheat` | `SeedItem` | seeds |
| 296 | `wheat` | `Item` | wheat |
| 297 | `bread` | `FoodItem` | bread |
| 298 | `helmet_cloth` | `ArmorItem` | helmetCloth |
| 299 | `chestplate_cloth` | `ArmorItem` | chestplateCloth |
| 300 | `leggings_cloth` | `ArmorItem` | leggingsCloth |
| 301 | `boots_cloth` | `ArmorItem` | bootsCloth |
| 302 | `helmet_chain` | `ArmorItem` | helmetChain |
| 303 | `chestplate_chain` | `ArmorItem` | chestplateChain |
| 304 | `leggings_chain` | `ArmorItem` | leggingsChain |
| 305 | `boots_chain` | `ArmorItem` | bootsChain |
| 306 | `helmet_iron` | `ArmorItem` | helmetIron |
| 307 | `chestplate_iron` | `ArmorItem` | chestplateIron |
| 308 | `leggings_iron` | `ArmorItem` | leggingsIron |
| 309 | `boots_iron` | `ArmorItem` | bootsIron |
| 310 | `helmet_diamond` | `ArmorItem` | helmetDiamond |
| 311 | `chestplate_diamond` | `ArmorItem` | chestplateDiamond |
| 312 | `leggings_diamond` | `ArmorItem` | leggingsDiamond |
| 313 | `boots_diamond` | `ArmorItem` | bootsDiamond |
| 314 | `helmet_gold` | `ArmorItem` | helmetGold |
| 315 | `chestplate_gold` | `ArmorItem` | chestplateGold |
| 316 | `leggings_gold` | `ArmorItem` | leggingsGold |
| 317 | `boots_gold` | `ArmorItem` | bootsGold |
| 318 | `flint` | `Item` | flint |
| 319 | `porkChop_raw` | `FoodItem` | porkchopRaw |
| 320 | `porkChop_cooked` | `FoodItem` | porkchopCooked |
| 321 | `painting` | `HangingEntityItem` | painting |
| 322 | `apple_gold` | `GoldenAppleItem` | appleGold |
| 323 | `sign` | `SignItem` | sign |
| 324 | `door_wood` | `DoorItem` | doorWood |
| 325 | `bucket_empty` | `BucketItem` | bucket |
| 326 | `bucket_water` | `BucketItem` | bucketWater |
| 327 | `bucket_lava` | `BucketItem` | bucketLava |
| 328 | `minecart` | `MinecartItem` | minecart |
| 329 | `saddle` | `SaddleItem` | saddle |
| 330 | `door_iron` | `DoorItem` | doorIron |
| 331 | `redStone` | `RedStoneItem` | redstone |
| 332 | `snowBall` | `SnowballItem` | snowball |
| 333 | `boat` | `BoatItem` | boat |
| 334 | `leather` | `Item` | leather |
| 335 | `milk` | `MilkBucketItem` | milk |
| 336 | `brick` | `Item` | brick |
| 337 | `clay` | `Item` | clay |
| 338 | `reeds` | `TilePlanterItem` | reeds |
| 339 | `paper` | `Item` | paper |
| 340 | `book` | `BookItem` | book |
| 341 | `slimeBall` | `Item` | slimeball |
| 342 | `minecart_chest` | `MinecartItem` | minecartChest |
| 343 | `minecart_furnace` | `MinecartItem` | minecartFurnace |
| 344 | `egg` | `EggItem` | egg |
| 345 | `compass` | `CompassItem` | compass |
| 346 | `fishingRod` | `FishingRodItem` | fishingRod |
| 347 | `clock` | `ClockItem` | clock |
| 348 | `yellowDust` | `Item` | yellowDust |
| 349 | `fish_raw` | `FoodItem` | fishRaw |
| 350 | `fish_cooked` | `FoodItem` | fishCooked |
| 351 | `dye_powder` | `DyePowderItem` | dyePowder |
| 352 | `bone` | `Item` | bone |
| 353 | `sugar` | `Item` | sugar |
| 354 | `cake` | `TilePlanterItem` | cake |
| 355 | `bed` | `BedItem` | bed |
| 356 | `diode` | `TilePlanterItem` | diode |
| 357 | `cookie` | `FoodItem` | cookie |
| 358 | `map` | `MapItem` | map |
| 359 | `shears` | `ShearsItem` | shears |
| 360 | `melon` | `FoodItem` | melon |
| 361 | `seeds_pumpkin` | `SeedItem` | seeds_pumpkin |
| 362 | `seeds_melon` | `SeedItem` | seeds_melon |
| 363 | `beef_raw` | `FoodItem` | beefRaw |
| 364 | `beef_cooked` | `FoodItem` | beefCooked |
| 365 | `chicken_raw` | `FoodItem` | chickenRaw |
| 366 | `chicken_cooked` | `FoodItem` | chickenCooked |
| 367 | `rotten_flesh` | `FoodItem` | rottenFlesh |
| 368 | `enderPearl` | `EnderpearlItem` | enderPearl |
| 369 | `blazeRod` | `Item` | blazeRod |
| 370 | `ghastTear` | `Item` | ghastTear |
| 371 | `goldNugget` | `Item` | goldNugget |
| 372 | `netherStalkSeeds` | `SeedItem` | netherStalkSeeds |
| 373 | `potion` | `PotionItem` | potion |
| 374 | `glassBottle` | `BottleItem` | glassBottle |
| 375 | `spiderEye` | `FoodItem` | spiderEye |
| 376 | `fermentedSpiderEye` | `Item` | fermentedSpiderEye |
| 377 | `blazePowder` | `Item` | blazePowder |
| 378 | `magmaCream` | `Item` | magmaCream |
| 379 | `brewingStand` | `TilePlanterItem` | brewingStand |
| 380 | `cauldron` | `TilePlanterItem` | cauldron |
| 381 | `eyeOfEnder` | `EnderEyeItem` | eyeOfEnder |
| 382 | `speckledMelon` | `Item` | speckledMelon |
| 383 | `monsterPlacer` | `MonsterPlacerItem` | monsterPlacer |
| 384 | `expBottle` | `ExperienceItem` | expBottle |
| 385 | `fireball` | `FireChargeItem` | fireball |
| 388 | `emerald` | `Item` | emerald |
| 389 | `frame` | `HangingEntityItem` | frame |
| 390 | `flowerPot` | `TilePlanterItem` | flowerPot |
| 391 | `carrots` | `SeedFoodItem` | carrots |
| 392 | `potato` | `SeedFoodItem` | potato |
| 393 | `potatoBaked` | `FoodItem` | potatoBaked |
| 394 | `potatoPoisonous` | `FoodItem` | potatoPoisonous |
| 396 | `carrotGolden` | `FoodItem` | carrotGolden |
| 397 | `skull` | `SkullItem` | skull |
| 398 | `carrotOnAStick` | `CarrotOnAStickItem` | carrotOnAStick |
| 400 | `pumpkinPie` | `FoodItem` | pumpkinPie |
| 403 | `enchantedBook` | `EnchantedBookItem` | enchantedBook |
| 405 | `netherbrick` | `Item` | netherbrick |
| 406 | `netherQuartz` | `Item` | netherquartz |
| 2256 | `record_01` | `RecordingItem` | record |
| 2257 | `record_02` | `RecordingItem` | record |
| 2258 | `record_03` | `RecordingItem` | record |
| 2259 | `record_04` | `RecordingItem` | record |
| 2260 | `record_05` | `RecordingItem` | record |
| 2261 | `record_06` | `RecordingItem` | record |
| 2262 | `record_07` | `RecordingItem` | record |
| 2263 | `record_09` | `RecordingItem` | record |
| 2264 | `record_10` | `RecordingItem` | record |
| 2265 | `record_11` | `RecordingItem` | record |
| 2266 | `record_12` | `RecordingItem` | record |
| 2267 | `record_08` | `RecordingItem` | record |

:::note
IDs 386-387, 395, 399, 401-402, 404 are unassigned in this build.
IDs 0-255 are reserved for block items (see the [Block ID Registry](/lcemp-docs/reference/block-ids/)).
:::

## Music Discs

| ID | Field | Track Name |
|----|-------|-----------|
| 2256 | `record_01` | 13 |
| 2257 | `record_02` | cat |
| 2258 | `record_03` | blocks |
| 2259 | `record_04` | chirp |
| 2260 | `record_05` | far |
| 2261 | `record_06` | mall |
| 2262 | `record_07` | mellohi |
| 2263 | `record_09` | stal |
| 2264 | `record_10` | strad |
| 2265 | `record_11` | ward |
| 2266 | `record_12` | 11 |
| 2267 | `record_08` | where are we now |

:::note
The field names `record_08` through `record_12` don't match up 1:1 with their IDs
because records were added across different title updates. The table above shows the
actual assignments in the source.
:::

## Tool Tiers

Tools are built with a `Tier` that sets durability, speed, damage, and
enchantability:

| Tier | Level | Durability | Speed | Damage Bonus | Enchantability |
|------|-------|-----------|-------|-------------|----------------|
| WOOD | 0 | 59 | 2 | 0 | 15 |
| STONE | 1 | 131 | 4 | 1 | 5 |
| IRON | 2 | 250 | 6 | 2 | 14 |
| DIAMOND | 3 | 1561 | 8 | 3 | 10 |
| GOLD | 0 | 32 | 12 | 0 | 22 |

## Source Reference

- Item IDs declared in: `Minecraft.World/Item.h` (lines 389-577)
- Item registration in: `Minecraft.World/Item.cpp`, `Item::staticCtor()` (line 237)
