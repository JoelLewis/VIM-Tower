import { describe, it, expect } from 'vitest';
import { createGame, handleKeyPress, updateGame, isGameOver, getPhase } from '../game.js';
import type { StageConfig } from '../game.js';
import { CELL_TYPES, GAME_PHASES, GAME_MODES } from '$lib/types/game.js';
import type { CellType } from '$lib/types/game.js';
import { getAliveEnemies } from '../enemy-manager.js';

/**
 * Test layout (8x5):
 *   0 1 2 3 4 5 6 7
 * 0 . . . . . . . .
 * 1 . . . . . . . .
 * 2 S P P P P P P E   (path along row 2)
 * 3 . . . . . . . .
 * 4 . . . . . . . .
 */
function makeTestLayout(): CellType[][] {
	const grid: CellType[][] = [];
	for (let y = 0; y < 5; y++) {
		const row: CellType[] = [];
		for (let x = 0; x < 8; x++) {
			if (y === 2) {
				if (x === 0) row.push(CELL_TYPES.spawn);
				else if (x === 7) row.push(CELL_TYPES.exit);
				else row.push(CELL_TYPES.path);
			} else {
				row.push(CELL_TYPES.empty);
			}
		}
		grid.push(row);
	}
	return grid;
}

const testStage: StageConfig = {
	name: 'Test Stage',
	gridLayout: makeTestLayout(),
	waypoints: [
		{ x: 0, y: 2 },
		{ x: 7, y: 2 }
	],
	waves: [
		{
			groups: [{ type: 'walker', count: 2, spawnInterval: 0.5 }]
		},
		{
			groups: [{ type: 'runner', count: 1, spawnInterval: 0.5 }]
		}
	],
	startingGold: 200,
	startingLives: 10
};

describe('createGame', () => {
	it('initializes game in planning phase with correct starting state', () => {
		const game = createGame(testStage);
		expect(game.state.phase).toBe(GAME_PHASES.planning);
		expect(game.state.mode).toBe(GAME_MODES.normal);
		expect(game.state.gold).toBe(200);
		expect(game.state.lives).toBe(10);
		expect(game.state.totalWaves).toBe(2);
		expect(game.state.currentWave).toBe(1);
	});

	it('creates grid with correct dimensions', () => {
		const game = createGame(testStage);
		expect(game.grid.width).toBe(8);
		expect(game.grid.height).toBe(5);
	});
});

describe('handleKeyPress', () => {
	it('moves cursor with h/j/k/l', () => {
		const game = createGame(testStage);
		handleKeyPress(game, 'l');
		expect(game.state.cursor.x).toBe(1);
		handleKeyPress(game, 'j');
		expect(game.state.cursor.y).toBe(1);
	});

	it('enters insert mode with i', () => {
		const game = createGame(testStage);
		handleKeyPress(game, 'i');
		expect(game.state.mode).toBe(GAME_MODES.insert);
	});

	it('places a tower in insert mode', () => {
		const game = createGame(testStage);
		// Move to empty cell (0,0) and place arrow tower
		handleKeyPress(game, 'i');
		handleKeyPress(game, '1'); // arrow tower
		expect(game.grid.towers.size).toBe(1);
		expect(game.state.gold).toBe(150); // 200 - 50 for arrow
	});

	it('starts combat with :w', () => {
		const game = createGame(testStage);
		handleKeyPress(game, ':');
		handleKeyPress(game, 'w');
		handleKeyPress(game, 'Enter');
		expect(game.state.phase).toBe(GAME_PHASES.combat);
		expect(game.waves.active).toBe(true);
	});

	it('returns to normal mode after command execution', () => {
		const game = createGame(testStage);
		handleKeyPress(game, ':');
		expect(game.state.mode).toBe(GAME_MODES.command);
		handleKeyPress(game, 'h');
		handleKeyPress(game, 'e');
		handleKeyPress(game, 'l');
		handleKeyPress(game, 'p');
		handleKeyPress(game, 'Enter');
		expect(game.state.mode).toBe(GAME_MODES.normal);
	});
});

