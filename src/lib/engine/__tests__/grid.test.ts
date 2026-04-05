import { describe, it, expect } from 'vitest';
import { createGrid, placeTower, removeTower, getTower, getCellType, getNextTower, getPrevTower, getTowersInRect } from '../grid.js';
import { CELL_TYPES, TOWER_TYPES } from '$lib/types/game.js';
import type { CellType } from '$lib/types/game.js';

/**
 * Test grid layout (5x4):
 *
 *   0 1 2 3 4
 * 0 . . . . .   (. = empty)
 * 1 S P P P E   (S = spawn, P = path, E = exit)
 * 2 . . . . .
 * 3 . . . . .
 */
function makeTestLayout(): CellType[][] {
	const grid: CellType[][] = [];
	for (let y = 0; y < 4; y++) {
		const row: CellType[] = [];
		for (let x = 0; x < 5; x++) {
			if (y === 1) {
				if (x === 0) row.push(CELL_TYPES.spawn);
				else if (x === 4) row.push(CELL_TYPES.exit);
				else row.push(CELL_TYPES.path);
			} else {
				row.push(CELL_TYPES.empty);
			}
		}
		grid.push(row);
	}
	return grid;
}

describe('createGrid', () => {
	it('creates a grid with correct dimensions', () => {
		const grid = createGrid(makeTestLayout());
		expect(grid.width).toBe(5);
		expect(grid.height).toBe(4);
	});
});

describe('getCellType', () => {
	it('returns correct cell types from layout', () => {
		const grid = createGrid(makeTestLayout());
		expect(getCellType(grid, 0, 0)).toBe('empty');
		expect(getCellType(grid, 0, 1)).toBe('spawn');
		expect(getCellType(grid, 1, 1)).toBe('path');
		expect(getCellType(grid, 4, 1)).toBe('exit');
	});

	it('returns undefined for out-of-bounds coordinates', () => {
		const grid = createGrid(makeTestLayout());
		expect(getCellType(grid, -1, 0)).toBeUndefined();
		expect(getCellType(grid, 5, 0)).toBeUndefined();
		expect(getCellType(grid, 0, -1)).toBeUndefined();
		expect(getCellType(grid, 0, 4)).toBeUndefined();
	});
});

describe('placeTower', () => {
	it('places a tower on an empty cell', () => {
		const grid = createGrid(makeTestLayout());
		const result = placeTower(grid, 2, 0, TOWER_TYPES.arrow);
		expect(result.success).toBe(true);
		expect(getTower(grid, 2, 0)).toBeDefined();
		expect(getTower(grid, 2, 0)?.type).toBe('arrow');
	});

	it('rejects placement on path cells', () => {
		const grid = createGrid(makeTestLayout());
		const result = placeTower(grid, 1, 1, TOWER_TYPES.arrow);
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toContain('path');
		expect(getTower(grid, 1, 1)).toBeUndefined();
	});

	it('rejects placement on spawn cells', () => {
		const grid = createGrid(makeTestLayout());
		const result = placeTower(grid, 0, 1, TOWER_TYPES.arrow);
		expect(result.success).toBe(false);
	});

	it('rejects placement on exit cells', () => {
		const grid = createGrid(makeTestLayout());
		const result = placeTower(grid, 4, 1, TOWER_TYPES.arrow);
		expect(result.success).toBe(false);
	});

	it('rejects placement on occupied cells', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 2, 0, TOWER_TYPES.arrow);
		const result = placeTower(grid, 2, 0, TOWER_TYPES.cannon);
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toContain('occupied');
	});

	it('rejects placement out of bounds', () => {
		const grid = createGrid(makeTestLayout());
		const result = placeTower(grid, 10, 10, TOWER_TYPES.arrow);
		expect(result.success).toBe(false);
	});

	it('initializes tower with level 1 and zero cooldown', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 0, 0, TOWER_TYPES.frost);
		const tower = getTower(grid, 0, 0);
		expect(tower?.level).toBe(1);
		expect(tower?.cooldownRemaining).toBe(0);
	});
});

describe('removeTower', () => {
	it('removes an existing tower', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 2, 0, TOWER_TYPES.arrow);
		const result = removeTower(grid, 2, 0);
		expect(result.success).toBe(true);
		expect(getTower(grid, 2, 0)).toBeUndefined();
	});

	it('returns the removed tower', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 2, 0, TOWER_TYPES.cannon);
		const result = removeTower(grid, 2, 0);
		expect(result.success).toBe(true);
		if (result.success) expect(result.tower.type).toBe('cannon');
	});

	it('fails when no tower at position', () => {
		const grid = createGrid(makeTestLayout());
		const result = removeTower(grid, 2, 0);
		expect(result.success).toBe(false);
	});
});

