/**
 * Screen layout — defines all regions of the game screen as cell rectangles.
 *
 * The entire game UI is a character grid. This module defines where each
 * region lives (header, game grid, sidebar, build menu, status bar) and
 * provides coordinate translation between cell space and pixel space.
 *
 * Layout (cell coordinates):
 * ┌─────────────────────────────────┬──────────────┐
 * │           HEADER (1 row)        │              │
 * ├─────────────────────────────────┤   SIDEBAR    │
 * │                                 │  (commands)  │
 * │         GAME GRID               │              │
 * │                                 │              │
 * ├─────────────────────────────────┤              │
 * │       BUILD MENU (1 row)        │              │
 * ├─────────────────────────────────┴──────────────┤
 * │              STATUS BAR (1 row)                 │
 * └─────────────────────────────────────────────────┘
 */

export type CellRect = {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
};

export type ScreenLayout = {
	/** Total screen size in cells */
	readonly totalCols: number;
	readonly totalRows: number;

	/** Pixel dimensions of a single glyph */
	readonly glyphWidth: number;
	readonly glyphHeight: number;

	/** Region rectangles in cell coordinates */
	readonly header: CellRect;
	readonly gameGrid: CellRect;
	readonly sidebar: CellRect;
	readonly buildMenu: CellRect;
	readonly statusBar: CellRect;
};

const GLYPH_SIZE = 16;
const SIDEBAR_WIDTH = 22;
const HEADER_HEIGHT = 1;
const BUILD_MENU_HEIGHT = 1;
const STATUS_BAR_HEIGHT = 1;

// Border cells (box-drawing chars occupy 1 cell each)
const BORDER = 1;

// Minimum content columns to ensure header/build menu have enough space
const MIN_CONTENT_COLS = 32;

/**
 * Create a screen layout for a given game grid size.
 * The game grid size varies per stage (e.g., 10x7 for Stage 1, 20x14 for Stage 4).
 * Small grids are padded to MIN_CONTENT_COLS so the header and build menu fit.
 */
export function createScreenLayout(gameGridCols: number, gameGridRows: number): ScreenLayout {
	// Pad small grids so header/build menu have enough room
	const contentCols = Math.max(gameGridCols, MIN_CONTENT_COLS);

	// Content area = padded grid area + borders around it
	const contentWidth = BORDER + contentCols + BORDER;
	const contentHeight = BORDER + HEADER_HEIGHT + BORDER + gameGridRows + BORDER + BUILD_MENU_HEIGHT + BORDER;

	// Sidebar sits to the right of the content area
	const totalCols = contentWidth + SIDEBAR_WIDTH;

	// Status bar spans the full width below everything
	const totalRows = contentHeight + STATUS_BAR_HEIGHT;

	const header: CellRect = {
		x: BORDER,
		y: BORDER,
		width: contentCols,
		height: HEADER_HEIGHT
	};

	const gameGrid: CellRect = {
		x: BORDER,
		y: BORDER + HEADER_HEIGHT + BORDER,
		width: gameGridCols,
		height: gameGridRows
	};

	const sidebar: CellRect = {
		x: contentWidth,
		y: 0,
		width: SIDEBAR_WIDTH,
		height: contentHeight
	};

	const buildMenu: CellRect = {
		x: BORDER,
		y: BORDER + HEADER_HEIGHT + BORDER + gameGridRows + BORDER,
		width: contentCols,
		height: BUILD_MENU_HEIGHT
	};

	const statusBar: CellRect = {
		x: 0,
		y: contentHeight,
		width: totalCols,
		height: STATUS_BAR_HEIGHT
	};

	return {
		totalCols,
		totalRows,
		glyphWidth: GLYPH_SIZE,
		glyphHeight: GLYPH_SIZE,
		header,
		gameGrid,
		sidebar,
		buildMenu,
		statusBar
	};
}

/** Convert cell coordinates to pixel coordinates */
export function cellToPixel(
	layout: ScreenLayout,
	cellX: number,
	cellY: number
): { px: number; py: number } {
	return {
		px: cellX * layout.glyphWidth,
		py: cellY * layout.glyphHeight
	};
}

/** Convert pixel coordinates to cell coordinates (floor) */
export function pixelToCell(
	layout: ScreenLayout,
	px: number,
	py: number
): { cellX: number; cellY: number } {
	return {
		cellX: Math.floor(px / layout.glyphWidth),
		cellY: Math.floor(py / layout.glyphHeight)
	};
}

/** Check if a cell coordinate falls within a given region */
export function isInRegion(region: CellRect, cellX: number, cellY: number): boolean {
	return (
		cellX >= region.x &&
		cellX < region.x + region.width &&
		cellY >= region.y &&
		cellY < region.y + region.height
	);
}

/** Get the total pixel dimensions of the screen */
export function getScreenPixelSize(layout: ScreenLayout): { width: number; height: number } {
	return {
		width: layout.totalCols * layout.glyphWidth,
		height: layout.totalRows * layout.glyphHeight
	};
}
