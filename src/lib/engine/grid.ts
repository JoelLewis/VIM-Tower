/**
 * Game grid — manages cell types and tower placement.
 *
 * The grid is initialized from a 2D CellType layout (provided by stage data).
 * Towers are stored in a Map keyed by "x,y" for O(1) lookup.
 */

import type { CellType, Tower, TowerType } from '$lib/types/game.js';
import { CELL_TYPES } from '$lib/types/game.js';

export type Grid = {
	readonly width: number;
	readonly height: number;
	readonly cells: CellType[][];
	readonly towers: Map<string, Tower>;
};

export type PlaceResult =
	| { success: true }
	| { success: false; error: string };

export type RemoveResult =
	| { success: true; tower: Tower }
	| { success: false; error: string };

function towerKey(x: number, y: number): string {
	return `${x},${y}`;
}

/** Create a grid from a 2D cell type layout. Layout is rows[y][x]. */
export function createGrid(layout: CellType[][]): Grid {
	const height = layout.length;
	const width = height > 0 ? layout[0].length : 0;
	return {
		width,
		height,
		cells: layout,
		towers: new Map()
	};
}

/** Get the cell type at (x, y). Returns undefined if out of bounds. */
export function getCellType(grid: Grid, x: number, y: number): CellType | undefined {
	if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return undefined;
	return grid.cells[y][x];
}

/** Place a tower at (x, y). Only succeeds on empty, unoccupied cells. */
export function placeTower(grid: Grid, x: number, y: number, type: TowerType): PlaceResult {
	const cellType = getCellType(grid, x, y);
	if (cellType === undefined) {
		return { success: false, error: 'Out of bounds' };
	}
	if (cellType === CELL_TYPES.path) {
		return { success: false, error: 'Cannot place on path cell' };
	}
	if (cellType === CELL_TYPES.spawn) {
		return { success: false, error: 'Cannot place on spawn cell' };
	}
	if (cellType === CELL_TYPES.exit) {
		return { success: false, error: 'Cannot place on exit cell' };
	}
	const key = towerKey(x, y);
	if (grid.towers.has(key)) {
		return { success: false, error: 'Cell is occupied by another tower' };
	}

	const tower: Tower = {
		type,
		x,
		y,
		level: 1,
		cooldownRemaining: 0
	};
	grid.towers.set(key, tower);
	return { success: true };
}

/** Remove the tower at (x, y). Returns the removed tower on success. */
export function removeTower(grid: Grid, x: number, y: number): RemoveResult {
	const key = towerKey(x, y);
	const tower = grid.towers.get(key);
	if (!tower) {
		return { success: false, error: 'No tower at this position' };
	}
	grid.towers.delete(key);
	return { success: true, tower };
}

/** Get the tower at (x, y), or undefined if none. */
export function getTower(grid: Grid, x: number, y: number): Tower | undefined {
	return grid.towers.get(towerKey(x, y));
}

/**
 * Find the next tower after (x, y), scanning right then wrapping to next rows.
 * Used for the `w` (word/tower jump) motion.
 * Skips the current position.
 */
export function getNextTower(grid: Grid, x: number, y: number): { x: number; y: number } | undefined {
	let cx = x + 1;
	let cy = y;

	while (cy < grid.height) {
		while (cx < grid.width) {
			if (grid.towers.has(towerKey(cx, cy))) {
				return { x: cx, y: cy };
			}
			cx++;
		}
		cx = 0;
		cy++;
	}
	return undefined;
}

/**
 * Find the previous tower before (x, y), scanning left then wrapping to previous rows.
 * Used for the `b` (back/tower jump) motion.
 * Skips the current position.
 */
export function getPrevTower(grid: Grid, x: number, y: number): { x: number; y: number } | undefined {
	let cx = x - 1;
	let cy = y;

	while (cy >= 0) {
		while (cx >= 0) {
			if (grid.towers.has(towerKey(cx, cy))) {
				return { x: cx, y: cy };
			}
			cx--;
		}
		cy--;
		cx = grid.width - 1;
	}
	return undefined;
}

/** Get all towers within a rectangular region. */
export function getTowersInRect(
	grid: Grid,
	x: number,
	y: number,
	width: number,
	height: number
): Tower[] {
	const result: Tower[] = [];
	for (const tower of grid.towers.values()) {
		if (tower.x >= x && tower.x < x + width && tower.y >= y && tower.y < y + height) {
			result.push(tower);
		}
	}
	return result;
}
