/**
 * Grid renderer — draws the full screen from a cell buffer.
 *
 * The screen is a 2D array of cells, each with a character code, foreground,
 * and background color. This module fills the buffer and draws it to canvas.
 */

import type { Tileset } from './tileset.js';
import { drawGlyph } from './tileset.js';
import type { ScreenLayout, CellRect } from './screen-layout.js';
import { colors } from './colors.js';

// CP437 box-drawing character codes
const BOX = {
	topLeft: 218, // ┌
	topRight: 191, // ┐
	bottomLeft: 192, // └
	bottomRight: 217, // ┘
	horizontal: 196, // ─
	vertical: 179, // │
	teeLeft: 195, // ├
	teeRight: 180, // ┤
	teeTop: 194, // ┬
	teeBottom: 193, // ┴
	cross: 197, // ┼

	// Double-line variants
	dblTopLeft: 201, // ╔
	dblTopRight: 187, // ╗
	dblBottomLeft: 200, // ╚
	dblBottomRight: 188, // ╝
	dblHorizontal: 205, // ═
	dblVertical: 186 // ║
} as const;

export type Cell = {
	char: number;
	fg: string;
	bg: string;
};

export type CellBuffer = {
	readonly width: number;
	readonly height: number;
	readonly cells: Cell[];
};

/** Create a blank cell buffer */
export function createCellBuffer(width: number, height: number): CellBuffer {
	const cells: Cell[] = new Array(width * height);
	for (let i = 0; i < cells.length; i++) {
		cells[i] = { char: 0, fg: colors.uiText, bg: colors.uiBackground };
	}
	return { width, height, cells };
}

/** Set a cell in the buffer */
export function setCell(buf: CellBuffer, x: number, y: number, char: number, fg: string, bg: string): void {
	if (x < 0 || x >= buf.width || y < 0 || y >= buf.height) return;
	const cell = buf.cells[y * buf.width + x];
	cell.char = char;
	cell.fg = fg;
	cell.bg = bg;
}

/** Write a text string into the buffer starting at (x, y) */
export function writeText(
	buf: CellBuffer,
	x: number,
	y: number,
	text: string,
	fg: string,
	bg: string
): void {
	for (let i = 0; i < text.length; i++) {
		setCell(buf, x + i, y, text.charCodeAt(i), fg, bg);
	}
}

/** Fill a rectangular region with a single character */
export function fillRect(
	buf: CellBuffer,
	rect: CellRect,
	char: number,
	fg: string,
	bg: string
): void {
	for (let row = 0; row < rect.height; row++) {
		for (let col = 0; col < rect.width; col++) {
			setCell(buf, rect.x + col, rect.y + row, char, fg, bg);
		}
	}
}

/** Draw a single-line box border around a cell rectangle (exclusive — border is outside the rect) */
export function drawBox(
	buf: CellBuffer,
	x: number,
	y: number,
	width: number,
	height: number,
	fg: string,
	bg: string
): void {
	// Corners
	setCell(buf, x, y, BOX.topLeft, fg, bg);
	setCell(buf, x + width - 1, y, BOX.topRight, fg, bg);
	setCell(buf, x, y + height - 1, BOX.bottomLeft, fg, bg);
	setCell(buf, x + width - 1, y + height - 1, BOX.bottomRight, fg, bg);

	// Top and bottom edges
	for (let col = 1; col < width - 1; col++) {
		setCell(buf, x + col, y, BOX.horizontal, fg, bg);
		setCell(buf, x + col, y + height - 1, BOX.horizontal, fg, bg);
	}

	// Left and right edges
	for (let row = 1; row < height - 1; row++) {
		setCell(buf, x, y + row, BOX.vertical, fg, bg);
		setCell(buf, x + width - 1, y + row, BOX.vertical, fg, bg);
	}
}

/** Draw a horizontal divider line with T-junctions at the edges */
export function drawHorizontalDivider(
	buf: CellBuffer,
	x: number,
	y: number,
	width: number,
	fg: string,
	bg: string
): void {
	setCell(buf, x, y, BOX.teeLeft, fg, bg);
	for (let col = 1; col < width - 1; col++) {
		setCell(buf, x + col, y, BOX.horizontal, fg, bg);
	}
	setCell(buf, x + width - 1, y, BOX.teeRight, fg, bg);
}