describe('getTower', () => {
	it('returns undefined when no tower present', () => {
		const grid = createGrid(makeTestLayout());
		expect(getTower(grid, 0, 0)).toBeUndefined();
	});

	it('returns the tower at position', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 3, 2, TOWER_TYPES.lightning);
		const tower = getTower(grid, 3, 2);
		expect(tower).toBeDefined();
		expect(tower?.type).toBe('lightning');
		expect(tower?.x).toBe(3);
		expect(tower?.y).toBe(2);
	});
});

describe('getNextTower (w motion)', () => {
	it('finds the next tower scanning right then down', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 1, 0, TOWER_TYPES.arrow);
		placeTower(grid, 3, 0, TOWER_TYPES.cannon);
		const next = getNextTower(grid, 0, 0);
		expect(next).toEqual({ x: 1, y: 0 });
	});

	it('wraps to next row when no more towers on current row', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 4, 0, TOWER_TYPES.arrow);
		placeTower(grid, 2, 2, TOWER_TYPES.cannon);
		// From (4,0), next tower scanning right then wrapping is (2,2)
		const next = getNextTower(grid, 4, 0);
		expect(next).toEqual({ x: 2, y: 2 });
	});

	it('returns undefined when no towers exist after cursor', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 1, 0, TOWER_TYPES.arrow);
		const next = getNextTower(grid, 1, 0);
		expect(next).toBeUndefined();
	});

	it('skips the current position', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 2, 0, TOWER_TYPES.arrow);
		placeTower(grid, 4, 0, TOWER_TYPES.cannon);
		const next = getNextTower(grid, 2, 0);
		expect(next).toEqual({ x: 4, y: 0 });
	});
});

describe('getPrevTower (b motion)', () => {
	it('finds the previous tower scanning left then up', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 1, 0, TOWER_TYPES.arrow);
		placeTower(grid, 3, 0, TOWER_TYPES.cannon);
		const prev = getPrevTower(grid, 4, 0);
		expect(prev).toEqual({ x: 3, y: 0 });
	});

	it('wraps to previous row when no towers before on current row', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 3, 0, TOWER_TYPES.arrow);
		placeTower(grid, 0, 2, TOWER_TYPES.cannon);
		const prev = getPrevTower(grid, 0, 2);
		expect(prev).toEqual({ x: 3, y: 0 });
	});

	it('returns undefined when no towers exist before cursor', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 3, 2, TOWER_TYPES.arrow);
		const prev = getPrevTower(grid, 3, 2);
		expect(prev).toBeUndefined();
	});
});

describe('getTowersInRect', () => {
	it('returns all towers within a rectangular area', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 0, 0, TOWER_TYPES.arrow);
		placeTower(grid, 2, 0, TOWER_TYPES.cannon);
		placeTower(grid, 4, 3, TOWER_TYPES.frost);
		const towers = getTowersInRect(grid, 0, 0, 3, 1);
		expect(towers).toHaveLength(2);
		expect(towers.map((t) => t.type)).toContain('arrow');
		expect(towers.map((t) => t.type)).toContain('cannon');
	});

	it('returns empty array when no towers in area', () => {
		const grid = createGrid(makeTestLayout());
		const towers = getTowersInRect(grid, 0, 0, 5, 4);
		expect(towers).toHaveLength(0);
	});
});

describe('Boundary Conditions — getCellType', () => {
	it('returns undefined for negative x coordinate', () => {
		const grid = createGrid(makeTestLayout());
		expect(getCellType(grid, -1, 0)).toBeUndefined();
		expect(getCellType(grid, -100, 0)).toBeUndefined();
	});

	it('returns undefined for negative y coordinate', () => {
		const grid = createGrid(makeTestLayout());
		expect(getCellType(grid, 0, -1)).toBeUndefined();
		expect(getCellType(grid, 0, -100)).toBeUndefined();
	});

	it('returns undefined for x at exact grid width', () => {
		const grid = createGrid(makeTestLayout());
		expect(getCellType(grid, grid.width, 0)).toBeUndefined();
	});

	it('returns undefined for y at exact grid height', () => {
		const grid = createGrid(makeTestLayout());
		expect(getCellType(grid, 0, grid.height)).toBeUndefined();
	});

	it('returns valid cell at last valid coordinates', () => {
		const grid = createGrid(makeTestLayout());
		expect(getCellType(grid, grid.width - 1, grid.height - 1)).toBe('empty');
	});

	it('returns valid cell at (0, 0)', () => {
		const grid = createGrid(makeTestLayout());
		expect(getCellType(grid, 0, 0)).toBe('empty');
	});
});

