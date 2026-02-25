import { describe, it, expect } from 'vitest';
import {
	createScreenLayout,
	cellToPixel,
	pixelToCell,
	isInRegion,
	getScreenPixelSize
} from '../screen-layout.js';

describe('createScreenLayout', () => {
	// 20-col grid → padded to 32 content cols (MIN_CONTENT_COLS)
	const layout = createScreenLayout(20, 14);

	it('computes total dimensions with padding', () => {
		// Content width: 1 (border) + 32 (padded) + 1 (border) = 34
		// + sidebar width 22 = 56 total cols
		expect(layout.totalCols).toBe(56);
		// Content height: 1 + 1 + 1 + 14 + 1 + 1 + 1 = 20
		// + status bar 1 = 21 total rows
		expect(layout.totalRows).toBe(21);
	});

	it('positions header with padded content width', () => {
		expect(layout.header.x).toBe(1);
		expect(layout.header.y).toBe(1);
		expect(layout.header.width).toBe(32); // padded content cols
		expect(layout.header.height).toBe(1);
	});

	it('positions game grid at actual size (not padded)', () => {
		expect(layout.gameGrid.x).toBe(1);
		expect(layout.gameGrid.y).toBe(3); // 1 border + 1 header + 1 divider
		expect(layout.gameGrid.width).toBe(20); // actual grid width
		expect(layout.gameGrid.height).toBe(14);
	});

	it('positions sidebar to the right of padded content', () => {
		expect(layout.sidebar.x).toBe(34); // 1 + 32 + 1
		expect(layout.sidebar.y).toBe(0);
		expect(layout.sidebar.width).toBe(22);
	});

	it('positions build menu with padded content width', () => {
		expect(layout.buildMenu.x).toBe(1);
		expect(layout.buildMenu.y).toBe(18); // 1 + 1 + 1 + 14 + 1
		expect(layout.buildMenu.width).toBe(32); // padded content cols
		expect(layout.buildMenu.height).toBe(1);
	});

	it('positions status bar at the bottom spanning full width', () => {
		expect(layout.statusBar.x).toBe(0);
		expect(layout.statusBar.y).toBe(20);
		expect(layout.statusBar.width).toBe(56);
		expect(layout.statusBar.height).toBe(1);
	});

	it('uses 16px glyphs', () => {
		expect(layout.glyphWidth).toBe(16);
		expect(layout.glyphHeight).toBe(16);
	});
});

describe('createScreenLayout with small grid', () => {
	const layout = createScreenLayout(10, 7);

	it('pads small grid to minimum content width', () => {
		// contentCols = max(10, 32) = 32
		// contentWidth = 1 + 32 + 1 = 34
		// totalCols = 34 + 22 = 56
		expect(layout.totalCols).toBe(56);
		expect(layout.gameGrid.width).toBe(10); // actual grid stays 10
		expect(layout.header.width).toBe(32); // padded
		expect(layout.buildMenu.width).toBe(32); // padded
	});
});

describe('createScreenLayout with large grid', () => {
	const layout = createScreenLayout(40, 20);

	it('does not pad grids wider than minimum', () => {
		// contentCols = max(40, 32) = 40 (no padding needed)
		// contentWidth = 1 + 40 + 1 = 42
		// totalCols = 42 + 22 = 64
		expect(layout.totalCols).toBe(64);
		expect(layout.gameGrid.width).toBe(40);
		expect(layout.header.width).toBe(40);
		expect(layout.buildMenu.width).toBe(40);
	});
});

describe('cellToPixel', () => {
	const layout = createScreenLayout(20, 14);

	it('converts cell origin to pixel origin', () => {
		const { px, py } = cellToPixel(layout, 0, 0);
		expect(px).toBe(0);
		expect(py).toBe(0);
	});

	it('multiplies by glyph size', () => {
		const { px, py } = cellToPixel(layout, 5, 3);
		expect(px).toBe(80);
		expect(py).toBe(48);
	});
});

describe('pixelToCell', () => {
	const layout = createScreenLayout(20, 14);

	it('floors pixel coordinates to cell', () => {
		const { cellX, cellY } = pixelToCell(layout, 25, 50);
		expect(cellX).toBe(1);
		expect(cellY).toBe(3);
	});

	it('handles exact boundaries', () => {
		const { cellX, cellY } = pixelToCell(layout, 32, 48);
		expect(cellX).toBe(2);
		expect(cellY).toBe(3);
	});
});

describe('isInRegion', () => {
	const layout = createScreenLayout(20, 14);

	it('returns true for cells inside the game grid', () => {
		expect(isInRegion(layout.gameGrid, 1, 3)).toBe(true);
		expect(isInRegion(layout.gameGrid, 20, 16)).toBe(true);
	});

	it('returns false for cells outside the game grid', () => {
		expect(isInRegion(layout.gameGrid, 0, 3)).toBe(false); // border column
		expect(isInRegion(layout.gameGrid, 1, 2)).toBe(false); // header divider row
		expect(isInRegion(layout.gameGrid, 21, 3)).toBe(false); // past right edge
	});
});

describe('getScreenPixelSize', () => {
	const layout = createScreenLayout(20, 14);

	it('returns total pixel dimensions', () => {
		const size = getScreenPixelSize(layout);
		expect(size.width).toBe(56 * 16);
		expect(size.height).toBe(21 * 16);
	});
});
