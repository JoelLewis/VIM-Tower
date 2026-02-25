<script lang="ts">
	import { onMount } from 'svelte';
	import { loadTileset } from '$lib/renderer/tileset.js';
	import { createScreenLayout, getScreenPixelSize } from '$lib/renderer/screen-layout.js';
	import { createCanvasManager } from '$lib/renderer/canvas-manager.js';
	import {
		createCellBuffer,
		drawChrome,
		writeText,
		setCell,
		fillRect,
		renderBuffer
	} from '$lib/renderer/grid-renderer.js';
	import { colors, palette } from '$lib/renderer/colors.js';

	let canvas: HTMLCanvasElement;

	onMount(() => {
		initDemo();
	});

	async function initDemo() {
		const tileset = await loadTileset('/fonts/cp437.png');

		// Stage 1 grid size for demo
		const layout = createScreenLayout(20, 14);
		const screenSize = getScreenPixelSize(layout);

		const manager = createCanvasManager(canvas, screenSize.width, screenSize.height);
		const buf = createCellBuffer(layout.totalCols, layout.totalRows);

		// Draw the chrome (box borders)
		drawChrome(buf, layout);

		// Header content (truncate to fit within header width)
		const headerLeft = ':wq!  Stage 1';
		const goldText = 'Gold: 200';
		writeText(buf, layout.header.x, layout.header.y, headerLeft, colors.uiTextBright, colors.uiBackground);
		writeText(buf, layout.header.x + layout.header.width - goldText.length, layout.header.y, goldText, colors.gold, colors.uiBackground);

		// Fill game grid with dots (empty terrain)
		fillRect(buf, layout.gameGrid, '.'.charCodeAt(0), colors.uiTextDim, colors.terrainEmpty);

		// Draw a sample path (horizontal line across the middle)
		const pathRow = layout.gameGrid.y + Math.floor(layout.gameGrid.height / 2);
		for (let col = 0; col < layout.gameGrid.width; col++) {
			const pathChar = 176; // ░ shade block for path
			setCell(buf, layout.gameGrid.x + col, pathRow, pathChar, colors.terrainPath, colors.terrainEmpty);
		}

		// Place some demo towers
		setCell(buf, layout.gameGrid.x + 5, pathRow - 1, '>'.charCodeAt(0), colors.towerArrow, colors.terrainEmpty);
		setCell(buf, layout.gameGrid.x + 10, pathRow - 2, 'O'.charCodeAt(0), colors.towerCannon, colors.terrainEmpty);
		setCell(buf, layout.gameGrid.x + 14, pathRow + 1, '*'.charCodeAt(0), colors.towerFrost, colors.terrainEmpty);
		setCell(buf, layout.gameGrid.x + 18, pathRow - 1, '~'.charCodeAt(0), colors.towerLightning, colors.terrainEmpty);

		// Place a demo enemy on the path
		setCell(buf, layout.gameGrid.x + 3, pathRow, 'W'.charCodeAt(0), colors.enemyWalker, colors.terrainEmpty);

		// Cursor highlight
		const cursorX = layout.gameGrid.x + 8;
		const cursorY = pathRow - 1;
		setCell(buf, cursorX, cursorY, ' '.charCodeAt(0), colors.cursorNormal, colors.cursorNormal);

		// Sidebar content (below header divider at y=2)
		const sideX = layout.sidebar.x + 1;
		// Sidebar title in the header row
		writeText(buf, sideX, layout.header.y, 'COMMANDS', colors.uiTextBright, colors.uiBackground);
		let sideY = layout.header.y + layout.header.height + 2;
		writeText(buf, sideX, sideY, '-- NORMAL --', colors.modeNormal, colors.uiBackground);
		sideY += 1;
		writeText(buf, sideX, sideY, 'h/j/k/l  move', colors.uiText, colors.uiBackground);
		sideY += 1;
		writeText(buf, sideX, sideY, 'w/b      jump tower', colors.uiText, colors.uiBackground);
		sideY += 1;
		writeText(buf, sideX, sideY, 'i        insert mode', colors.uiText, colors.uiBackground);
		sideY += 1;
		writeText(buf, sideX, sideY, 'x        quick sell', colors.uiText, colors.uiBackground);
		sideY += 1;
		writeText(buf, sideX, sideY, ':        command mode', colors.uiText, colors.uiBackground);
		sideY += 2;
		writeText(buf, sideX, sideY, '-- INSERT --', colors.modeInsert, colors.uiBackground);
		sideY += 1;
		writeText(buf, sideX, sideY, '1  > Arrow    50g', colors.towerArrow, colors.uiBackground);
		sideY += 1;
		writeText(buf, sideX, sideY, '2  O Cannon  100g', colors.towerCannon, colors.uiBackground);
		sideY += 1;
		writeText(buf, sideX, sideY, '3  * Frost    75g', colors.towerFrost, colors.uiBackground);
		sideY += 1;
		writeText(buf, sideX, sideY, '4  ~ Lightn  125g', colors.towerLightning, colors.uiBackground);

		// Build menu
		writeText(buf, layout.buildMenu.x, layout.buildMenu.y, '1:Arrow 2:Cannon 3:Frost 4:Lightning', colors.uiText, colors.uiBackground);

		// Status bar — fill entire row with background first
		fillRect(buf, layout.statusBar, ' '.charCodeAt(0), colors.uiText, palette.darkGray);
		writeText(buf, layout.statusBar.x, layout.statusBar.y, ' -- NORMAL --', colors.modeNormal, palette.darkGray);
		const posText = '8,6';
		const posX = Math.floor(layout.statusBar.width / 2) - Math.floor(posText.length / 2);
		writeText(buf, posX, layout.statusBar.y, posText, colors.uiTextBright, palette.darkGray);
		const msgText = 'Welcome to VIM Tower Defense!';
		writeText(buf, layout.statusBar.width - msgText.length - 1, layout.statusBar.y, msgText, colors.uiText, palette.darkGray);

		// Render the buffer to canvas
		renderBuffer(manager.ctx, tileset, buf);

		return () => {
			manager.destroy();
		};
	}
</script>

<div id="game-container">
	<canvas bind:this={canvas} id="game-canvas"></canvas>
</div>

<style>
	#game-container {
		width: 100%;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #000;
	}

	#game-canvas {
		image-rendering: pixelated;
		image-rendering: crisp-edges;
	}
</style>