describe('updateGame', () => {
	it('does nothing during planning phase', () => {
		const game = createGame(testStage);
		updateGame(game, 1.0);
		expect(getAliveEnemies(game.enemies)).toHaveLength(0);
	});

	it('spawns and moves enemies during combat', () => {
		const game = createGame(testStage);
		// Start combat
		handleKeyPress(game, ':');
		handleKeyPress(game, 'w');
		handleKeyPress(game, 'Enter');

		// Update to spawn first enemy
		updateGame(game, 0.01);
		expect(getAliveEnemies(game.enemies)).toHaveLength(1);

		// Update to move enemies (walker speed 1.5, needs ~0.67s to cross one cell)
		updateGame(game, 0.7);
		const alive = getAliveEnemies(game.enemies);
		expect(alive.length).toBeGreaterThanOrEqual(1);
		// First enemy should have moved past cell 0 (1.5 * 0.71s ≈ 1.065 cells)
		expect(alive[0].pathIndex).toBeGreaterThan(0);
	});

	it('deducts lives when enemies reach exit', () => {
		const game = createGame(testStage);
		// Start combat
		handleKeyPress(game, ':');
		handleKeyPress(game, 'w');
		handleKeyPress(game, 'Enter');

		// Spawn enemies
		updateGame(game, 0.01);
		updateGame(game, 0.5);

		// Fast-forward: let enemies reach exit (walker speed 1.5, path length ~8)
		// Need about 5.5 seconds for walker to traverse 8 cells
		updateGame(game, 6.0);
		expect(game.state.lives).toBeLessThan(10);
	});

	it('transitions to game over when lives reach zero', () => {
		const game = createGame({ ...testStage, startingLives: 1 });
		handleKeyPress(game, ':');
		handleKeyPress(game, 'w');
		handleKeyPress(game, 'Enter');

		// Spawn and let enemies through
		updateGame(game, 0.01);
		updateGame(game, 10.0); // enough time for all walkers to exit
		expect(game.state.phase).toBe(GAME_PHASES.gameOver);
		expect(isGameOver(game)).toBe(true);
	});

	it('transitions to wave complete when all enemies are dead', () => {
		const game = createGame(testStage);
		handleKeyPress(game, ':');
		handleKeyPress(game, 'w');
		handleKeyPress(game, 'Enter');

		// Spawn all enemies
		updateGame(game, 0.01);
		updateGame(game, 0.5);
		// Both walkers should be spawned now

		// Kill them manually
		for (const enemy of game.enemies.enemies) {
			enemy.hp = 0;
			enemy.alive = false;
		}

		updateGame(game, 0.01);
		expect(game.state.phase).toBe(GAME_PHASES.waveComplete);
	});

	it('transitions from wave complete to planning for next wave', () => {
		const game = createGame(testStage);
		handleKeyPress(game, ':');
		handleKeyPress(game, 'w');
		handleKeyPress(game, 'Enter');

		// Spawn and kill all enemies
		updateGame(game, 0.01);
		updateGame(game, 0.5);
		for (const enemy of game.enemies.enemies) {
			enemy.hp = 0;
			enemy.alive = false;
		}

		// Trigger wave complete
		updateGame(game, 0.01);
		expect(game.state.phase).toBe(GAME_PHASES.waveComplete);

		// Next update transitions to planning
		updateGame(game, 0.01);
		expect(game.state.phase).toBe(GAME_PHASES.planning);
		expect(game.state.currentWave).toBe(2);
	});

	it('transitions to stage complete after all waves', () => {
		const game = createGame(testStage);

		// Wave 1
		handleKeyPress(game, ':');
		handleKeyPress(game, 'w');
		handleKeyPress(game, 'Enter');
		updateGame(game, 0.01);
		updateGame(game, 0.5);
		for (const enemy of game.enemies.enemies) {
			enemy.hp = 0;
			enemy.alive = false;
		}
		updateGame(game, 0.01); // wave complete
		updateGame(game, 0.01); // → planning

		// Wave 2
		handleKeyPress(game, ':');
		handleKeyPress(game, 'w');
		handleKeyPress(game, 'Enter');
		updateGame(game, 0.01);
		for (const enemy of game.enemies.enemies) {
			enemy.hp = 0;
			enemy.alive = false;
		}
		updateGame(game, 0.01); // wave complete
		updateGame(game, 0.01); // → stage complete

		expect(game.state.phase).toBe(GAME_PHASES.stageComplete);
		expect(isGameOver(game)).toBe(true);
	});
});

