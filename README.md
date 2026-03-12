# LCEMP Documentation

I told a local LLM to go through the code of Minecraft LCE 40 times, and to make docs on it. This is what was output. If anything is wrong — because AI is always wrong in a sense — then please PR the repo.

The LLM analyzed the full LCEMP (Legacy Console Edition Multiplayer) C++ source code across 40 systematic passes, documenting:

- Complete architecture of `Minecraft.World` and `Minecraft.Client`
- Every block, item, entity, enchantment, biome, and packet type
- How to mod the codebase: adding blocks, items, entities, biomes, recipes, and more
- Platform-specific code for Xbox 360, Xbox One, PS3, PS4, PS Vita, Windows 64, and macOS
- Rendering pipeline, GUI system, input handling, and audio
- World generation, structures, and the biome layer system
- Networking and multiplayer architecture
- Full reference tables with IDs and class mappings

## Built with

- [Astro Starlight](https://starlight.astro.build/) for the documentation site
- Source code analyzed: [LCEMP by notpies](https://github.com/coah80/LCEMP)

## Contributing

If you find inaccuracies in the documentation, please open a PR. The AI did 40 passes through the code to try to get things right, but there will inevitably be mistakes. Community corrections are welcome and encouraged.

## Running locally

```bash
npm install
npm run dev
```

## License

Documentation content is provided as-is for the LCEMP community.
