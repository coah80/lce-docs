---
title: Custom Death Messages
description: How DamageSource works and how to add your own death messages in LCE.
---

Death messages in LCE are driven by the `DamageSource` system. Every time something hurts a player or mob, a `DamageSource` tells the game what kind of damage it was, who caused it, and what message to show when the victim dies. Understanding this system lets you add completely new death messages for custom damage types.

## How DamageSource Works

`DamageSource` is the base class for all damage in the game. It lives in `Minecraft.World/DamageSource.h` and `DamageSource.cpp`.

Every damage source has:
- A **message ID** (`EChatPacketMessage` enum value) that maps to a localized death message string
- A set of **bypass flags** that control how the damage interacts with armor, invulnerability, and enchantments
- A **food exhaustion** value (how much hunger the damage costs)
- Type flags like `isFireSource`, `_isProjectile`, `_isMagic`, and `_scalesWithDifficulty`

The game ships with a bunch of static damage source instances that get created at startup:

```cpp
// From DamageSource.cpp -- these are all the built-in damage sources

DamageSource *DamageSource::inFire = (new DamageSource(ChatPacket::e_ChatDeathInFire))->setIsFire();
DamageSource *DamageSource::onFire = (new DamageSource(ChatPacket::e_ChatDeathOnFire))->bypassArmor()->setIsFire();
DamageSource *DamageSource::lava = (new DamageSource(ChatPacket::e_ChatDeathLava))->setIsFire();
DamageSource *DamageSource::inWall = (new DamageSource(ChatPacket::e_ChatDeathInWall))->bypassArmor();
DamageSource *DamageSource::drown = (new DamageSource(ChatPacket::e_ChatDeathDrown))->bypassArmor();
DamageSource *DamageSource::starve = (new DamageSource(ChatPacket::e_ChatDeathStarve))->bypassArmor();
DamageSource *DamageSource::cactus = new DamageSource(ChatPacket::e_ChatDeathCactus);
DamageSource *DamageSource::fall = (new DamageSource(ChatPacket::e_ChatDeathFall))->bypassArmor();
DamageSource *DamageSource::outOfWorld = (new DamageSource(ChatPacket::e_ChatDeathOutOfWorld))->bypassArmor()->bypassInvul();
DamageSource *DamageSource::genericSource = (new DamageSource(ChatPacket::e_ChatDeathGeneric))->bypassArmor();
DamageSource *DamageSource::explosion = (new DamageSource(ChatPacket::e_ChatDeathExplosion))->setScalesWithDifficulty();
DamageSource *DamageSource::controlledExplosion = (new DamageSource(ChatPacket::e_ChatDeathExplosion));
DamageSource *DamageSource::magic = (new DamageSource(ChatPacket::e_ChatDeathMagic))->bypassArmor()->setMagic();
DamageSource *DamageSource::dragonbreath = (new DamageSource(ChatPacket::e_ChatDeathDragonBreath))->bypassArmor();
DamageSource *DamageSource::wither = (new DamageSource(ChatPacket::e_ChatDeathWither))->bypassArmor();
DamageSource *DamageSource::anvil = (new DamageSource(ChatPacket::e_ChatDeathAnvil));
DamageSource *DamageSource::fallingBlock = (new DamageSource(ChatPacket::e_ChatDeathFallingBlock));
```

Notice the **builder pattern** here. Each source is created with `new DamageSource(msgId)` and then flags are chained on with calls like `->bypassArmor()->setIsFire()`. Each of those methods returns `this`, so you can keep chaining.

## The Class Hierarchy

There are three levels of damage source:

### DamageSource (base)

Used for environmental damage with no entity involved. Fall damage, drowning, lava, cactus, void, etc. The `getEntity()` and `getDirectEntity()` methods both return `nullptr`.

### EntityDamageSource

Used when a specific entity is doing the damage directly. Melee attacks from mobs and players use this. It stores a `shared_ptr<Entity>` to the attacker.