describe('Boundary Conditions — placeTower', () => {
	it('rejects placement at negative coordinates', () => {
		const grid = createGrid(makeTestLayout());
		expect(placeTower(grid, -1, 0, TOWER_TYPES.arrow).success).toBe(false);
		expect(placeTower(grid, 0, -1, TOWER_TYPES.arrow).success).toBe(false);
		expect(placeTower(grid, -1, -1, TOWER_TYPES.arrow).success).toBe(false);
	});

	it('rejects placement at exact grid width', () => {
		const grid = createGrid(makeTestLayout());
		const result = placeTower(grid, grid.width, 0, TOWER_TYPES.arrow);
		expect(result.success).toBe(false);
	});

	it('rejects placement at exact grid height', () => {
		const grid = createGrid(makeTestLayout());
		const result = placeTower(grid, 0, grid.height, TOWER_TYPES.arrow);
		expect(result.success).toBe(false);
	});

	it('succeeds at last valid coordinates (if empty)', () => {
		const grid = createGrid(makeTestLayout());
		const result = placeTower(grid, grid.width - 1, grid.height - 1, TOWER_TYPES.arrow);
		expect(result.success).toBe(true);
	});
});

describe('Boundary Conditions — getNextTower', () => {
	it('returns undefined when starting from last cell with no towers', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 0, 0, TOWER_TYPES.arrow);
		// Tower at (0,0), searching from (4,3) - the last cell
		const next = getNextTower(grid, grid.width - 1, grid.height - 1);
		expect(next).toBeUndefined();
	});

	it('returns tower at last cell when searching from earlier', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, grid.width - 1, grid.height - 1, TOWER_TYPES.arrow);
		const next = getNextTower(grid, 0, 0);
		expect(next).toEqual({ x: grid.width - 1, y: grid.height - 1 });
	});

	it('wraps to beginning of next row correctly', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 0, 2, TOWER_TYPES.arrow);
		// Search from end of row 0
		const next = getNextTower(grid, grid.width - 1, 0);
		// Should find tower at (0, 2)
		expect(next).toEqual({ x: 0, y: 2 });
	});

	it('handles empty grid', () => {
		const grid = createGrid(makeTestLayout());
		const next = getNextTower(grid, 0, 0);
		expect(next).toBeUndefined();
	});
});

describe('Boundary Conditions — getPrevTower', () => {
	it('returns undefined when starting from first cell with no prior towers', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, grid.width - 1, grid.height - 1, TOWER_TYPES.arrow);
		const prev = getPrevTower(grid, 0, 0);
		expect(prev).toBeUndefined();
	});

	it('returns tower at first cell when searching from later', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 0, 0, TOWER_TYPES.arrow);
		const prev = getPrevTower(grid, grid.width - 1, grid.height - 1);
		expect(prev).toEqual({ x: 0, y: 0 });
	});

	it('wraps to end of previous row correctly', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, grid.width - 1, 0, TOWER_TYPES.arrow);
		// Search from beginning of row 2
		const prev = getPrevTower(grid, 0, 2);
		// Should find tower at (4, 0)
		expect(prev).toEqual({ x: grid.width - 1, y: 0 });
	});

	it('handles empty grid', () => {
		const grid = createGrid(makeTestLayout());
		const prev = getPrevTower(grid, grid.width - 1, grid.height - 1);
		expect(prev).toBeUndefined();
	});
});

describe('Boundary Conditions — getTowersInRect', () => {
	it('handles rect starting at negative coordinates (partial coverage)', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 0, 0, TOWER_TYPES.arrow);
		// Rect from (-2, -2) with size 5x5 should include (0,0)
		const towers = getTowersInRect(grid, -2, -2, 5, 5);
		expect(towers).toHaveLength(1);
		expect(towers[0].type).toBe('arrow');
	});

	it('handles rect extending past grid boundaries', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, grid.width - 1, grid.height - 1, TOWER_TYPES.arrow);
		// Rect from (3, 2) extending past grid
		const towers = getTowersInRect(grid, 3, 2, 10, 10);
		expect(towers).toHaveLength(1);
	});

	it('returns empty for rect completely outside grid (positive)', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 0, 0, TOWER_TYPES.arrow);
		const towers = getTowersInRect(grid, 100, 100, 5, 5);
		expect(towers).toHaveLength(0);
	});

	it('returns empty for rect completely outside grid (negative)', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 0, 0, TOWER_TYPES.arrow);
		const towers = getTowersInRect(grid, -10, -10, 5, 5);
		expect(towers).toHaveLength(0);
	});

	it('handles zero-width rect', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 2, 2, TOWER_TYPES.arrow);
		const towers = getTowersInRect(grid, 2, 2, 0, 5);
		expect(towers).toHaveLength(0);
	});

	it('handles zero-height rect', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 2, 2, TOWER_TYPES.arrow);
		const towers = getTowersInRect(grid, 2, 2, 5, 0);
		expect(towers).toHaveLength(0);
	});

	it('includes tower at exact rect boundary (top-left)', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 2, 2, TOWER_TYPES.arrow);
		const towers = getTowersInRect(grid, 2, 2, 2, 2);
		expect(towers).toHaveLength(1);
	});

	it('excludes tower at exact rect boundary (bottom-right, non-inclusive)', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 4, 3, TOWER_TYPES.arrow);
		// Rect from (2, 2) with size (2, 1) covers x=[2,3], y=2
		const towers = getTowersInRect(grid, 2, 2, 2, 1);
		expect(towers).toHaveLength(0);
	});
});