/** Draw a vertical divider line with T-junctions at the edges */
export function drawVerticalDivider(
	buf: CellBuffer,
	x: number,
	y: number,
	height: number,
	fg: string,
	bg: string
): void {
	setCell(buf, x, y, BOX.teeTop, fg, bg);
	for (let row = 1; row < height - 1; row++) {
		setCell(buf, x, y + row, BOX.vertical, fg, bg);
	}
	setCell(buf, x, y + height - 1, BOX.teeBottom, fg, bg);
}

/**
 * Draw the full chrome (borders, dividers) for the game screen layout.
 * This sets up the box-drawing frame around all regions.
 */
export function drawChrome(buf: CellBuffer, layout: ScreenLayout): void {
	const fg = colors.uiBorder;
	const bg = colors.uiBackground;

	const { header, gameGrid, buildMenu, sidebar } = layout;

	// Outer box around the left content area (header + grid + build menu)
	const contentWidth = sidebar.x; // content area ends where sidebar begins
	const contentHeight = 1 + header.height + 1 + gameGrid.height + 1 + buildMenu.height + 1;
	drawBox(buf, 0, 0, contentWidth, contentHeight, fg, bg);

	// Horizontal divider below header
	drawHorizontalDivider(buf, 0, header.y + header.height, contentWidth, fg, bg);

	// Horizontal divider above build menu
	drawHorizontalDivider(buf, 0, buildMenu.y - 1, contentWidth, fg, bg);

	// Vertical divider between content and sidebar
	const sidebarX = sidebar.x - 1;
	// The sidebar top-right and connections
	setCell(buf, sidebarX, 0, BOX.teeTop, fg, bg);
	for (let row = 1; row < contentHeight - 1; row++) {
		setCell(buf, sidebarX, row, BOX.vertical, fg, bg);
	}
	setCell(buf, sidebarX, contentHeight - 1, BOX.teeBottom, fg, bg);

	// Fix T-junction intersections where dividers meet the sidebar divider
	setCell(buf, sidebarX, header.y + header.height, BOX.teeRight, fg, bg);
	setCell(buf, sidebarX, buildMenu.y - 1, BOX.teeRight, fg, bg);

	// Sidebar right border and top/bottom
	const rightEdge = sidebar.x + sidebar.width - 1;
	for (let row = 0; row < contentHeight; row++) {
		if (row === 0) {
			setCell(buf, rightEdge, row, BOX.topRight, fg, bg);
		} else if (row === contentHeight - 1) {
			setCell(buf, rightEdge, row, BOX.bottomRight, fg, bg);
		} else {
			setCell(buf, rightEdge, row, BOX.vertical, fg, bg);
		}
	}

	// Fix: the outer box already drew topRight at contentWidth-1,
	// but the sidebar extends further. Overwrite the top-left corner
	// of sidebar area and the top edge.
	setCell(buf, 0, 0, BOX.topLeft, fg, bg);
	for (let col = sidebar.x; col < rightEdge; col++) {
		setCell(buf, col, 0, BOX.horizontal, fg, bg);
	}
	// Bottom edge across sidebar
	for (let col = sidebar.x; col < rightEdge; col++) {
		setCell(buf, col, contentHeight - 1, BOX.horizontal, fg, bg);
	}

	// Horizontal dividers in the sidebar matching header/build menu dividers
	setCell(buf, sidebarX, header.y + header.height, BOX.cross, fg, bg);
	for (let col = sidebar.x; col < rightEdge; col++) {
		setCell(buf, col, header.y + header.height, BOX.horizontal, fg, bg);
	}
	setCell(buf, rightEdge, header.y + header.height, BOX.teeRight, fg, bg);
}

/**
 * Render the full cell buffer to a canvas context.
 */
export function renderBuffer(
	ctx: CanvasRenderingContext2D,
	tileset: Tileset,
	buf: CellBuffer
): void {
	const gw = tileset.glyphWidth;
	const gh = tileset.glyphHeight;

	for (let y = 0; y < buf.height; y++) {
		for (let x = 0; x < buf.width; x++) {
			const cell = buf.cells[y * buf.width + x];
			drawGlyph(ctx, tileset, cell.char, x * gw, y * gh, cell.fg, cell.bg);
		}
	}
}

export { BOX };
