// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://coah80.github.io',
	base: '/lcemp-docs',
	integrations: [
		starlight({
			title: 'LCEMP Docs',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/coah80/lcemp-docs' }],
			sidebar: [
				{
					label: 'Overview',
					items: [
						{ label: 'Introduction', slug: 'overview/introduction' },
						{ label: 'Architecture', slug: 'overview/architecture' },
						{ label: 'Building & Compiling', slug: 'overview/building' },
					],
				},
				{
					label: 'Minecraft.World',
					items: [
						{ label: 'Overview', slug: 'world/overview' },
						{ label: 'Blocks (Tiles)', slug: 'world/blocks' },
						{ label: 'Items', slug: 'world/items' },
						{ label: 'Entities', slug: 'world/entities' },
						{ label: 'Tile Entities', slug: 'world/tile-entities' },
						{ label: 'World Generation', slug: 'world/worldgen' },
						{ label: 'Biomes', slug: 'world/biomes' },
						{ label: 'Structures', slug: 'world/structures' },
						{ label: 'AI & Goals', slug: 'world/ai-goals' },
						{ label: 'Enchantments', slug: 'world/enchantments' },
						{ label: 'Effects (Potions)', slug: 'world/effects' },
						{ label: 'Crafting & Recipes', slug: 'world/crafting' },
						{ label: 'Container Menus', slug: 'world/containers' },
						{ label: 'Networking & Packets', slug: 'world/networking' },
						{ label: 'Level Storage & IO', slug: 'world/storage' },
						{ label: 'Game Rules', slug: 'world/gamerules' },
					],
				},
				{
					label: 'Minecraft.Client',
					items: [
						{ label: 'Overview', slug: 'client/overview' },
						{ label: 'Rendering Pipeline', slug: 'client/rendering' },
						{ label: 'Models', slug: 'client/models' },
						{ label: 'Particles', slug: 'client/particles' },
						{ label: 'Screens & GUI', slug: 'client/screens' },
						{ label: 'Input System', slug: 'client/input' },
						{ label: 'Textures & Resources', slug: 'client/textures' },
						{ label: 'Audio', slug: 'client/audio' },
						{ label: 'Settings', slug: 'client/settings' },
					],
				},
				{
					label: 'Platform Code',
					items: [
						{ label: 'Overview', slug: 'platforms/overview' },
						{ label: 'Windows 64', slug: 'platforms/windows64' },
						{ label: 'Xbox 360', slug: 'platforms/xbox360' },
						{ label: 'Xbox One (Durango)', slug: 'platforms/durango' },
						{ label: 'PS3', slug: 'platforms/ps3' },
						{ label: 'PS4 (Orbis)', slug: 'platforms/orbis' },
						{ label: 'PS Vita', slug: 'platforms/psvita' },
					],
				},
				{
					label: 'Modding Guide',
					items: [
						{ label: 'Getting Started', slug: 'modding/getting-started' },
						{ label: 'Adding Blocks', slug: 'modding/adding-blocks' },
						{ label: 'Adding Items', slug: 'modding/adding-items' },
						{ label: 'Adding Entities', slug: 'modding/adding-entities' },
						{ label: 'Adding Biomes', slug: 'modding/adding-biomes' },
						{ label: 'Adding Enchantments', slug: 'modding/adding-enchantments' },
						{ label: 'Adding Recipes', slug: 'modding/adding-recipes' },
						{ label: 'Custom World Generation', slug: 'modding/custom-worldgen' },
						{ label: 'Custom GUI Screens', slug: 'modding/custom-screens' },
						{ label: 'Multiplayer & Packets', slug: 'modding/multiplayer' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Block ID Registry', slug: 'reference/block-ids' },
						{ label: 'Item ID Registry', slug: 'reference/item-ids' },
						{ label: 'Entity Type Registry', slug: 'reference/entity-types' },
						{ label: 'Packet ID Registry', slug: 'reference/packet-ids' },
						{ label: 'Tile Class Index', slug: 'reference/tile-classes' },
						{ label: 'Complete File Index', slug: 'reference/file-index' },
					],
				},
			],
		}),
	],
});
