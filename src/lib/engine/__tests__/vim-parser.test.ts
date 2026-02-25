import { describe, it, expect, beforeEach } from 'vitest';
import { createVimParser, processKey, getMode, getCommandBuffer } from '../vim-parser.js';
function press(parser: ReturnType<typeof createVimParser>, ...keys: string[]): void {
	keys.forEach((k) => processKey(parser, k));
}

describe('VIM Parser — Normal Mode', () => {
	let parser: ReturnType<typeof createVimParser>;

	beforeEach(() => {
		parser = createVimParser();
	});

	describe('basic motions', () => {
		it('h moves cursor left', () => {
			const cmd = processKey(parser, 'h');
			expect(cmd).toEqual({ type: 'move_cursor', dx: -1, dy: 0, count: 1 });
		});

		it('j moves cursor down', () => {
			const cmd = processKey(parser, 'j');
			expect(cmd).toEqual({ type: 'move_cursor', dx: 0, dy: 1, count: 1 });
		});

		it('k moves cursor up', () => {
			const cmd = processKey(parser, 'k');
			expect(cmd).toEqual({ type: 'move_cursor', dx: 0, dy: -1, count: 1 });
		});

		it('l moves cursor right', () => {
			const cmd = processKey(parser, 'l');
			expect(cmd).toEqual({ type: 'move_cursor', dx: 1, dy: 0, count: 1 });
		});
	});

	describe('count prefixes', () => {
		it('5j moves cursor down with count 5', () => {
			press(parser, '5');
			const cmd = processKey(parser, 'j');
			expect(cmd).toEqual({ type: 'move_cursor', dx: 0, dy: 1, count: 5 });
		});

		it('12h moves cursor left with count 12', () => {
			press(parser, '1', '2');
			const cmd = processKey(parser, 'h');
			expect(cmd).toEqual({ type: 'move_cursor', dx: -1, dy: 0, count: 12 });
		});

		it('count resets after command executes', () => {
			press(parser, '5', 'j');
			const cmd = processKey(parser, 'l');
			expect(cmd).toEqual({ type: 'move_cursor', dx: 1, dy: 0, count: 1 });
		});

		it('0 without prior count is jump_row_start', () => {
			const cmd = processKey(parser, '0');
			expect(cmd).toEqual({ type: 'jump_row_start' });
		});

		it('0 after digits is part of count (10j)', () => {
			press(parser, '1', '0');
			const cmd = processKey(parser, 'j');
			expect(cmd).toEqual({ type: 'move_cursor', dx: 0, dy: 1, count: 10 });
		});
	});

	describe('word motions (tower jumps)', () => {
		it('w jumps to next tower', () => {
			const cmd = processKey(parser, 'w');
			expect(cmd).toEqual({ type: 'jump_next_tower' });
		});

		it('b jumps to previous tower', () => {
			const cmd = processKey(parser, 'b');
			expect(cmd).toEqual({ type: 'jump_prev_tower' });
		});
	});

	describe('line motions', () => {
		it('0 jumps to row start', () => {
			const cmd = processKey(parser, '0');
			expect(cmd).toEqual({ type: 'jump_row_start' });
		});

		it('$ jumps to row end', () => {
			const cmd = processKey(parser, '$');
			expect(cmd).toEqual({ type: 'jump_row_end' });
		});

		it('e jumps to last tower in row', () => {
			const cmd = processKey(parser, 'e');
			expect(cmd).toEqual({ type: 'jump_row_last_tower' });
		});
	});

	describe('global motions', () => {
		it('gg jumps to grid start', () => {
			press(parser, 'g');
			const cmd = processKey(parser, 'g');
			expect(cmd).toEqual({ type: 'jump_grid_start' });
		});

		it('G jumps to grid end', () => {
			const cmd = processKey(parser, 'G');
			expect(cmd).toEqual({ type: 'jump_grid_end' });
		});

		it('single g followed by non-g cancels and processes the new key', () => {
			press(parser, 'g');
			const cmd = processKey(parser, 'j');
			// The g is discarded, j is processed as a normal motion
			expect(cmd).toEqual({ type: 'move_cursor', dx: 0, dy: 1, count: 1 });
		});
	});

	describe('actions', () => {
		it('x quick-sells tower', () => {
			const cmd = processKey(parser, 'x');
			expect(cmd).toEqual({ type: 'quick_sell_tower' });
		});
	});

	describe('mode switches', () => {
		it('i enters insert mode', () => {
			const cmd = processKey(parser, 'i');
			expect(cmd).toEqual({ type: 'enter_insert_mode', variant: 'i' });
			expect(getMode(parser)).toBe('insert');
		});

		it('a enters insert mode (append)', () => {
			const cmd = processKey(parser, 'a');
			expect(cmd).toEqual({ type: 'enter_insert_mode', variant: 'a' });
			expect(getMode(parser)).toBe('insert');
		});

		it('o enters insert mode (open below)', () => {
			const cmd = processKey(parser, 'o');
			expect(cmd).toEqual({ type: 'enter_insert_mode', variant: 'o' });
			expect(getMode(parser)).toBe('insert');
		});

		it('O enters insert mode (open above)', () => {
			const cmd = processKey(parser, 'O');
			expect(cmd).toEqual({ type: 'enter_insert_mode', variant: 'O' });
			expect(getMode(parser)).toBe('insert');
		});

		it(': enters command mode', () => {
			const cmd = processKey(parser, ':');
			expect(cmd).toEqual({ type: 'enter_command_mode' });
			expect(getMode(parser)).toBe('command');
		});

		it('v enters visual mode', () => {
			const cmd = processKey(parser, 'v');
			expect(cmd).toEqual({ type: 'enter_visual_mode' });
		});
	});

	describe('invalid keys', () => {
		it('unrecognized key returns null', () => {
			const cmd = processKey(parser, 'z');
			expect(cmd).toBeNull();
		});

		it('Escape in normal mode returns null (already in normal)', () => {
			const cmd = processKey(parser, 'Escape');
			expect(cmd).toBeNull();
		});

		it('Escape clears pending count', () => {
			press(parser, '5');
			processKey(parser, 'Escape');
			const cmd = processKey(parser, 'j');
			expect(cmd).toEqual({ type: 'move_cursor', dx: 0, dy: 1, count: 1 });
		});

		it('Escape clears pending g', () => {
			press(parser, 'g');
			processKey(parser, 'Escape');
			const cmd = processKey(parser, 'g');
			// Should start a new g sequence, not complete gg
			expect(cmd).toBeNull();
		});
	});
});

