/**
 * Canvas manager — handles canvas sizing, integer scaling, and letterboxing.
 *
 * The game renders at a fixed "native" resolution (determined by cell grid
 * dimensions × glyph size). The canvas manager scales this up by the largest
 * integer factor that fits the viewport, centering it with black letterboxing.
 */

export type CanvasManager = {
	readonly canvas: HTMLCanvasElement;
	readonly ctx: CanvasRenderingContext2D;
	/** Native (unscaled) pixel dimensions */
	readonly nativeWidth: number;
	readonly nativeHeight: number;
	/** Current integer scale factor */
	scale: number;
	/** Cleanup function to remove resize listener */
	destroy: () => void;
};

/**
 * Initialize the canvas manager.
 *
 * Sets the canvas to the native resolution and applies CSS scaling
 * to fill the viewport with integer scaling + letterboxing.
 */
export function createCanvasManager(
	canvas: HTMLCanvasElement,
	nativeWidth: number,
	nativeHeight: number
): CanvasManager {
	const ctx = canvas.getContext('2d', { alpha: false })!;

	// Set the actual canvas buffer to native resolution
	canvas.width = nativeWidth;
	canvas.height = nativeHeight;

	// Disable image smoothing for crisp pixel art
	ctx.imageSmoothingEnabled = false;

	const manager: CanvasManager = {
		canvas,
		ctx,
		nativeWidth,
		nativeHeight,
		scale: 1,
		destroy: () => {}
	};

	function resize() {
		updateScale(manager);
	}

	window.addEventListener('resize', resize);
	manager.destroy = () => window.removeEventListener('resize', resize);

	// Initial sizing
	updateScale(manager);

	return manager;
}

/**
 * Recalculate the integer scale factor and apply CSS transform.
 *
 * Uses CSS `transform: scale()` on the canvas element rather than
 * changing the canvas buffer size. This keeps rendering at native
 * resolution (sharp pixels) while displaying larger.
 */
function updateScale(manager: CanvasManager): void {
	const { canvas, nativeWidth, nativeHeight } = manager;
	const vw = window.innerWidth;
	const vh = window.innerHeight;

	// Find the largest integer scale that fits
	const maxScaleX = Math.floor(vw / nativeWidth);
	const maxScaleY = Math.floor(vh / nativeHeight);
	const scale = Math.max(1, Math.min(maxScaleX, maxScaleY));

	manager.scale = scale;

	// Apply CSS dimensions and transform
	const displayWidth = nativeWidth * scale;
	const displayHeight = nativeHeight * scale;

	canvas.style.width = `${displayWidth}px`;
	canvas.style.height = `${displayHeight}px`;

	// Center in viewport (the parent container uses flexbox centering,
	// but we set explicit margins as a fallback)
	canvas.style.marginLeft = 'auto';
	canvas.style.marginRight = 'auto';
}
