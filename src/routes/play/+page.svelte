<script lang="ts">
	import Game from '$lib/ui/Game.svelte';
	import type { StageConfig } from '$lib/engine/game.js';
	import { CELL_TYPES } from '$lib/types/game.js';
	import type { CellType } from '$lib/types/game.js';

	/**
	 * Stage 1: First Steps (10x7)
	 * Straight horizontal path, 3 waves of walkers, Arrow tower only.
	 *
	 *   0 1 2 3 4 5 6 7 8 9
	 * 0 . . . . . . . . . .
	 * 1 . . . . . . . . . .
	 * 2 . . . . . . . . . .
	 * 3 S P P P P P P P P E
	 * 4 . . . . . . . . . .
	 * 5 . . . . . . . . . .
	 * 6 . . . . . . . . . .
	 */
	function makeStage1Layout(): CellType[][] {
		const grid: CellType[][] = [];
		for (let y = 0; y < 7; y++) {
			const row: CellType[] = [];
			for (let x = 0; x < 10; x++) {
				if (y === 3) {
					if (x === 0) row.push(CELL_TYPES.spawn);
					else if (x === 9) row.push(CELL_TYPES.exit);
					else row.push(CELL_TYPES.path);
				} else {
					row.push(CELL_TYPES.empty);
				}
			}
			grid.push(row);
		}
		return grid;
	}

	const stage1: StageConfig = {
		name: 'Stage 1: First Steps',
		gridLayout: makeStage1Layout(),
		waypoints: [
			{ x: 0, y: 3 },
			{ x: 9, y: 3 }
		],
		waves: [
			{
				groups: [{ type: 'walker', count: 3, spawnInterval: 1.0 }]
			},
			{
				groups: [{ type: 'walker', count: 5, spawnInterval: 0.8 }]
			},
			{
				groups: [
					{ type: 'walker', count: 4, spawnInterval: 0.8 },
					{ type: 'walker', count: 2, spawnInterval: 0.6 }
				]
			}
		],
		startingGold: 200,
		startingLives: 10
	};
</script>

<svelte:head>
	<title>VIM Tower Defense — Stage 1</title>
</svelte:head>

<Game stageConfig={stage1} />
