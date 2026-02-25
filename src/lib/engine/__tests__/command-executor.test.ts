import { describe, it, expect, beforeEach } from 'vitest';
import { executeCommand } from '../command-executor.js';
import { createGrid, getTower, placeTower } from '../grid.js';
import type { Grid } from '../grid.js';
import type { GameState, CellType } from '$lib/types/game.js';
import { CELL_TYPES, GAME_MODES, GAME_PHASES, TOWER_TYPES } from '$lib/types/game.js';

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

function makeState(overrides: Partial<GameState> = {}): GameState {
	return {
		mode: GAME_MODES.normal,
		phase: GAME_PHASES.planning,
		cursor: { x: 3, y: 1 },
		gold: 500,
		lives: 20,
		currentWave: 1,
		totalWaves: 3,
		currentStage: 1,
		keystrokeCount: 0,
		commandBuffer: '',
		message: '',
		selectedTowerType: TOWER_TYPES.arrow,
		availableTowers: [TOWER_TYPES.arrow, TOWER_TYPES.cannon, TOWER_TYPES.frost, TOWER_TYPES.lightning],
		...overrides
	};
}

describe('Command Executor — Cursor Movement', () => {
	let grid: Grid;
	let state: GameState;

	beforeEach(() => {
		grid = createGrid(makeTestLayout());
		state = makeState();
	});

	it('moves cursor right', () => {
		executeCommand({ type: 'move_cursor', dx: 1, dy: 0, count: 1 }, state, grid);
		expect(state.cursor).toEqual({ x: 4, y: 1 });
	});

	it('moves cursor with count', () => {
		executeCommand({ type: 'move_cursor', dx: 0, dy: 1, count: 3 }, state, grid);
		expect(state.cursor).toEqual({ x: 3, y: 4 });
	});

	it('clamps cursor to grid bounds', () => {
		executeCommand({ type: 'move_cursor', dx: -1, dy: 0, count: 100 }, state, grid);
		expect(state.cursor.x).toBe(0);
	});

	it('clamps cursor at bottom edge', () => {
		executeCommand({ type: 'move_cursor', dx: 0, dy: 1, count: 100 }, state, grid);
		expect(state.cursor.y).toBe(4);
	});
});

describe('Command Executor — Jump Motions', () => {
	let grid: Grid;
	let state: GameState;

	beforeEach(() => {
		grid = createGrid(makeTestLayout());
		state = makeState();
	});

	it('jump_row_start moves cursor to x=0', () => {
		executeCommand({ type: 'jump_row_start' }, state, grid);
		expect(state.cursor.x).toBe(0);
	});

	it('jump_row_end moves cursor to last column', () => {
		executeCommand({ type: 'jump_row_end' }, state, grid);
		expect(state.cursor.x).toBe(7);
	});

	it('jump_grid_start moves cursor to (0,0)', () => {
		executeCommand({ type: 'jump_grid_start' }, state, grid);
		expect(state.cursor).toEqual({ x: 0, y: 0 });
	});

	it('jump_grid_end moves cursor to bottom-right', () => {
		executeCommand({ type: 'jump_grid_end' }, state, grid);
		expect(state.cursor).toEqual({ x: 7, y: 4 });
	});

	it('jump_next_tower moves to next tower', () => {
		placeTower(grid, 5, 1, TOWER_TYPES.arrow);
		executeCommand({ type: 'jump_next_tower' }, state, grid);
		expect(state.cursor).toEqual({ x: 5, y: 1 });
	});

	it('jump_next_tower returns error message when no tower', () => {
		const msg = executeCommand({ type: 'jump_next_tower' }, state, grid);
		expect(msg).toContain('No next tower');
	});

	it('jump_prev_tower moves to previous tower', () => {
		placeTower(grid, 1, 0, TOWER_TYPES.cannon);
		executeCommand({ type: 'jump_prev_tower' }, state, grid);
		expect(state.cursor).toEqual({ x: 1, y: 0 });
	});

	it('jump_row_last_tower finds last tower in row', () => {
		placeTower(grid, 2, 1, TOWER_TYPES.arrow);
		placeTower(grid, 6, 1, TOWER_TYPES.cannon);
		executeCommand({ type: 'jump_row_last_tower' }, state, grid);
		expect(state.cursor.x).toBe(6);
	});
});