```cpp
// Factory methods on DamageSource that create EntityDamageSource instances
DamageSource *DamageSource::mobAttack(shared_ptr<Mob> mob)
{
    return new EntityDamageSource(ChatPacket::e_ChatDeathMob, mob);
}

DamageSource *DamageSource::playerAttack(shared_ptr<Player> player)
{
    return new EntityDamageSource(ChatPacket::e_ChatDeathPlayer, player);
}

DamageSource *DamageSource::thorns(shared_ptr<Entity> source)
{
    return (new EntityDamageSource(ChatPacket::e_ChatDeathThorns, source))->setMagic();
}
```

### IndirectEntityDamageSource

Used when an entity causes damage through a projectile or other indirect means. It stores both the **direct entity** (the projectile) and the **owner** (who fired it). This is the one that handles kill credit for things like arrows and fireballs.

```cpp
DamageSource *DamageSource::arrow(shared_ptr<Arrow> arrow, shared_ptr<Entity> owner)
{
    return (new IndirectEntityDamageSource(ChatPacket::e_ChatDeathArrow, arrow, owner))->setProjectile();
}

DamageSource *DamageSource::fireball(shared_ptr<Fireball> fireball, shared_ptr<Entity> owner)
{
    if (owner == NULL)
    {
        // No owner (e.g. dispenser-fired) -- blame the fireball itself
        return (new IndirectEntityDamageSource(ChatPacket::e_ChatDeathOnFire, fireball, fireball))->setIsFire()->setProjectile();
    }
    return (new IndirectEntityDamageSource(ChatPacket::e_ChatDeathFireball, fireball, owner))->setIsFire()->setProjectile();
}

DamageSource *DamageSource::thrown(shared_ptr<Entity> entity, shared_ptr<Entity> owner)
{
    return (new IndirectEntityDamageSource(ChatPacket::e_ChatDeathThrown, entity, owner))->setProjectile();
}

DamageSource *DamageSource::indirectMagic(shared_ptr<Entity> entity, shared_ptr<Entity> owner)
{
    return (new IndirectEntityDamageSource(ChatPacket::e_ChatDeathIndirectMagic, entity, owner))->bypassArmor()->setMagic();
}
```

The key difference between `getEntity()` and `getDirectEntity()` matters here. For `IndirectEntityDamageSource`:
- `getDirectEntity()` returns the **projectile** (the arrow, fireball, etc.)
- `getEntity()` returns the **owner** (the player or mob that fired it)

This is how the game knows to give kill credit to the player who shot the arrow, not the arrow itself.

## How Death Messages Get Generated

When a player dies, `ServerPlayer::die()` is called. This method grabs the death message from the damage source and broadcasts it to everyone:

```cpp
void ServerPlayer::die(DamageSource *source)
{
    server->getPlayers()->broadcastAll(
        source->getDeathMessagePacket(dynamic_pointer_cast<Player>(shared_from_this()))
    );
    inventory->dropAll();
}
```

Each class in the hierarchy builds the `ChatPacket` differently:

**DamageSource** (base) just includes the victim's name and the message ID:

```cpp
shared_ptr<ChatPacket> DamageSource::getDeathMessagePacket(shared_ptr<Player> player)
{
    return shared_ptr<ChatPacket>(new ChatPacket(player->name, m_msgId));
}
```

**EntityDamageSource** also packs in the attacker's entity type, and if the attacker is a player, their name too:

```cpp
shared_ptr<ChatPacket> EntityDamageSource::getDeathMessagePacket(shared_ptr<Player> player)
{
    wstring additional = L"";
    if (entity->GetType() == eTYPE_SERVERPLAYER)
    {
        shared_ptr<Player> sourcePlayer = dynamic_pointer_cast<Player>(entity);
        if (sourcePlayer != NULL) additional = sourcePlayer->name;
    }
    return shared_ptr<ChatPacket>(new ChatPacket(player->name, m_msgId, entity->GetType(), additional));
}
```

**IndirectEntityDamageSource** does the same thing but uses the **owner** instead of the direct entity. If the owner is null, it falls back to the projectile's type:

