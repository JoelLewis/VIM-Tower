/**
 * Path manager — converts waypoints to cell-by-cell paths.
 *
 * Stage data defines paths as a series of waypoints (corners).
 * This module expands them into every cell the path passes through,
 * and provides interpolation for smooth enemy movement between cells.
 */

export type Point = {
	readonly x: number;
	readonly y: number;
};

/**
 * Expand a series of waypoints into a full cell-by-cell path.
 * Waypoints must be axis-aligned (horizontal or vertical segments only).
 * Shared endpoints between segments appear exactly once.
 */
export function expandWaypoints(waypoints: Point[]): Point[] {
	if (waypoints.length === 0) return [];
	if (waypoints.length === 1) return [{ ...waypoints[0] }];

	const path: Point[] = [];

	for (let i = 0; i < waypoints.length - 1; i++) {
		const from = waypoints[i];
		const to = waypoints[i + 1];

		const dx = Math.sign(to.x - from.x);
		const dy = Math.sign(to.y - from.y);

		let cx = from.x;
		let cy = from.y;

		// Skip the first cell of subsequent segments (it's the last cell of the previous)
		if (i > 0) {
			cx += dx;
			cy += dy;
		}

		if (dx !== 0) {
			// Horizontal segment
			while (cx !== to.x + dx) {
				path.push({ x: cx, y: cy });
				cx += dx;
			}
		} else if (dy !== 0) {
			// Vertical segment
			while (cy !== to.y + dy) {
				path.push({ x: cx, y: cy });
				cy += dy;
			}
		} else {
			// Same point (zero-length segment) — only add if first segment
			if (i === 0) path.push({ x: cx, y: cy });
		}
	}

	return path;
}

/**
 * Get the interpolated world position for an enemy on the path.
 *
 * @param path - Expanded cell-by-cell path
 * @param pathIndex - Current cell index (integer)
 * @param progress - Progress toward next cell (0.0 to 1.0)
 * @returns Interpolated {x, y} position (fractional cell coordinates)
 */
export function getPositionOnPath(
	path: Point[],
	pathIndex: number,
	progress: number
): { x: number; y: number } {
	if (path.length === 0) return { x: 0, y: 0 };

	// Clamp to valid range
	const idx = Math.min(pathIndex, path.length - 1);
	const current = path[idx];

	// If at or past the last cell, return exact position
	if (idx >= path.length - 1) {
		return { x: current.x, y: current.y };
	}

	// Interpolate between current and next cell
	const next = path[idx + 1];
	return {
		x: current.x + (next.x - current.x) * progress,
		y: current.y + (next.y - current.y) * progress
	};
}

/** Get the total number of cells in a path. */
export function getPathLength(path: Point[]): number {
	return path.length;
}
