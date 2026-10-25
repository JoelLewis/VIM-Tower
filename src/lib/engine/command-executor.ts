/**
 * Command executor — applies parsed Commands to game state.
 *
 * Takes a Command (from VimParser) and mutates the GameState and Grid.
 * Returns a message string for the status bar (empty string if no message).
 */

import type { Command, GameState } from '$lib/types/game.js';
import { GAME_MODES, GAME_PHASES } from '$lib/types/game.js';
import type { Grid } from './grid.js';
import { placeTower, removeTower, getTower, getNextTower, getPrevTower } from './grid.js';
import { getTowerCost, getSellValue } from './tower-stats.js';

export function executeCommand(command: Command, state: GameState, grid: Grid): string {
	state.keystrokeCount++;

	switch (command.type) {
		case 'move_cursor':
			return executeMoveCommand(command, state, grid);
		case 'jump_next_tower':
			return executeJumpNextTower(state, grid);
		case 'jump_prev_tower':
			return executeJumpPrevTower(state, grid);
		case 'jump_row_start':
			state.cursor.x = 0;
			return '';
		case 'jump_row_end':
			state.cursor.x = grid.width - 1;
			return '';
		case 'jump_row_last_tower':
			return executeJumpRowLastTower(state, grid);
		case 'jump_grid_start':
			state.cursor.x = 0;
			state.cursor.y = 0;
			return '';
		case 'jump_grid_end':
			state.cursor.x = grid.width - 1;
			state.cursor.y = grid.height - 1;
			return '';
		case 'quick_sell_tower':
			return executeQuickSell(state, grid);
		case 'enter_insert_mode':
			return executeEnterInsert(command, state, grid);
		case 'enter_normal_mode':
			state.mode = GAME_MODES.normal;
			return '';
		case 'enter_command_mode':
			state.mode = GAME_MODES.command;
			state.commandBuffer = '';
			return '';
		case 'enter_visual_mode':
			return '';
		case 'place_tower':
			return executePlaceTower(command, state, grid);
		case 'execute_command':
			return executeExCommand(command.command, state);
		case 'cancel_command':
			state.mode = GAME_MODES.normal;
			state.commandBuffer = '';
			return '';
	}
}

function executeMoveCommand(
	command: Extract<Command, { type: 'move_cursor' }>,
	state: GameState,
	grid: Grid
): string {
	const newX = state.cursor.x + command.dx * command.count;
	const newY = state.cursor.y + command.dy * command.count;
	state.cursor.x = clamp(newX, 0, grid.width - 1);
	state.cursor.y = clamp(newY, 0, grid.height - 1);
	return '';
}

/** i inserts at the cursor; a, o and O first move right, down or up (like VIM) */
const INSERT_OFFSETS: Record<'i' | 'a' | 'o' | 'O', { dx: number; dy: number }> = {
	i: { dx: 0, dy: 0 },
	a: { dx: 1, dy: 0 },
	o: { dx: 0, dy: 1 },
	O: { dx: 0, dy: -1 }
};

function executeEnterInsert(
	command: Extract<Command, { type: 'enter_insert_mode' }>,
	state: GameState,
	grid: Grid
): string {
	const { dx, dy } = INSERT_OFFSETS[command.variant];
	state.cursor.x = clamp(state.cursor.x + dx, 0, grid.width - 1);
	state.cursor.y = clamp(state.cursor.y + dy, 0, grid.height - 1);
	state.mode = GAME_MODES.insert;
	// The status bar already shows -- INSERT --
	return '';
}

function executeJumpNextTower(state: GameState, grid: Grid): string {
	const next = getNextTower(grid, state.cursor.x, state.cursor.y);
	if (next) {
		state.cursor.x = next.x;
		state.cursor.y = next.y;
		return '';
	}
	return 'E: No next tower';
}

function executeJumpPrevTower(state: GameState, grid: Grid): string {
	const prev = getPrevTower(grid, state.cursor.x, state.cursor.y);
	if (prev) {
		state.cursor.x = prev.x;
		state.cursor.y = prev.y;
		return '';
	}
	return 'E: No previous tower';
}

function executeJumpRowLastTower(state: GameState, grid: Grid): string {
	// Scan from end of current row backward to find last tower
	for (let x = grid.width - 1; x >= 0; x--) {
		if (getTower(grid, x, state.cursor.y)) {
			state.cursor.x = x;
			return '';
		}
	}
	return 'E: No towers in row';
}

function executeQuickSell(state: GameState, grid: Grid): string {
	const tower = getTower(grid, state.cursor.x, state.cursor.y);
	if (!tower) {
		return 'E: No tower under cursor';
	}
	const value = getSellValue(tower.type);
	const result = removeTower(grid, state.cursor.x, state.cursor.y);
	if (result.success) {
		state.gold += value;
		return `Sold ${tower.type} for ${value}g`;
	}
	return 'E: Failed to sell tower';
}

function executePlaceTower(
	command: Extract<Command, { type: 'place_tower' }>,
	state: GameState,
	grid: Grid
): string {
	if (!state.availableTowers.includes(command.towerType)) {
		return `E: ${command.towerType} tower not available on this stage`;
	}
	const cost = getTowerCost(command.towerType);
	if (state.gold < cost) {
		return `E: Not enough gold (need ${cost}g, have ${state.gold}g)`;
	}
	const result = placeTower(grid, state.cursor.x, state.cursor.y, command.towerType);
	if (result.success) {
		state.gold -= cost;
		state.selectedTowerType = command.towerType;
		return `Placed ${command.towerType} (${cost}g)`;
	}
	return `E: ${!result.success ? result.error : 'Unknown error'}`;
}

function executeExCommand(command: string, state: GameState): string {
	state.mode = GAME_MODES.normal;
	state.commandBuffer = '';

	switch (command) {
		case 'q':
			return 'E: No write since last change (add ! to override)';
		case 'q!':
			state.phase = GAME_PHASES.gameOver;
			return 'Quit!';
		case 'w':
		case 'wave':
			if (state.phase === GAME_PHASES.planning) {
				state.phase = GAME_PHASES.combat;
				return `Wave ${state.currentWave}/${state.totalWaves} starting!`;
			}
			return 'E: Already in combat';
		case 'wq':
			if (state.phase === GAME_PHASES.planning) {
				state.phase = GAME_PHASES.combat;
				return `Wave ${state.currentWave}/${state.totalWaves} starting!`;
			}
			return 'E: Already in combat';
		case 'save':
			return ':save is not in this version yet';
		case 'h':
		case 'help':
			state.helpOpen = true;
			return 'Help: h/j/k/l move, i insert, 1-4 tower, :w wave. Any key closes.';
		case 'map':
			return ':map is not in this version yet';
		case '':
			return '';
		default:
			return `E: Not a command: ${command}`;
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