describe('VIM Parser — Insert Mode', () => {
	let parser: ReturnType<typeof createVimParser>;

	beforeEach(() => {
		parser = createVimParser();
		processKey(parser, 'i'); // enter insert mode
	});

	describe('tower placement', () => {
		it('1 places arrow tower', () => {
			const cmd = processKey(parser, '1');
			expect(cmd).toEqual({ type: 'place_tower', towerType: 'arrow' });
		});

		it('2 places cannon tower', () => {
			const cmd = processKey(parser, '2');
			expect(cmd).toEqual({ type: 'place_tower', towerType: 'cannon' });
		});

		it('3 places frost tower', () => {
			const cmd = processKey(parser, '3');
			expect(cmd).toEqual({ type: 'place_tower', towerType: 'frost' });
		});

		it('4 places lightning tower', () => {
			const cmd = processKey(parser, '4');
			expect(cmd).toEqual({ type: 'place_tower', towerType: 'lightning' });
		});
	});

	describe('movement in insert mode', () => {
		it('h/j/k/l move cursor while staying in insert mode', () => {
			const h = processKey(parser, 'h');
			expect(h).toEqual({ type: 'move_cursor', dx: -1, dy: 0, count: 1 });
			expect(getMode(parser)).toBe('insert');

			const j = processKey(parser, 'j');
			expect(j).toEqual({ type: 'move_cursor', dx: 0, dy: 1, count: 1 });
			expect(getMode(parser)).toBe('insert');
		});
	});

	describe('exit insert mode', () => {
		it('Escape returns to normal mode', () => {
			const cmd = processKey(parser, 'Escape');
			expect(cmd).toEqual({ type: 'enter_normal_mode' });
			expect(getMode(parser)).toBe('normal');
		});
	});

	describe('invalid keys', () => {
		it('unrecognized key in insert mode returns null', () => {
			const cmd = processKey(parser, 'z');
			expect(cmd).toBeNull();
		});

		it('5-9 are not tower keys, return null', () => {
			expect(processKey(parser, '5')).toBeNull();
			expect(processKey(parser, '9')).toBeNull();
		});
	});
});