describe('getPhase', () => {
	it('returns the current game phase', () => {
		const game = createGame(testStage);
		expect(getPhase(game)).toBe(GAME_PHASES.planning);
	});
});

describe('player feedback', () => {
	it('explains a key that does nothing in NORMAL mode', () => {
		const game = createGame(testStage);
		const msg = handleKeyPress(game, 'z');
		expect(msg).toContain('E: z is not a command');
		expect(game.state.keystrokeCount).toBe(0);
	});

	it('explains a key that does nothing in INSERT mode', () => {
		const game = createGame(testStage);
		handleKeyPress(game, 'i');
		expect(handleKeyPress(game, 'q')).toContain('INSERT mode');
	});

	it('does not flag the start of a longer command', () => {
		const game = createGame(testStage);
		expect(handleKeyPress(game, '3')).not.toContain('E:');
		expect(handleKeyPress(game, 'g')).not.toContain('E:');
	});

	it(':help opens a screen that any key closes without acting', () => {
		const game = createGame(testStage);
		for (const key of [':', 'h', 'e', 'l', 'p', 'Enter']) handleKeyPress(game, key);
		expect(game.state.helpOpen).toBe(true);
		handleKeyPress(game, 'j');
		expect(game.state.helpOpen).toBe(false);
		expect(game.state.cursor.y).toBe(0);
	});

	it('pauses combat while help is open', () => {
		const game = createGame(testStage);
		for (const key of [':', 'w', 'Enter', ':', 'h', 'Enter']) handleKeyPress(game, key);
		for (let i = 0; i < 200; i++) updateGame(game, 0.05);
		expect(game.state.lives).toBe(10);
		expect(game.state.phase).toBe(GAME_PHASES.combat);
	});

	it('shows an error over the tutorial and does not advance it on failure', () => {
		const game = createGame({
			...testStage,
			tutorialSteps: [
				{
					message: 'Press 1 to place a tower.',
					requiredAction: 'place_tower',
					highlightCell: null
				},
				{ message: 'Now press Esc.', requiredAction: 'enter_normal_mode', highlightCell: null }
			]
		});
		// Move onto the path (row 2) and try to build there
		handleKeyPress(game, 'j');
		handleKeyPress(game, 'j');
		handleKeyPress(game, 'i');
		const msg = handleKeyPress(game, '1');
		expect(msg).toMatch(/^E:/);
		expect(game.tutorial.currentStep).toBe(0);

		// A valid placement advances the tutorial
		handleKeyPress(game, 'k');
		expect(handleKeyPress(game, '1')).toBe('Now press Esc.');
	});

	it('flashes the exit and warns when an enemy gets through', () => {
		const game = createGame(testStage);
		for (const key of [':', 'w', 'Enter']) handleKeyPress(game, key);
		for (let i = 0; i < 200 && game.state.lives === 10; i++) updateGame(game, 0.05);
		expect(game.state.lives).toBeLessThan(10);
		expect(game.state.message).toContain('got through');
		expect(game.effects.some((e) => e.kind === 'leak')).toBe(true);
	});
});
