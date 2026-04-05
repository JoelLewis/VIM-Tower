<script lang="ts">
	import { onMount } from 'svelte';
	import { loadTileset } from '$lib/renderer/tileset.js';
	import type { Tileset } from '$lib/renderer/tileset.js';
	import { createCanvasManager } from '$lib/renderer/canvas-manager.js';
	import {
		createCellBuffer,
		writeText,
		fillRect,
		renderBuffer,
		drawBox
	} from '$lib/renderer/grid-renderer.js';
	import type { CellBuffer } from '$lib/renderer/grid-renderer.js';
	import { colors, palette } from '$lib/renderer/colors.js';
	import { ALL_STAGES } from '$lib/stages/stage-data.js';
	import { loadProgress } from '$lib/stages/progression.js';
	import type { ProgressData } from '$lib/stages/progression.js';

	let canvas: HTMLCanvasElement;

	const MENU_COLS = 50;
	const MENU_ROWS = 30;
	const GLYPH_SIZE = 16;

	// Reactive state for E2E test data attributes
	let menuSelectedIndex: number = 0;
	let menuUnlockedStages: number = 1;

	onMount(() => {
		let cleanup: (() => void) | undefined;

		init().then((c) => {
			cleanup = c;
		});

		return () => {
			if (cleanup) cleanup();
		};
	});

	async function init() {
		const tileset = await loadTileset('/fonts/cp437.png');
		const cm = createCanvasManager(canvas, MENU_COLS * GLYPH_SIZE, MENU_ROWS * GLYPH_SIZE);
		const progress = loadProgress();

		let selectedIndex = 0;

		// Sync initial state for E2E test data attributes
		menuSelectedIndex = selectedIndex;
		menuUnlockedStages = progress.unlockedStages;

		function render() {
			const buf = createCellBuffer(MENU_COLS, MENU_ROWS);
			drawMenu(buf, tileset, progress, selectedIndex);
			renderBuffer(cm.ctx, tileset, buf);
		}

		function onKeyDown(e: KeyboardEvent) {
			e.preventDefault();

			switch (e.key) {
				case 'j':
				case 'ArrowDown':
					selectedIndex = Math.min(selectedIndex + 1, ALL_STAGES.length - 1);
					break;
				case 'k':
				case 'ArrowUp':
					selectedIndex = Math.max(selectedIndex - 1, 0);
					break;
				case 'Enter':
				case 'l':
				case 'ArrowRight': {
					const stage = ALL_STAGES[selectedIndex];
					if (stage.id <= progress.unlockedStages) {
						window.location.href = `/play?stage=${stage.id}`;
					}
					break;
				}
			}
			// Sync state for E2E test data attributes
			menuSelectedIndex = selectedIndex;
			render();
		}

		window.addEventListener('keydown', onKeyDown);
		render();

		return () => {
			window.removeEventListener('keydown', onKeyDown);
			cm.destroy();
		};
	}

	function drawMenu(buf: CellBuffer, _tileset: Tileset, progress: ProgressData, selectedIndex: number): void {
		// Title
		const title = [
			' __        __   _ ',
			' \\ \\      / __ | |',
			'  \\ \\ /\\ / /  \\| |',
			'   \\ V  V / |\\   |',
			'    \\_/\\_/\\_| \\__|'
		];

		const titleStartY = 2;
		for (let i = 0; i < title.length; i++) {
			const x = Math.floor((MENU_COLS - title[i].length) / 2);
			writeText(buf, x, titleStartY + i, title[i], colors.modeNormal, colors.uiBackground);
		}

		// Subtitle
		const subtitle = 'Tower Defense';
		writeText(buf, Math.floor((MENU_COLS - subtitle.length) / 2), titleStartY + title.length + 1, subtitle, colors.uiTextBright, colors.uiBackground);

		const tagline = 'Learn VIM by defending your server';
		writeText(buf, Math.floor((MENU_COLS - tagline.length) / 2), titleStartY + title.length + 3, tagline, colors.uiTextDim, colors.uiBackground);

		// Stage select box
		const boxX = 5;
		const boxY = 14;
		const boxW = MENU_COLS - 10;
		const boxH = ALL_STAGES.length + 4;

		drawBox(buf, boxX, boxY, boxW, boxH, colors.uiBorder, colors.uiBackground);
		writeText(buf, boxX + 2, boxY, ' SELECT STAGE ', colors.uiTextBright, colors.uiBackground);

		for (let i = 0; i < ALL_STAGES.length; i++) {
			const stage = ALL_STAGES[i];
			const locked = stage.id > progress.unlockedStages;
			const isSelected = i === selectedIndex;

			const y = boxY + 2 + i;
			const x = boxX + 2;
			const maxTextW = boxW - 4;

			if (isSelected) {
				// Highlight row
				fillRect(buf, { x, y, width: maxTextW, height: 1 }, 0, colors.uiTextBright, palette.darkGray);
			}

			const fg = locked ? colors.uiTextDim : isSelected ? colors.uiTextBright : colors.uiText;
			const bg = isSelected ? palette.darkGray : colors.uiBackground;

			// Stage name
			const name = locked ? `[LOCKED] Stage ${stage.id}` : stage.name;
			writeText(buf, x, y, name, fg, bg);

			// Score
			if (!locked) {
				const score = progress.scores[stage.id];
				if (score) {
					const ratingText = `[${score.rating}] ${score.bestKeystrokes} keys`;
					writeText(buf, x + maxTextW - ratingText.length, y, ratingText, colors.gold, bg);
				}
			}
		}

		// Controls hint
		const controlsY = boxY + boxH + 2;
		writeText(buf, boxX + 2, controlsY, 'j/k', colors.modeNormal, colors.uiBackground);
		writeText(buf, boxX + 6, controlsY, 'navigate', colors.uiText, colors.uiBackground);
		writeText(buf, boxX + 18, controlsY, 'Enter', colors.modeNormal, colors.uiBackground);
		writeText(buf, boxX + 24, controlsY, 'select', colors.uiText, colors.uiBackground);

		// Version
		writeText(buf, 1, MENU_ROWS - 1, 'v0.1.0 MVP', colors.uiTextDim, colors.uiBackground);
	}
</script>

<svelte:head>
	<title>:wq! — VIM Tower Defense</title>
</svelte:head>

<div
	id="menu-container"
	data-testid="menu-container"
	data-selected-index={menuSelectedIndex}
	data-unlocked-stages={menuUnlockedStages}
>
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	#menu-container {
		width: 100%;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #000;
	}

	canvas {
		image-rendering: pixelated;
		image-rendering: crisp-edges;
	}
</style>
