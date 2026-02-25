/**
 * Tileset loader and glyph renderer.
 *
 * Loads a CP437 tileset image (16x16 grid of glyphs, each 16x16 pixels)
 * and provides drawGlyph() to render colored characters to a canvas.
 *
 * Approach: The tileset PNG is white-on-transparent (or white-on-black).
 * To draw colored glyphs we:
 * 1. Fill the cell with the background color
 * 2. Use a cached tinted version of the tileset for the foreground color
 *    (composited via globalCompositeOperation)
 */

const TILESET_COLS = 16;
const TILESET_ROWS = 16;

export type Tileset = {
	readonly image: HTMLImageElement;
	readonly glyphWidth: number;
	readonly glyphHeight: number;
	/** Cache of tinted tileset canvases keyed by hex color */
	readonly tintCache: Map<string, CanvasImageSource>;
};

/** Load the tileset image from a URL. Returns a promise. */
export async function loadTileset(url: string): Promise<Tileset> {
	const image = new Image();
	image.src = url;
	await new Promise<void>((resolve, reject) => {
		image.onload = () => resolve();
		image.onerror = () => reject(new Error(`Failed to load tileset: ${url}`));
	});

	const glyphWidth = Math.floor(image.width / TILESET_COLS);
	const glyphHeight = Math.floor(image.height / TILESET_ROWS);

	return {
		image,
		glyphWidth,
		glyphHeight,
		tintCache: new Map()
	};
}

/**
 * Get (or create) a tinted version of the tileset for a given color.
 *
 * Uses globalCompositeOperation 'source-in' to replace white pixels
 * with the target color while preserving the alpha/luminance mask.
 */
function getTintedTileset(tileset: Tileset, color: string): CanvasImageSource {
	const cached = tileset.tintCache.get(color);
	if (cached) return cached;

	const { image } = tileset;
	const canvas = document.createElement('canvas');
	canvas.width = image.width;
	canvas.height = image.height;
	const ctx = canvas.getContext('2d')!;

	// Draw original tileset (white glyphs on black background)
	ctx.drawImage(image, 0, 0);

	// Use 'source-in' to tint: only paints where existing pixels are opaque.
	// But our tileset is opaque everywhere (white on black), so we need a
	// different approach: multiply mode tints white→color and black→black.
	ctx.globalCompositeOperation = 'multiply';
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Reset composite mode
	ctx.globalCompositeOperation = 'source-over';

	tileset.tintCache.set(color, canvas);
	return canvas;
}

/**
 * Draw a single glyph at cell position (cellX, cellY) on the target canvas.
 *
 * @param ctx - Target canvas 2D context
 * @param tileset - Loaded tileset
 * @param charCode - CP437 character code (0-255)
 * @param px - Pixel X position (pre-computed from cell coordinates)
 * @param py - Pixel Y position
 * @param fg - Foreground CSS color (hex string)
 * @param bg - Background CSS color (hex string)
 */
export function drawGlyph(
	ctx: CanvasRenderingContext2D,
	tileset: Tileset,
	charCode: number,
	px: number,
	py: number,
	fg: string,
	bg: string
): void {
	const { glyphWidth, glyphHeight } = tileset;

	// Source position in the tileset
	const srcX = (charCode % TILESET_COLS) * glyphWidth;
	const srcY = Math.floor(charCode / TILESET_COLS) * glyphHeight;

	// 1. Fill background
	ctx.fillStyle = bg;
	ctx.fillRect(px, py, glyphWidth, glyphHeight);

	// 2. Draw tinted glyph on top (skip if char is 0/space with black fg)
	if (charCode === 0 || charCode === 32) return;

	const tinted = getTintedTileset(tileset, fg);
	ctx.drawImage(tinted, srcX, srcY, glyphWidth, glyphHeight, px, py, glyphWidth, glyphHeight);
}

/**
 * Draw a string of ASCII text starting at pixel position (px, py).
 * Only handles printable ASCII (codes 32-126).
 */
export function drawText(
	ctx: CanvasRenderingContext2D,
	tileset: Tileset,
	text: string,
	px: number,
	py: number,
	fg: string,
	bg: string
): void {
	for (let i = 0; i < text.length; i++) {
		const charCode = text.charCodeAt(i);
		drawGlyph(ctx, tileset, charCode, px + i * tileset.glyphWidth, py, fg, bg);
	}
}

/** Clear the tint cache (call if colors change dramatically or for memory management) */
export function clearTintCache(tileset: Tileset): void {
	tileset.tintCache.clear();
}
