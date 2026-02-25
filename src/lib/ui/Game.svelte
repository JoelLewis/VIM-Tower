<script lang="ts">
	import { onMount } from 'svelte';
	import type { StageConfig } from '$lib/engine/game.js';
	import { createGame, handleKeyPress, updateGame } from '$lib/engine/game.js';
	import { createScreenLayout, getScreenPixelSize } from '$lib/renderer/screen-layout.js';
	import { createCanvasManager } from '$lib/renderer/canvas-manager.js';
	import { loadTileset } from '$lib/renderer/tileset.js';
	import { renderGame } from '$lib/renderer/game-renderer.js';
	import { renderBuffer } from '$lib/renderer/grid-renderer.js';

	export let stageConfig: StageConfig;

	let canvasEl: HTMLCanvasElement;

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

			// Keyboard handler
			function onKeyDown(e: KeyboardEvent) {
				// Prevent browser defaults for game keys
				if (['Tab', 'Escape', ':', '/'].includes(e.key) || e.key.startsWith('Arrow')) {
					e.preventDefault();
				}
				handleKeyPress(game, e.key);
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

			// Game loop
			function tick(now: number) {
				if (!paused) {
					const dt = Math.min((now - lastTime) / 1000, 0.1); // cap at 100ms
					lastTime = now;

					updateGame(game, dt);
				}

				// Render every frame regardless of pause (for UI responsiveness)
				const buf = renderGame(game, layout);
				renderBuffer(cm.ctx, tileset, buf);

				rafId = requestAnimationFrame(tick);
			}

			window.addEventListener('keydown', onKeyDown);
			document.addEventListener('visibilitychange', onVisibilityChange);
			lastTime = performance.now();
			rafId = requestAnimationFrame(tick);

			return () => {
				cancelAnimationFrame(rafId);
				window.removeEventListener('keydown', onKeyDown);
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

<div class="game-container">
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