```cpp
shared_ptr<ChatPacket> IndirectEntityDamageSource::getDeathMessagePacket(shared_ptr<Player> player)
{
    wstring additional = L"";
    int type;
    if (owner != NULL)
    {
        type = owner->GetType();
        if (type == eTYPE_SERVERPLAYER)
        {
            shared_ptr<Player> sourcePlayer = dynamic_pointer_cast<Player>(owner);
            if (sourcePlayer != NULL) additional = sourcePlayer->name;
        }
    }
    else
    {
        type = entity->GetType();
    }
    return shared_ptr<ChatPacket>(new ChatPacket(player->name, m_msgId, type, additional));
}
```

The `ChatPacket` packs all this up and sends it over the network. The client then looks up the localized string for the `EChatPacketMessage` enum value and fills in the player names and entity type.

## All Death Message IDs

These are all the `EChatPacketMessage` enum values used for death messages, defined in `ChatPacket.h`:

| Enum Value | Used By | Example Message |
|---|---|---|
| `e_ChatDeathInFire` | `DamageSource::inFire` | "Player went up in flames" |
| `e_ChatDeathOnFire` | `DamageSource::onFire` | "Player burned to death" |
| `e_ChatDeathLava` | `DamageSource::lava` | "Player tried to swim in lava" |
| `e_ChatDeathInWall` | `DamageSource::inWall` | "Player suffocated in a wall" |
| `e_ChatDeathDrown` | `DamageSource::drown` | "Player drowned" |
| `e_ChatDeathStarve` | `DamageSource::starve` | "Player starved to death" |
| `e_ChatDeathCactus` | `DamageSource::cactus` | "Player was pricked to death" |
| `e_ChatDeathFall` | `DamageSource::fall` | "Player hit the ground too hard" |
| `e_ChatDeathOutOfWorld` | `DamageSource::outOfWorld` | "Player fell out of the world" |
| `e_ChatDeathGeneric` | `DamageSource::genericSource` | "Player died" |
| `e_ChatDeathExplosion` | `DamageSource::explosion` | "Player blew up" |
| `e_ChatDeathMagic` | `DamageSource::magic` | "Player was killed by magic" |
| `e_ChatDeathMob` | `mobAttack()` | "Player was slain by Zombie" |
| `e_ChatDeathPlayer` | `playerAttack()` | "Player was slain by OtherPlayer" |
| `e_ChatDeathArrow` | `arrow()` | "Player was shot by Skeleton" |
| `e_ChatDeathFireball` | `fireball()` | "Player was fireballed by Ghast" |
| `e_ChatDeathThrown` | `thrown()` | "Player was pummeled by Entity" |
| `e_ChatDeathIndirectMagic` | `indirectMagic()` | "Player was killed by magic" |
| `e_ChatDeathDragonBreath` | `DamageSource::dragonbreath` | "Player was killed by dragon's breath" |
| `e_ChatDeathWither` | `DamageSource::wither` | "Player withered away" |
| `e_ChatDeathAnvil` | `DamageSource::anvil` | "Player was squashed by a falling anvil" |
| `e_ChatDeathFallingBlock` | `DamageSource::fallingBlock` | "Player was squashed by a falling block" |
| `e_ChatDeathThorns` | `thorns()` | "Player was killed trying to hurt Entity" |

## Bypass Flags

Bypass flags control how the damage interacts with the game's defense systems. Here is what each one does:

### `bypassArmor()`

When set, the damage completely skips the armor absorption step. The player's armor value is ignored and armor durability is not reduced. This also sets food exhaustion to 0, meaning the damage does not make the player hungrier.

Used by: `onFire`, `inWall`, `drown`, `starve`, `fall`, `outOfWorld`, `genericSource`, `magic`, `dragonbreath`, `wither`

### `bypassInvul()`

When set, the damage goes through even if the player has invulnerability (creative mode, god mode, etc.). Only `outOfWorld` (void damage) uses this by default, since falling into the void should always kill you.

### `setIsFire()`

