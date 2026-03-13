# LCE Documentation

i told a local LLM to go through the code of minecraft LCE 40 times, and to make docs on it. This is what was output, if anything is wrong, because ai is always wrong in a sense, then please PR the repo.

Also includes docs for [smartcmd's MinecraftConsoles](https://github.com/smartcmd/MinecraftConsoles) fork, covering all the new systems it adds on top of LCEMP.

## What's documented

- Full architecture of `Minecraft.World` and `Minecraft.Client`
- Every block, item, entity, enchantment, biome, and packet type
- How to mod the codebase (adding blocks, items, entities, biomes, recipes, etc.)
- Platform code for Xbox 360, Xbox One, PS3, PS4, PS Vita, and Windows 64
- Rendering pipeline, GUI system, input handling, and audio
- World generation, structures, and the biome layer system
- Networking and multiplayer architecture
- Full reference tables with IDs and class mappings
- MinecraftConsoles differences (horses, scoreboard, redstone, attributes, fireworks, and more)

## Built with

- [Astro Starlight](https://starlight.astro.build/) for the docs site
- Source code analyzed: [LCEMP by notpies](https://github.com/coah80/LCEMP) and [MinecraftConsoles by smartcmd](https://github.com/smartcmd/MinecraftConsoles)

## Contributing

If you find anything wrong, just PR it. The AI did 40 passes through the code trying to get everything right but there's definitely gonna be mistakes. Community corrections are welcome.

## Running locally

```bash
npm install
npm run dev
```
