/**
 * Core game type definitions.
 * All state modeling uses discriminated unions and const assertions.
 * No classes — plain objects only.
 */

// ─── Cell Types ──────────────────────────────────────────────

export const CELL_TYPES = {
	empty: 'empty',
	path: 'path',
	spawn: 'spawn',
	exit: 'exit'
} as const;

export type CellType = (typeof CELL_TYPES)[keyof typeof CELL_TYPES];

// ─── Tower Types ─────────────────────────────────────────────

export const TOWER_TYPES = {
	arrow: 'arrow',
	cannon: 'cannon',
	frost: 'frost',
	lightning: 'lightning'
} as const;

export type TowerType = (typeof TOWER_TYPES)[keyof typeof TOWER_TYPES];

export type Tower = {
	readonly type: TowerType;
	readonly x: number;
	readonly y: number;
	level: number;
	cooldownRemaining: number;
};

// ─── Enemy Types ─────────────────────────────────────────────

export const ENEMY_TYPES = {
	walker: 'walker',
	runner: 'runner',
	tank: 'tank'
} as const;

export type EnemyType = (typeof ENEMY_TYPES)[keyof typeof ENEMY_TYPES];

export type Enemy = {
	readonly id: number;
	readonly type: EnemyType;
	hp: number;
	maxHp: number;
	pathIndex: number;
	pathProgress: number;
	speed: number;
	slowTimer: number;
	alive: boolean;
};

// ─── Game Modes (mirrors VIM modes) ─────────────────────────

export const GAME_MODES = {
	normal: 'normal',
	insert: 'insert',
	command: 'command',
	visual: 'visual'
} as const;

export type GameMode = (typeof GAME_MODES)[keyof typeof GAME_MODES];

// ─── Game Phases ─────────────────────────────────────────────

export const GAME_PHASES = {
	planning: 'planning',
	combat: 'combat',
	waveComplete: 'wave_complete',
	stageComplete: 'stage_complete',
	gameOver: 'game_over'
} as const;

export type GamePhase = (typeof GAME_PHASES)[keyof typeof GAME_PHASES];

// ─── Commands (output of VIM parser) ─────────────────────────

export type Command =
	| { type: 'move_cursor'; dx: number; dy: number; count: number }
	| { type: 'jump_next_tower' }
	| { type: 'jump_prev_tower' }
	| { type: 'jump_row_start' }
	| { type: 'jump_row_end' }
	| { type: 'jump_row_last_tower' }
	| { type: 'jump_grid_start' }
	| { type: 'jump_grid_end' }
	| { type: 'quick_sell_tower' }
	| { type: 'enter_insert_mode'; variant: 'i' | 'a' | 'o' | 'O' }
	| { type: 'enter_normal_mode' }
	| { type: 'enter_command_mode' }
	| { type: 'enter_visual_mode' }
	| { type: 'place_tower'; towerType: TowerType }
	| { type: 'execute_command'; command: string }
	| { type: 'cancel_command' };

// ─── Cursor ──────────────────────────────────────────────────

export type Cursor = {
	x: number;
	y: number;
};

// ─── Game State ──────────────────────────────────────────────

export type GameState = {
	mode: GameMode;
	phase: GamePhase;
	cursor: Cursor;
	gold: number;
	lives: number;
	currentWave: number;
	totalWaves: number;
	currentStage: number;
	keystrokeCount: number;
	commandBuffer: string;
	message: string;
	selectedTowerType: TowerType;
};