Marks the damage as fire-type. This does two things:
1. Mobs with the Fire Resistance potion effect will be immune to it
2. The Fire Protection enchantment will reduce it

Used by: `inFire`, `onFire`, `lava`, `fireball()`

### `setProjectile()`

Marks the damage as projectile-type. The Projectile Protection enchantment will reduce this damage.

Used by: `arrow()`, `fireball()`, `thrown()`

### `setMagic()`

Marks the damage as magical. Currently used by `magic`, `indirectMagic()`, and `thorns()`.

### `setScalesWithDifficulty()`

Makes damage scale with the world's difficulty setting. On Peaceful it does 0 damage, on Easy it does `damage/2 + 1`, on Normal it is unchanged, and on Hard it does `damage * 3/2`. For `EntityDamageSource`, mob attacks (but not player attacks) automatically scale with difficulty even without this flag.

Used by: `explosion`

## How Armor and Enchantments Interact

When a player takes damage, it goes through a pipeline in `Player::actuallyHurt()`:

```cpp
void Player::actuallyHurt(DamageSource *source, int dmg)
{
    // Blocking with a sword/shield cuts damage roughly in half
    if (!source->isBypassArmor() && isBlocking())
    {
        dmg = (1 + dmg) >> 1;
    }

    // Step 1: Armor absorbs damage (skipped if bypassArmor is set)
    dmg = getDamageAfterArmorAbsorb(source, dmg);

    // Step 2: Enchantments reduce remaining damage
    dmg = getDamageAfterMagicAbsorb(source, dmg);

    // Damage causes food exhaustion
    causeFoodExhaustion(source->getFoodExhaustion());

    health -= dmg;
}
```

**Armor absorption** (`getDamageAfterArmorAbsorb`) uses the player's armor value (0-20) to reduce damage. If `bypassArmor()` is set, this step is completely skipped.

**Enchantment absorption** (`getDamageAfterMagicAbsorb`) checks all protection enchantments on the player's armor and reduces damage further. The `ProtectionEnchantment` class checks the damage source's flags to decide how much protection to give:

```cpp
int ProtectionEnchantment::getDamageProtection(int level, DamageSource *source)
{
    if (source->isBypassInvul()) return 0;

    float protect = (6 + level * level) / 3.0f;

    if (type == ALL) return Mth::floor(protect * 0.75f);
    if (type == FIRE && source->isFire()) return Mth::floor(protect * 1.25f);
    if (type == FALL && source == DamageSource::fall) return Mth::floor(protect * 2.5f);
    if (type == EXPLOSION && source == DamageSource::explosion) return Mth::floor(protect * 1.5f);
    if (type == PROJECTILE && source->isProjectile()) return Mth::floor(protect * 1.5f);
    return 0;
}
```

So if you create a new damage source and you want armor to block it, don't call `bypassArmor()`. If you want fire protection enchantments to help against it, call `setIsFire()`. And so on.

## Creating a Custom Damage Source

Let's say you want to add a "lightning" damage source with a custom death message. Here is the full process.

### Step 1: Add the Death Message Enum

In `ChatPacket.h`, add a new enum value in the `EChatPacketMessage` enum. Put it after the existing death entries:

```cpp
// In ChatPacket.h, inside the EChatPacketMessage enum
e_ChatDeathThorns,

e_ChatDeathLightning, // your new entry

e_ChatPlayerEnteredEnd,
```

:::caution
The enum values are serialized as integers over the network. Adding your new value in the middle of the enum would shift all the values after it and break compatibility with existing clients. Always add new entries right before `e_ChatPlayerEnteredEnd` or at the very end of the death message block.
:::

### Step 2: Add the Static Instance

In `DamageSource.h`, declare the new static pointer:

```cpp
// In DamageSource.h, with the other static members
static DamageSource *lightning;
```

In `DamageSource.cpp`, create the instance with whatever flags you want:

```cpp
// In DamageSource.cpp, with the other static initializations
DamageSource *DamageSource::lightning = (new DamageSource(ChatPacket::e_ChatDeathLightning))->bypassArmor();
```

