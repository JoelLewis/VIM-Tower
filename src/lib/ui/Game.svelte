<script lang="ts">
	import { onMount } from 'svelte';
	import type { StageConfig } from '$lib/engine/game.js';
	import { createGame, handleKeyPress, updateGame } from '$lib/engine/game.js';
	import { createScreenLayout, getScreenPixelSize } from '$lib/renderer/screen-layout.js';
	import { createCanvasManager } from '$lib/renderer/canvas-manager.js';
	import { loadTileset } from '$lib/renderer/tileset.js';
	import { renderGame } from '$lib/renderer/game-renderer.js';
	import { renderBuffer } from '$lib/renderer/grid-renderer.js';
	import { GAME_PHASES, GAME_MODES } from '$lib/types/game.js';
	import type { GamePhase, GameMode } from '$lib/types/game.js';
	import { loadProgress, saveProgress, completeStage } from '$lib/stages/progression.js';

	export let stageConfig: StageConfig;
	export let stageId: number = 1;
	export let parKeystrokes: number = 30;
	export let testMode: boolean = false;

	// Test mode speed multiplier: 10x faster for E2E tests
	const TEST_MODE_SPEED_MULTIPLIER = 10;

	const MOUSE_HINTS = [
		'This is VIM — use h/j/k/l to move!',
		'Try pressing i to enter INSERT mode.',
		'Use :w to start the wave.',
		'Mouse not supported — embrace the keyboard!',
		'The cursor is your friend. h=left j=down k=up l=right',
		'Click? In MY terminal? Use the keyboard!'
	];

	let canvasEl: HTMLCanvasElement;

	// Reactive state for E2E test data attributes
	let gamePhase: GamePhase = GAME_PHASES.planning;
	let gameMode: GameMode = GAME_MODES.normal;
	let gameGold: number = 0;
	let gameLives: number = 0;
	let gameWave: number = 0;
	let gameTotalWaves: number = 0;
	let gameKeystrokes: number = 0;

	onMount(() => {
		let rafId: number;
		let lastTime = 0;
		let paused = false;

		async function init() {
			const tileset = await loadTileset('/fonts/cp437.png');
			const layout = createScreenLayout(stageConfig.gridLayout[0].length, stageConfig.gridLayout.length);
			const { width, height } = getScreenPixelSize(layout);
			const cm = createCanvasManager(canvasEl, width, height);
			const game = createGame(stageConfig);

			let mouseHintIndex = 0;

			// Keyboard handler
			function onKeyDown(e: KeyboardEvent) {
				// Prevent browser defaults for game keys
				if (['Tab', 'Escape', ':', '/'].includes(e.key) || e.key.startsWith('Arrow')) {
					e.preventDefault();
				}

				// On game over or stage complete, Enter returns to menu
				if (game.state.phase === GAME_PHASES.gameOver || game.state.phase === GAME_PHASES.stageComplete) {
					if (e.key === 'Enter' || e.key === 'Escape') {
						if (game.state.phase === GAME_PHASES.stageComplete) {
							const progress = loadProgress();
							const updated = completeStage(progress, stageId, game.state.keystrokeCount, parKeystrokes);
							saveProgress(updated);
						}
						window.location.href = '/';
						return;
					}
				}

				handleKeyPress(game, e.key);
			}

			// Mouse click handler — show VIM hints
			function onClick() {
				game.state.message = MOUSE_HINTS[mouseHintIndex % MOUSE_HINTS.length];
				mouseHintIndex++;
			}

			// Visibility change handler — pause when tab is hidden
			function onVisibilityChange() {
				if (document.hidden) {
					paused = true;
				} else {
					paused = false;
					lastTime = performance.now();
				}
			}

			// Sync state from game to reactive variables for E2E testing
			function syncState() {
				gamePhase = game.state.phase;
				gameMode = game.state.mode;
				gameGold = game.state.gold;
				gameLives = game.state.lives;
				gameWave = game.state.currentWave;
				gameTotalWaves = game.state.totalWaves;
				gameKeystrokes = game.state.keystrokeCount;
			}

			// Game loop
			function tick(now: number) {
				if (!paused) {
					let dt = Math.min((now - lastTime) / 1000, 0.1); // cap at 100ms
					lastTime = now;

					// Apply test mode speed multiplier for faster E2E tests
					if (testMode) {
						dt *= TEST_MODE_SPEED_MULTIPLIER;
					}

					updateGame(game, dt);
				}

				// Sync state for E2E test data attributes
				syncState();

				// Render every frame regardless of pause (for UI responsiveness)
				const buf = renderGame(game, layout);
				renderBuffer(cm.ctx, tileset, buf);

				rafId = requestAnimationFrame(tick);
			}

			window.addEventListener('keydown', onKeyDown);
			canvasEl.addEventListener('click', onClick);
			document.addEventListener('visibilitychange', onVisibilityChange);
			lastTime = performance.now();
			rafId = requestAnimationFrame(tick);

			return () => {
				cancelAnimationFrame(rafId);
				window.removeEventListener('keydown', onKeyDown);
				canvasEl.removeEventListener('click', onClick);
				document.removeEventListener('visibilitychange', onVisibilityChange);
				cm.destroy();
			};
		}

		let cleanup: (() => void) | undefined;

		init().then((cleanupFn) => {
			cleanup = cleanupFn;
		});

		return () => {
			if (cleanup) cleanup();
		};
	});
</script>

<div
	class="game-container"
	data-testid="game-container"
	data-phase={gamePhase}
	data-mode={gameMode}
	data-gold={gameGold}
	data-lives={gameLives}
	data-wave={gameWave}
	data-total-waves={gameTotalWaves}
	data-keystrokes={gameKeystrokes}
>
	<canvas bind:this={canvasEl}></canvas>
</div>

<style>
	.game-container {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100vw;
		height: 100vh;
		background: #000;
		overflow: hidden;
	}

	canvas {
		image-rendering: pixelated;
		image-rendering: crisp-edges;
	}
</style>
