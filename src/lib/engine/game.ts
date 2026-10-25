/**
 * Game loop — wires all subsystems together.
 *
 * Manages the full lifecycle: create → handleKey → update → (phase transitions).
 * The Game object holds all mutable subsystem state as a single source of truth.
 */

import type { GameState, GamePhase, CellType, TowerType, CombatEffect } from '$lib/types/game.js';
import { GAME_MODES, GAME_PHASES } from '$lib/types/game.js';
import type { Grid } from './grid.js';
import { createGrid } from './grid.js';
import type { EnemyManager } from './enemy-manager.js';
import { createEnemyManager, updateEnemies } from './enemy-manager.js';
import type { WaveManager, WaveDefinition } from './wave-manager.js';
import { createWaveManager, startWave, updateWave, isWaveComplete, advanceWave, isAllWavesComplete } from './wave-manager.js';
import type { VimParser } from './vim-parser.js';
import { createVimParser, processKey, getMode, getCommandBuffer, getPendingKeys } from './vim-parser.js';
import { executeCommand } from './command-executor.js';
import { updateCombat } from './combat-manager.js';
import type { Point } from './path-manager.js';
import { expandWaypoints } from './path-manager.js';
import { getEnemyStats } from './enemy-stats.js';
import type { TutorialManager } from './tutorial.js';
import { createTutorial, checkTutorialProgress } from './tutorial.js';
import type { TutorialStep } from '$lib/stages/stage-data.js';

export type StageConfig = {
	readonly name: string;
	readonly gridLayout: CellType[][];
	readonly waypoints: Point[];
	readonly waves: WaveDefinition[];
	readonly startingGold: number;
	readonly startingLives: number;
	readonly availableTowers?: readonly TowerType[];
	readonly tutorialSteps?: TutorialStep[] | null;
	readonly introText?: string | null;
	readonly parKeystrokes?: number;
};

/** How long combat flashes stay on screen, in seconds */
const SHOT_FLASH_SECONDS = 0.15;
const LEAK_FLASH_SECONDS = 0.6;

export type Game = {
	state: GameState;
	grid: Grid;
	enemies: EnemyManager;
	waves: WaveManager;
	parser: VimParser;
	tutorial: TutorialManager;
	stageConfig: StageConfig;
	/** Short-lived hit and leak flashes for the renderer */
	effects: CombatEffect[];
};

export function createGame(config: StageConfig): Game {
	const path = expandWaypoints(config.waypoints);
	const grid = createGrid(config.gridLayout);

	const tutorial = createTutorial(config.tutorialSteps ?? null);
	const introMessage = config.introText ?? (tutorial.active ? tutorial.message : '');

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
		message: introMessage,
		selectedTowerType: 'arrow',
		availableTowers: config.availableTowers ?? ['arrow', 'cannon', 'frost', 'lightning'],
		helpOpen: false
	};

	return {
		state,
		grid,
		enemies: createEnemyManager(path),
		waves: createWaveManager(config.waves),
		parser: createVimParser(),
		tutorial,
		stageConfig: config,
		effects: []
	};
}

/**
 * Handle a keyboard event. Feeds the key through VIM parser → command executor.
 * Returns the status bar message (empty string if none).
 */
export function handleKeyPress(game: Game, key: string): string {
	// Any key closes the help screen without doing anything else
	if (game.state.helpOpen) {
		game.state.helpOpen = false;
		game.state.message = '';
		return '';
	}

	const modeBefore = game.parser.mode;
	const command = processKey(game.parser, key);

	// Sync parser mode to game state
	game.state.mode = getMode(game.parser);
	game.state.commandBuffer = getCommandBuffer(game.parser);

	if (!command) {
		if (isUnknownKey(game, key, modeBefore)) {
			game.state.message = unknownKeyMessage(key, modeBefore);
		}
		return game.state.message;
	}

	// Capture phase before command execution
	const phaseBefore = game.state.phase;

	const message = executeCommand(command, game.state, game.grid);
	const failed = message.startsWith('E:');

	// Advance tutorial only when the command worked (e.g. a tower was really placed)
	if (game.tutorial.active && !failed) {
		checkTutorialProgress(game.tutorial, command);
	}

	// Errors always show, so the player learns why something failed.
	// Otherwise the tutorial message takes priority over the command message.
	const tutorialMessage = game.tutorial.active ? game.tutorial.message : '';
	game.state.message = !failed && tutorialMessage ? tutorialMessage : message;

	// Sync mode back from state (executor may change it)
	game.parser.mode = game.state.mode;

	// Handle phase transition triggered by commands (e.g., :w starts combat)
	if (phaseBefore === GAME_PHASES.planning && game.state.phase === GAME_PHASES.combat) {
		startWave(game.waves);
	}

	return game.state.message;
}

/** A printable key that did nothing and isn't the start of a longer command */
function isUnknownKey(game: Game, key: string, modeBefore: string): boolean {
	if (key.length !== 1 || key === ' ') return false;
	if (modeBefore !== GAME_MODES.normal && modeBefore !== GAME_MODES.insert) return false;
	return getPendingKeys(game.parser) === '';
}

function unknownKeyMessage(key: string, mode: string): string {
	if (mode === GAME_MODES.insert) {
		return `E: ${key} does nothing in INSERT mode. Press 1-4 to build, Esc to leave.`;
	}
	return `E: ${key} is not a command here. Type :help for the key list.`;
}

/** Keys typed so far for an unfinished command, for the status bar */
export function getPendingInput(game: Game): string {
	return getPendingKeys(game.parser);
}

/**
 * Update game simulation by dt seconds.
 * Call this every frame during combat; no-op during planning.
 */
export function updateGame(game: Game, dt: number): void {
	// The game waits while the player reads :help
	if (game.state.helpOpen) return;

	updateEffects(game, dt);

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

	for (const shot of combatResult.shots) {
		game.effects.push({ kind: 'shot', ...shot, ttl: SHOT_FLASH_SECONDS });
	}

	// Process enemies that reached exit
	const exit = game.enemies.path[game.enemies.path.length - 1];
	for (const enemy of moveResult.reachedExit) {
		const stats = getEnemyStats(enemy.type);
		game.state.lives -= 1;
		game.state.message = `E: ${stats.name} got through! ${game.state.lives} lives left.`;
		if (exit) game.effects.push({ kind: 'leak', x: exit.x, y: exit.y, ttl: LEAK_FLASH_SECONDS });
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

function updateEffects(game: Game, dt: number): void {
	for (const effect of game.effects) effect.ttl -= dt;
	game.effects = game.effects.filter((e) => e.ttl > 0);
}

/** True while an enemy has just reached the exit (drives the lives flash) */
export function isLeakFlashing(game: Game): boolean {
	return game.effects.some((e) => e.kind === 'leak');
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