### Step 3: Use It

Now you can use your new damage source anywhere in the game code:

```cpp
// Hit an entity with lightning damage
entity->hurt(DamageSource::lightning, 5);
```

### Step 4: Add the Localized String

The client looks up the localized string for your `EChatPacketMessage` value. You will need to add the actual text for your death message in the localization system so the client knows what to display. The exact string would be something like "%s was struck by lightning".

## Creating a Custom EntityDamageSource

If your damage type involves an attacker entity, subclass `EntityDamageSource` instead:

```cpp
// LightningEntityDamageSource.h
#pragma once
#include "EntityDamageSource.h"

class LightningEntityDamageSource : public EntityDamageSource
{
public:
    LightningEntityDamageSource(shared_ptr<Entity> source)
        : EntityDamageSource(ChatPacket::e_ChatDeathLightning, source)
    {
    }

    virtual ~LightningEntityDamageSource() {}

    // Override if you want custom death message logic
    virtual shared_ptr<ChatPacket> getDeathMessagePacket(shared_ptr<Player> player)
    {
        wstring additional = L"";
        if (entity->GetType() == eTYPE_SERVERPLAYER)
        {
            shared_ptr<Player> sourcePlayer = dynamic_pointer_cast<Player>(entity);
            if (sourcePlayer != NULL) additional = sourcePlayer->name;
        }
        return shared_ptr<ChatPacket>(new ChatPacket(player->name, m_msgId, entity->GetType(), additional));
    }
};
```

Then create a factory method on `DamageSource`:

```cpp
// In DamageSource.h
static DamageSource *lightning(shared_ptr<Entity> source);

// In DamageSource.cpp
DamageSource *DamageSource::lightning(shared_ptr<Entity> source)
{
    return (new LightningEntityDamageSource(source))->bypassArmor();
}
```

Don't forget to add your new `.h` and `.cpp` files to `cmake/Sources.cmake` in the `MINECRAFT_WORLD_SOURCES` list.

## Kill Credit

Kill credit is handled through the `getEntity()` method. When a mob or player dies, `Mob::die()` checks who gets credit:

```cpp
void Mob::die(DamageSource *source)
{
    shared_ptr<Entity> sourceEntity = source->getEntity();

    // Award kill score to the attacker
    if (deathScore >= 0 && sourceEntity != NULL)
        sourceEntity->awardKillScore(shared_from_this(), deathScore);

    // Notify the killer
    if (sourceEntity != NULL)
        sourceEntity->killed(dynamic_pointer_cast<Mob>(shared_from_this()));

    // ... loot drops, stats, etc.
}
```

For `DamageSource` (base), `getEntity()` returns `nullptr`, so nobody gets credit. For `EntityDamageSource`, it returns the attacker. For `IndirectEntityDamageSource`, it returns the **owner** (the player who shot the arrow), not the projectile itself.

If you want custom kill credit behavior, override `getEntity()` in your subclass. For example, if you want a trap block to credit the player who placed it, you could store the placer and return them from `getEntity()`.

## The Damage Pipeline (Full Flow)

Here is the full flow from something hurting a player to the death message showing up:

1. Something calls `entity->hurt(damageSource, damage)`
2. `Player::hurt()` checks invulnerability, creative mode, and difficulty scaling
3. `Mob::hurt()` handles invulnerability frames, knockback, and then calls `actuallyHurt()`
4. `Player::actuallyHurt()` runs the damage through blocking, armor absorption, and enchantment absorption
5. If health drops to 0 or below, `Mob::hurt()` calls `die(source)`
6. `Player::die()` calls `Mob::die()` which handles kill credit, loot drops, and stats
7. `ServerPlayer::die()` calls `source->getDeathMessagePacket(player)` and broadcasts the result to all players
8. Every connected client receives the `ChatPacket` and displays the localized death message

That is the whole system. The damage source you pass in at step 1 determines everything: how much the damage is reduced, who gets credit for the kill, and what message shows up in chat.
