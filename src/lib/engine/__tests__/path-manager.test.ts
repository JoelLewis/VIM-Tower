import { describe, it, expect } from 'vitest';
import { expandWaypoints, getPositionOnPath, getPathLength } from '../path-manager.js';

describe('expandWaypoints', () => {
	it('expands a horizontal segment into individual cells', () => {
		const path = expandWaypoints([
			{ x: 0, y: 0 },
			{ x: 3, y: 0 }
		]);
		expect(path).toEqual([
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
			{ x: 2, y: 0 },
			{ x: 3, y: 0 }
		]);
	});

	it('expands a vertical segment', () => {
		const path = expandWaypoints([
			{ x: 0, y: 0 },
			{ x: 0, y: 3 }
		]);
		expect(path).toEqual([
			{ x: 0, y: 0 },
			{ x: 0, y: 1 },
			{ x: 0, y: 2 },
			{ x: 0, y: 3 }
		]);
	});

	it('expands multiple segments (L-shaped path)', () => {
		const path = expandWaypoints([
			{ x: 0, y: 0 },
			{ x: 2, y: 0 },
			{ x: 2, y: 2 }
		]);
		expect(path).toEqual([
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
			{ x: 2, y: 0 },
			{ x: 2, y: 1 },
			{ x: 2, y: 2 }
		]);
	});

	it('handles reverse direction (right to left)', () => {
		const path = expandWaypoints([
			{ x: 3, y: 0 },
			{ x: 0, y: 0 }
		]);
		expect(path).toEqual([
			{ x: 3, y: 0 },
			{ x: 2, y: 0 },
			{ x: 1, y: 0 },
			{ x: 0, y: 0 }
		]);
	});

	it('handles reverse direction (bottom to top)', () => {
		const path = expandWaypoints([
			{ x: 0, y: 3 },
			{ x: 0, y: 0 }
		]);
		expect(path).toEqual([
			{ x: 0, y: 3 },
			{ x: 0, y: 2 },
			{ x: 0, y: 1 },
			{ x: 0, y: 0 }
		]);
	});

	it('handles single waypoint', () => {
		const path = expandWaypoints([{ x: 5, y: 5 }]);
		expect(path).toEqual([{ x: 5, y: 5 }]);
	});

	it('does not duplicate shared waypoints between segments', () => {
		const path = expandWaypoints([
			{ x: 0, y: 0 },
			{ x: 2, y: 0 },
			{ x: 2, y: 2 },
			{ x: 0, y: 2 }
		]);
		// The waypoint (2,0) and (2,2) should appear exactly once each
		const at_2_0 = path.filter((p) => p.x === 2 && p.y === 0);
		expect(at_2_0).toHaveLength(1);
		const at_2_2 = path.filter((p) => p.x === 2 && p.y === 2);
		expect(at_2_2).toHaveLength(1);
	});
});

describe('getPositionOnPath', () => {
	const path = expandWaypoints([
		{ x: 0, y: 0 },
		{ x: 3, y: 0 }
	]);

	it('returns first cell position at index 0, progress 0', () => {
		const pos = getPositionOnPath(path, 0, 0);
		expect(pos).toEqual({ x: 0, y: 0 });
	});

	it('interpolates between cells', () => {
		const pos = getPositionOnPath(path, 0, 0.5);
		expect(pos.x).toBeCloseTo(0.5);
		expect(pos.y).toBeCloseTo(0);
	});

	it('returns exact cell at progress 1.0', () => {
		const pos = getPositionOnPath(path, 0, 1.0);
		expect(pos).toEqual({ x: 1, y: 0 });
	});

	it('returns last cell when at end of path', () => {
		const pos = getPositionOnPath(path, 3, 0);
		expect(pos).toEqual({ x: 3, y: 0 });
	});

	it('clamps beyond end of path', () => {
		const pos = getPositionOnPath(path, 10, 0);
		expect(pos).toEqual({ x: 3, y: 0 });
	});

	it('interpolates vertical segments', () => {
		const vpath = expandWaypoints([
			{ x: 0, y: 0 },
			{ x: 0, y: 3 }
		]);
		const pos = getPositionOnPath(vpath, 1, 0.5);
		expect(pos.x).toBeCloseTo(0);
		expect(pos.y).toBeCloseTo(1.5);
	});
});

describe('getPathLength', () => {
	it('returns number of cells in path', () => {
		const path = expandWaypoints([
			{ x: 0, y: 0 },
			{ x: 4, y: 0 }
		]);
		expect(getPathLength(path)).toBe(5);
	});

	it('returns 1 for single-cell path', () => {
		expect(getPathLength([{ x: 0, y: 0 }])).toBe(1);
	});
});