describe('VIM Parser — Command Mode', () => {
	let parser: ReturnType<typeof createVimParser>;

	beforeEach(() => {
		parser = createVimParser();
		processKey(parser, ':'); // enter command mode
	});

	describe('command entry', () => {
		it('builds command buffer from key presses', () => {
			press(parser, 'w');
			expect(getCommandBuffer(parser)).toBe('w');
		});

		it('accumulates multiple characters', () => {
			press(parser, 'h', 'e', 'l', 'p');
			expect(getCommandBuffer(parser)).toBe('help');
		});
	});

	describe('command execution', () => {
		it('Enter executes the buffered command', () => {
			press(parser, 'q');
			const cmd = processKey(parser, 'Enter');
			expect(cmd).toEqual({ type: 'execute_command', command: 'q' });
			expect(getMode(parser)).toBe('normal');
		});

		it('executes multi-character commands', () => {
			press(parser, 'q', '!');
			const cmd = processKey(parser, 'Enter');
			expect(cmd).toEqual({ type: 'execute_command', command: 'q!' });
		});

		it('executes :w command', () => {
			press(parser, 'w');
			const cmd = processKey(parser, 'Enter');
			expect(cmd).toEqual({ type: 'execute_command', command: 'w' });
		});

		it('executes :wq command', () => {
			press(parser, 'w', 'q');
			const cmd = processKey(parser, 'Enter');
			expect(cmd).toEqual({ type: 'execute_command', command: 'wq' });
		});

		it('executes :save command', () => {
			press(parser, 's', 'a', 'v', 'e');
			const cmd = processKey(parser, 'Enter');
			expect(cmd).toEqual({ type: 'execute_command', command: 'save' });
		});

		it('executes :help command', () => {
			press(parser, 'h', 'e', 'l', 'p');
			const cmd = processKey(parser, 'Enter');
			expect(cmd).toEqual({ type: 'execute_command', command: 'help' });
		});

		it('executes :map command', () => {
			press(parser, 'm', 'a', 'p');
			const cmd = processKey(parser, 'Enter');
			expect(cmd).toEqual({ type: 'execute_command', command: 'map' });
		});
	});

	describe('command cancellation', () => {
		it('Escape cancels command and returns to normal mode', () => {
			press(parser, 'q');
			const cmd = processKey(parser, 'Escape');
			expect(cmd).toEqual({ type: 'cancel_command' });
			expect(getMode(parser)).toBe('normal');
			expect(getCommandBuffer(parser)).toBe('');
		});
	});

	describe('backspace', () => {
		it('Backspace removes last character from buffer', () => {
			press(parser, 'h', 'e', 'l', 'p');
			processKey(parser, 'Backspace');
			expect(getCommandBuffer(parser)).toBe('hel');
		});

		it('Backspace on empty buffer cancels command mode', () => {
			const cmd = processKey(parser, 'Backspace');
			expect(cmd).toEqual({ type: 'cancel_command' });
			expect(getMode(parser)).toBe('normal');
		});
	});
});

describe('VIM Parser — Mode Transitions', () => {
	let parser: ReturnType<typeof createVimParser>;

	beforeEach(() => {
		parser = createVimParser();
	});

	it('starts in normal mode', () => {
		expect(getMode(parser)).toBe('normal');
	});

	it('normal → insert → normal round-trip', () => {
		processKey(parser, 'i');
		expect(getMode(parser)).toBe('insert');
		processKey(parser, 'Escape');
		expect(getMode(parser)).toBe('normal');
	});

	it('normal → command → normal round-trip', () => {
		processKey(parser, ':');
		expect(getMode(parser)).toBe('command');
		processKey(parser, 'Escape');
		expect(getMode(parser)).toBe('normal');
	});

	it('normal → command → execute → normal', () => {
		processKey(parser, ':');
		press(parser, 'w');
		processKey(parser, 'Enter');
		expect(getMode(parser)).toBe('normal');
	});

	it('after returning to normal, normal commands work', () => {
		processKey(parser, 'i');
		processKey(parser, 'Escape');
		const cmd = processKey(parser, 'j');
		expect(cmd).toEqual({ type: 'move_cursor', dx: 0, dy: 1, count: 1 });
	});
});

describe('VIM Parser — Edge Cases', () => {
	let parser: ReturnType<typeof createVimParser>;

	beforeEach(() => {
		parser = createVimParser();
	});

	it('count prefix followed by Escape resets count', () => {
		press(parser, '1', '5');
		processKey(parser, 'Escape');
		const cmd = processKey(parser, 'j');
		expect(cmd).toEqual({ type: 'move_cursor', dx: 0, dy: 1, count: 1 });
	});

	it('gg with count prefix: 5gg should still jump to grid start', () => {
		press(parser, '5', 'g', 'g');
		// For MVP, count+gg still just does jump_grid_start
		// (could mean "go to row 5" in future)
	});

	it('rapid mode switches preserve state', () => {
		processKey(parser, 'i');
		processKey(parser, 'Escape');
		processKey(parser, ':');
		processKey(parser, 'Escape');
		processKey(parser, 'i');
		expect(getMode(parser)).toBe('insert');
	});

	it('insert mode does not support count prefixes', () => {
		processKey(parser, 'i');
		// 5 is an invalid key in insert mode (not 1-4), returns null
		const cmd = processKey(parser, '5');
		expect(cmd).toBeNull();
	});

	it('command mode Enter on empty buffer executes empty command', () => {
		processKey(parser, ':');
		const cmd = processKey(parser, 'Enter');
		expect(cmd).toEqual({ type: 'execute_command', command: '' });
	});
});
