/**
 * VIM parser — pure state machine translating keystrokes into Commands.
 *
 * No DOM dependency. Input is a key string (from KeyboardEvent.key),
 * output is a Command or null (if key is consumed but no command yet,
 * e.g., first digit of a count prefix or first g of gg).
 *
 * State: current mode, count buffer, pending key (for multi-key sequences),
 * command buffer (for : command mode).
 */

import type { Command, GameMode, TowerType } from '$lib/types/game.js';
import { GAME_MODES, TOWER_TYPES } from '$lib/types/game.js';

export type VimParser = {
	mode: GameMode;
	countBuffer: number;
	pendingKey: string | null;
	commandBuffer: string;
};

export function createVimParser(): VimParser {
	return {
		mode: GAME_MODES.normal,
		countBuffer: 0,
		pendingKey: null,
		commandBuffer: ''
	};
}

export function getMode(parser: VimParser): GameMode {
	return parser.mode;
}

export function getCommandBuffer(parser: VimParser): string {
	return parser.commandBuffer;
}

/** Reset internal parsing state (count, pending key) without changing mode */
function resetParsing(parser: VimParser): void {
	parser.countBuffer = 0;
	parser.pendingKey = null;
}

/** Get the accumulated count, defaulting to 1 if no count was entered */
function consumeCount(parser: VimParser): number {
	const count = parser.countBuffer > 0 ? parser.countBuffer : 1;
	parser.countBuffer = 0;
	return count;
}

export function processKey(parser: VimParser, key: string): Command | null {
	switch (parser.mode) {
		case 'normal':
			return processNormalMode(parser, key);
		case 'insert':
			return processInsertMode(parser, key);
		case 'command':
			return processCommandMode(parser, key);
		case 'visual':
			return processVisualMode(parser, key);
	}
}

// ─── Normal Mode ─────────────────────────────────────────────

const INSERT_VARIANTS = new Set(['i', 'a', 'o', 'O']);

const TOWER_KEY_MAP: Record<string, TowerType> = {
	'1': TOWER_TYPES.arrow,
	'2': TOWER_TYPES.cannon,
	'3': TOWER_TYPES.frost,
	'4': TOWER_TYPES.lightning
};

function processNormalMode(parser: VimParser, key: string): Command | null {
	// Handle pending multi-key sequences (gg)
	if (parser.pendingKey === 'g') {
		parser.pendingKey = null;
		if (key === 'g') {
			resetParsing(parser);
			return { type: 'jump_grid_start' };
		}
		// g followed by something else: discard g, process the new key
		return processNormalMode(parser, key);
	}

	// Escape: clear any pending state
	if (key === 'Escape') {
		resetParsing(parser);
		return null;
	}

	// Count prefix: digits 1-9 start a count, 0 after digits continues it
	if (key >= '1' && key <= '9') {
		parser.countBuffer = parser.countBuffer * 10 + parseInt(key, 10);
		return null;
	}
	if (key === '0' && parser.countBuffer > 0) {
		parser.countBuffer = parser.countBuffer * 10;
		return null;
	}

	// Motions
	const count = consumeCount(parser);

	switch (key) {
		// Basic motions
		case 'h':
			return { type: 'move_cursor', dx: -1, dy: 0, count };
		case 'j':
			return { type: 'move_cursor', dx: 0, dy: 1, count };
		case 'k':
			return { type: 'move_cursor', dx: 0, dy: -1, count };
		case 'l':
			return { type: 'move_cursor', dx: 1, dy: 0, count };

		// Word motions (tower jumps)
		case 'w':
			return { type: 'jump_next_tower' };
		case 'b':
			return { type: 'jump_prev_tower' };

		// Line motions
		case '0':
			return { type: 'jump_row_start' };
		case '$':
			return { type: 'jump_row_end' };
		case 'e':
			return { type: 'jump_row_last_tower' };

		// Global motions
		case 'g':
			parser.pendingKey = 'g';
			return null;
		case 'G':
			return { type: 'jump_grid_end' };

		// Actions
		case 'x':
			return { type: 'quick_sell_tower' };

		// Mode switches
		case ':':
			parser.mode = GAME_MODES.command;
			parser.commandBuffer = '';
			return { type: 'enter_command_mode' };
		case 'v':
			return { type: 'enter_visual_mode' };
		default:
			break;
	}

	// Insert mode variants
	if (INSERT_VARIANTS.has(key)) {
		parser.mode = GAME_MODES.insert;
		return { type: 'enter_insert_mode', variant: key as 'i' | 'a' | 'o' | 'O' };
	}

	return null;
}

// ─── Insert Mode ─────────────────────────────────────────────

function processInsertMode(parser: VimParser, key: string): Command | null {
	// Escape: back to normal
	if (key === 'Escape') {
		parser.mode = GAME_MODES.normal;
		return { type: 'enter_normal_mode' };
	}

	// Tower placement (1-4)
	const towerType = TOWER_KEY_MAP[key];
	if (towerType) {
		return { type: 'place_tower', towerType };
	}

	// Movement (h/j/k/l stay in insert mode)
	switch (key) {
		case 'h':
			return { type: 'move_cursor', dx: -1, dy: 0, count: 1 };
		case 'j':
			return { type: 'move_cursor', dx: 0, dy: 1, count: 1 };
		case 'k':
			return { type: 'move_cursor', dx: 0, dy: -1, count: 1 };
		case 'l':
			return { type: 'move_cursor', dx: 1, dy: 0, count: 1 };
	}

	return null;
}

// ─── Command Mode ────────────────────────────────────────────

function processCommandMode(parser: VimParser, key: string): Command | null {
	// Escape: cancel
	if (key === 'Escape') {
		parser.mode = GAME_MODES.normal;
		parser.commandBuffer = '';
		return { type: 'cancel_command' };
	}

	// Enter: execute
	if (key === 'Enter') {
		const command = parser.commandBuffer;
		parser.mode = GAME_MODES.normal;
		parser.commandBuffer = '';
		return { type: 'execute_command', command };
	}

	// Backspace
	if (key === 'Backspace') {
		if (parser.commandBuffer.length === 0) {
			parser.mode = GAME_MODES.normal;
			return { type: 'cancel_command' };
		}
		parser.commandBuffer = parser.commandBuffer.slice(0, -1);
		return null;
	}

	// Accumulate printable characters
	if (key.length === 1) {
		parser.commandBuffer += key;
	}

	return null;
}

// ─── Visual Mode (stub) ─────────────────────────────────────

function processVisualMode(parser: VimParser, key: string): Command | null {
	if (key === 'Escape') {
		parser.mode = GAME_MODES.normal;
		return { type: 'enter_normal_mode' };
	}
	return null;
}