describe('Command Executor — Tower Placement', () => {
	let grid: Grid;
	let state: GameState;

	beforeEach(() => {
		grid = createGrid(makeTestLayout());
		state = makeState({ cursor: { x: 3, y: 0 } });
	});

	it('places tower and deducts gold', () => {
		const msg = executeCommand({ type: 'place_tower', towerType: 'arrow' }, state, grid);
		expect(getTower(grid, 3, 0)).toBeDefined();
		expect(state.gold).toBe(450); // 500 - 50
		expect(msg).toContain('arrow');
	});

	it('rejects placement with insufficient gold', () => {
		state.gold = 10;
		const msg = executeCommand({ type: 'place_tower', towerType: 'arrow' }, state, grid);
		expect(getTower(grid, 3, 0)).toBeUndefined();
		expect(state.gold).toBe(10); // unchanged
		expect(msg).toContain('Not enough gold');
	});

	it('rejects placement on path', () => {
		state.cursor = { x: 3, y: 2 }; // path cell
		const msg = executeCommand({ type: 'place_tower', towerType: 'arrow' }, state, grid);
		expect(msg).toContain('path');
	});

	it('rejects unavailable tower type', () => {
		state.availableTowers = [TOWER_TYPES.arrow];
		const msg = executeCommand({ type: 'place_tower', towerType: 'cannon' }, state, grid);
		expect(getTower(grid, 3, 0)).toBeUndefined();
		expect(state.gold).toBe(500); // unchanged
		expect(msg).toContain('not available');
	});
});

describe('Command Executor — Quick Sell', () => {
	let grid: Grid;
	let state: GameState;

	beforeEach(() => {
		grid = createGrid(makeTestLayout());
		state = makeState({ cursor: { x: 3, y: 0 } });
		placeTower(grid, 3, 0, TOWER_TYPES.arrow);
	});

	it('sells tower and adds gold (60% of cost)', () => {
		const msg = executeCommand({ type: 'quick_sell_tower' }, state, grid);
		expect(getTower(grid, 3, 0)).toBeUndefined();
		expect(state.gold).toBe(530); // 500 + 30 (60% of 50)
		expect(msg).toContain('Sold');
	});

	it('returns error when no tower under cursor', () => {
		state.cursor = { x: 0, y: 0 };
		const msg = executeCommand({ type: 'quick_sell_tower' }, state, grid);
		expect(msg).toContain('No tower under cursor');
	});
});

describe('Command Executor — Mode Transitions', () => {
	let grid: Grid;
	let state: GameState;

	beforeEach(() => {
		grid = createGrid(makeTestLayout());
		state = makeState();
	});

	it('enter_insert_mode changes mode', () => {
		executeCommand({ type: 'enter_insert_mode', variant: 'i' }, state, grid);
		expect(state.mode).toBe('insert');
	});

	it('enter_normal_mode changes mode', () => {
		state.mode = GAME_MODES.insert;
		executeCommand({ type: 'enter_normal_mode' }, state, grid);
		expect(state.mode).toBe('normal');
	});

	it('enter_command_mode changes mode', () => {
		executeCommand({ type: 'enter_command_mode' }, state, grid);
		expect(state.mode).toBe('command');
	});
});

describe('Command Executor — Ex Commands', () => {
	let grid: Grid;
	let state: GameState;

	beforeEach(() => {
		grid = createGrid(makeTestLayout());
		state = makeState();
	});

	it(':w starts combat wave', () => {
		const msg = executeCommand({ type: 'execute_command', command: 'w' }, state, grid);
		expect(state.phase).toBe('combat');
		expect(msg).toContain('Wave 1/3');
	});

	it(':w during combat returns error', () => {
		state.phase = GAME_PHASES.combat;
		const msg = executeCommand({ type: 'execute_command', command: 'w' }, state, grid);
		expect(msg).toContain('Already in combat');
	});

	it(':q without save shows error', () => {
		const msg = executeCommand({ type: 'execute_command', command: 'q' }, state, grid);
		expect(msg).toContain('No write since last change');
		expect(state.phase).toBe('planning');
	});

	it(':q! force quits', () => {
		executeCommand({ type: 'execute_command', command: 'q!' }, state, grid);
		expect(state.phase).toBe('game_over');
	});

	it(':help returns help message', () => {
		const msg = executeCommand({ type: 'execute_command', command: 'help' }, state, grid);
		expect(msg).toContain('h/j/k/l');
	});

	it('unknown command returns error', () => {
		const msg = executeCommand({ type: 'execute_command', command: 'blah' }, state, grid);
		expect(msg).toContain('Not a command');
	});
});

describe('Command Executor — Keystroke Counting', () => {
	it('increments keystroke count for every command', () => {
		const grid = createGrid(makeTestLayout());
		const state = makeState();
		executeCommand({ type: 'move_cursor', dx: 1, dy: 0, count: 1 }, state, grid);
		executeCommand({ type: 'move_cursor', dx: 0, dy: 1, count: 1 }, state, grid);
		executeCommand({ type: 'jump_row_start' }, state, grid);
		expect(state.keystrokeCount).toBe(3);
	});
});
