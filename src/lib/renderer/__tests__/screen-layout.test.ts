import { describe, it, expect } from 'vitest';
import {
	createScreenLayout,
	cellToPixel,
	pixelToCell,
	isInRegion,
	getScreenPixelSize
} from '../screen-layout.js';

describe('createScreenLayout', () => {
	const layout = createScreenLayout(20, 14);

	it('computes total dimensions', () => {
		// Content width: 1 (border) + 20 (grid) + 1 (border) = 22
		// + sidebar width 22 = 44 total cols
		expect(layout.totalCols).toBe(44);
		// Content height: 1 + 1 + 1 + 14 + 1 + 1 + 1 = 20
		// + status bar 1 = 21 total rows
		expect(layout.totalRows).toBe(21);
	});

	it('positions header inside top border', () => {
		expect(layout.header.x).toBe(1);
		expect(layout.header.y).toBe(1);
		expect(layout.header.width).toBe(20);
		expect(layout.header.height).toBe(1);
	});

	it('positions game grid below header with border gap', () => {
		expect(layout.gameGrid.x).toBe(1);
		expect(layout.gameGrid.y).toBe(3); // 1 border + 1 header + 1 divider
		expect(layout.gameGrid.width).toBe(20);
		expect(layout.gameGrid.height).toBe(14);
	});

	it('positions sidebar to the right of content', () => {
		expect(layout.sidebar.x).toBe(22); // 1 + 20 + 1
		expect(layout.sidebar.y).toBe(0);
		expect(layout.sidebar.width).toBe(22);
	});

	it('positions build menu below game grid', () => {
		expect(layout.buildMenu.x).toBe(1);
		expect(layout.buildMenu.y).toBe(18); // 1 + 1 + 1 + 14 + 1
		expect(layout.buildMenu.width).toBe(20);
		expect(layout.buildMenu.height).toBe(1);
	});

	it('positions status bar at the bottom spanning full width', () => {
		expect(layout.statusBar.x).toBe(0);
		expect(layout.statusBar.y).toBe(20);
		expect(layout.statusBar.width).toBe(44);
		expect(layout.statusBar.height).toBe(1);
	});

	it('uses 16px glyphs', () => {
		expect(layout.glyphWidth).toBe(16);
		expect(layout.glyphHeight).toBe(16);
	});
});

describe('createScreenLayout with small grid', () => {
	const layout = createScreenLayout(10, 7);

	it('adapts to smaller stage sizes', () => {
		expect(layout.totalCols).toBe(34); // 12 + 22
		expect(layout.gameGrid.width).toBe(10);
		expect(layout.gameGrid.height).toBe(7);
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
		expect(size.width).toBe(44 * 16);
		expect(size.height).toBe(21 * 16);
	});
});
