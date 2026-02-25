/**
 * Game loop — wires all subsystems together.
 *
 * Manages the full lifecycle: create → handleKey → update → (phase transitions).
 * The Game object holds all mutable subsystem state as a single source of truth.
 */

import type { GameState, GamePhase, CellType } from '$lib/types/game.js';
import { GAME_MODES, GAME_PHASES } from '$lib/types/game.js';
import type { Grid } from './grid.js';
import { createGrid } from './grid.js';
import type { EnemyManager } from './enemy-manager.js';
import { createEnemyManager, updateEnemies } from './enemy-manager.js';
import type { WaveManager, WaveDefinition } from './wave-manager.js';
import { createWaveManager, startWave, updateWave, isWaveComplete, advanceWave, isAllWavesComplete } from './wave-manager.js';
import type { VimParser } from './vim-parser.js';
import { createVimParser, processKey, getMode, getCommandBuffer } from './vim-parser.js';
import { executeCommand } from './command-executor.js';
import { updateCombat } from './combat-manager.js';
import type { Point } from './path-manager.js';
import { expandWaypoints } from './path-manager.js';
import { getEnemyStats } from './enemy-stats.js';

export type StageConfig = {
	readonly name: string;
	readonly gridLayout: CellType[][];
	readonly waypoints: Point[];
	readonly waves: WaveDefinition[];
	readonly startingGold: number;
	readonly startingLives: number;
};

export type Game = {
	state: GameState;
	grid: Grid;
	enemies: EnemyManager;
	waves: WaveManager;
	parser: VimParser;
	stageConfig: StageConfig;
};

export function createGame(config: StageConfig): Game {
	const path = expandWaypoints(config.waypoints);
	const grid = createGrid(config.gridLayout);

	const state: GameState = {
		mode: GAME_MODES.normal,
		phase: GAME_PHASES.planning,
		cursor: { x: 0, y: 0 },
		gold: config.startingGold,
		lives: config.startingLives,
		currentWave: 1,
		totalWaves: config.waves.length,
		currentStage: 1,
		keystrokeCount: 0,
		commandBuffer: '',
		message: '',
		selectedTowerType: 'arrow'
	};

	return {
		state,
		grid,
		enemies: createEnemyManager(path),
		waves: createWaveManager(config.waves),
		parser: createVimParser(),
		stageConfig: config
	};
}

/**
 * Handle a keyboard event. Feeds the key through VIM parser → command executor.
 * Returns the status bar message (empty string if none).
 */
export function handleKeyPress(game: Game, key: string): string {
	const command = processKey(game.parser, key);

	// Sync parser mode to game state
	game.state.mode = getMode(game.parser);
	game.state.commandBuffer = getCommandBuffer(game.parser);

	if (!command) return game.state.message;

	// Capture phase before command execution
	const phaseBefore = game.state.phase;

	const message = executeCommand(command, game.state, game.grid);
	game.state.message = message;

	// Sync mode back from state (executor may change it)
	game.parser.mode = game.state.mode;

	// Handle phase transition triggered by commands (e.g., :w starts combat)
	if (phaseBefore === GAME_PHASES.planning && game.state.phase === GAME_PHASES.combat) {
		startWave(game.waves);
	}

	return message;
}

/**
 * Update game simulation by dt seconds.
 * Call this every frame during combat; no-op during planning.
 */
export function updateGame(game: Game, dt: number): void {
	switch (game.state.phase) {
		case GAME_PHASES.combat:
			updateCombatPhase(game, dt);
			break;
		case GAME_PHASES.waveComplete:
			transitionFromWaveComplete(game);
			break;
		default:
			// Planning, stageComplete, gameOver — no simulation
			break;
	}
}

function updateCombatPhase(game: Game, dt: number): void {
	// Spawn enemies from wave manager
	updateWave(game.waves, game.enemies, dt);

	// Move enemies along path
	const moveResult = updateEnemies(game.enemies, dt);

	// Apply damage from towers
	const combatResult = updateCombat(game.grid, game.enemies, dt);

	// Process enemies that reached exit
	for (const enemy of moveResult.reachedExit) {
		const stats = getEnemyStats(enemy.type);
		game.state.lives -= 1;
		game.state.message = `${stats.name} reached the exit! Lives: ${game.state.lives}`;
	}

	// Collect gold from kills
	game.state.gold += combatResult.goldEarned;

	// Check game over
	if (game.state.lives <= 0) {
		game.state.phase = GAME_PHASES.gameOver;
		game.state.message = 'Game Over! All lives lost.';
		return;
	}

	// Check wave complete
	if (isWaveComplete(game.waves, game.enemies)) {
		game.state.phase = GAME_PHASES.waveComplete;
	}
}

function transitionFromWaveComplete(game: Game): void {
	advanceWave(game.waves);

	if (isAllWavesComplete(game.waves)) {
		game.state.phase = GAME_PHASES.stageComplete;
		game.state.message = 'Stage Complete!';
	} else {
		// Advance to next wave
		game.state.currentWave = game.waves.currentWave + 1;
		game.state.phase = GAME_PHASES.planning;
		game.state.message = `Wave ${game.state.currentWave}/${game.state.totalWaves} — Place your towers!`;
	}
}

/** Check if the game is in a terminal state (game over or stage complete). */
export function isGameOver(game: Game): boolean {
	return game.state.phase === GAME_PHASES.gameOver || game.state.phase === GAME_PHASES.stageComplete;
}

/** Get the current game phase. */
export function getPhase(game: Game): GamePhase {
	return game.state.phase;
}
