/**
 * Stage definitions for the MVP (Stages 1-4).
 *
 * Each stage defines the grid layout, enemy path, waves, available towers,
 * unlocked VIM commands, starting resources, and par keystroke targets.
 */

import type { StageConfig } from '$lib/engine/game.js';
import type { CellType, TowerType } from '$lib/types/game.js';
import { CELL_TYPES } from '$lib/types/game.js';
import type { Point } from '$lib/engine/path-manager.js';
import type { WaveDefinition } from '$lib/engine/wave-manager.js';

export type StageDefinition = StageConfig & {
	readonly id: number;
	readonly availableTowers: TowerType[];
	readonly parKeystrokes: number;
	readonly tutorialSteps: TutorialStep[] | null;
	readonly introText: string | null;
};

export type TutorialStep = {
	readonly message: string;
	readonly requiredAction: string | null; // command type to wait for, or null for any key
	readonly highlightCell: Point | null;
};

// ─── Helper ──────────────────────────────────────────────────

function buildGrid(rows: string[]): { layout: CellType[][]; waypoints: Point[] } {
	const layout: CellType[][] = [];
	const waypointMap = new Map<string, Point>();

	for (let y = 0; y < rows.length; y++) {
		const row: CellType[] = [];
		for (let x = 0; x < rows[y].length; x++) {
			const ch = rows[y][x];
			switch (ch) {
				case '.':
					row.push(CELL_TYPES.empty);
					break;
				case '#':
					row.push(CELL_TYPES.path);
					break;
				case 'S':
					row.push(CELL_TYPES.spawn);
					break;
				case 'E':
					row.push(CELL_TYPES.exit);
					break;
				default: {
					// Numbered waypoints (1-9) mark path corners
					if (ch >= '1' && ch <= '9') {
						row.push(CELL_TYPES.path);
						waypointMap.set(ch, { x, y });
					} else {
						row.push(CELL_TYPES.empty);
					}
				}
			}
		}
		layout.push(row);
	}

	// Extract waypoints in order — spawn is first, then numbered, exit is last
	const waypoints: Point[] = [];
	// Find spawn
	for (let y = 0; y < layout.length; y++) {
		for (let x = 0; x < layout[y].length; x++) {
			if (layout[y][x] === CELL_TYPES.spawn) {
				waypoints.push({ x, y });
				break;
			}
		}
		if (waypoints.length > 0) break;
	}
	// Add numbered waypoints in order
	for (let i = 1; i <= 9; i++) {
		const wp = waypointMap.get(String(i));
		if (wp) waypoints.push(wp);
	}
	// Find exit
	for (let y = 0; y < layout.length; y++) {
		for (let x = 0; x < layout[y].length; x++) {
			if (layout[y][x] === CELL_TYPES.exit) {
				waypoints.push({ x, y });
				break;
			}
		}
	}

	return { layout, waypoints };
}

// ─── Stage 1: First Steps (10×7) ───────────────────────────

const stage1Grid = buildGrid([
	'..........',
	'..........',
	'..........',
	'S########E',
	'..........',
	'..........',
	'..........'
]);

const stage1Waves: WaveDefinition[] = [
	{ groups: [{ type: 'walker', count: 3, spawnInterval: 1.2 }] },
	{ groups: [{ type: 'walker', count: 5, spawnInterval: 1.0 }] },
	{ groups: [{ type: 'walker', count: 4, spawnInterval: 0.8 }, { type: 'walker', count: 3, spawnInterval: 0.6 }] }
];

const stage1Tutorial: TutorialStep[] = [
	{ message: 'Welcome to :wq! Use h/j/k/l to move the cursor.', requiredAction: 'move_cursor', highlightCell: null },
	{ message: 'Move to an empty cell next to the path.', requiredAction: 'move_cursor', highlightCell: { x: 4, y: 2 } },
	{ message: 'Press i to enter INSERT mode.', requiredAction: 'enter_insert_mode', highlightCell: null },
	{ message: 'Press 1 to place an Arrow tower.', requiredAction: 'place_tower', highlightCell: null },
	{ message: 'Press Esc to return to NORMAL mode.', requiredAction: 'enter_normal_mode', highlightCell: null },
	{ message: 'Type :w and Enter to start the wave!', requiredAction: 'execute_command', highlightCell: null }
];

export const STAGE_1: StageDefinition = {
	id: 1,
	name: 'Stage 1: First Steps',
	gridLayout: stage1Grid.layout,
	waypoints: stage1Grid.waypoints,
	waves: stage1Waves,
	startingGold: 200,
	startingLives: 10,
	availableTowers: ['arrow'],
	parKeystrokes: 30,
	tutorialSteps: stage1Tutorial,
	introText: null
};

// ─── Stage 2: The L-Turn (14×10) ───────────────────────────

const stage2Grid = buildGrid([
	'..............',
	'..............',
	'S########1....',
	'..........#...',
	'..........#...',
	'..........#...',
	'..........#...',
	'..........#...',
	'...E######2...',
	'..............'
]);

const stage2Waves: WaveDefinition[] = [
	{ groups: [{ type: 'walker', count: 5, spawnInterval: 1.0 }] },
	{ groups: [{ type: 'walker', count: 3, spawnInterval: 0.8 }, { type: 'runner', count: 3, spawnInterval: 0.5 }] },
	{ groups: [{ type: 'runner', count: 5, spawnInterval: 0.4 }, { type: 'walker', count: 4, spawnInterval: 0.8 }] },
	{ groups: [{ type: 'walker', count: 6, spawnInterval: 0.6 }, { type: 'runner', count: 4, spawnInterval: 0.4 }] }
];

export const STAGE_2: StageDefinition = {
	id: 2,
	name: 'Stage 2: The L-Turn',
	gridLayout: stage2Grid.layout,
	waypoints: stage2Grid.waypoints,
	waves: stage2Waves,
	startingGold: 250,
	startingLives: 10,
	availableTowers: ['arrow', 'cannon'],
	parKeystrokes: 50,
	tutorialSteps: null,
	introText: 'New tower: Cannon (2). Use w/b to jump between towers.'
};

// ─── Stage 3: The Serpentine (18×10) ────────────────────────

const stage3Grid = buildGrid([
	'..................',
	'S###############1.',
	'.................#',
	'.2###############.',
	'.#................',
	'.3###############.',
	'.................#',
	'.................E',
	'..................',
	'..................'
]);

const stage3Waves: WaveDefinition[] = [
	{ groups: [{ type: 'walker', count: 6, spawnInterval: 0.8 }] },
	{ groups: [{ type: 'runner', count: 5, spawnInterval: 0.4 }, { type: 'walker', count: 4, spawnInterval: 0.8 }] },
	{ groups: [{ type: 'walker', count: 8, spawnInterval: 0.6 }] },
	{ groups: [{ type: 'runner', count: 6, spawnInterval: 0.3 }, { type: 'walker', count: 5, spawnInterval: 0.6 }] },
	{ groups: [{ type: 'walker', count: 6, spawnInterval: 0.5 }, { type: 'runner', count: 6, spawnInterval: 0.3 }] }
];

export const STAGE_3: StageDefinition = {
	id: 3,
	name: 'Stage 3: Serpentine',
	gridLayout: stage3Grid.layout,
	waypoints: stage3Grid.waypoints,
	waves: stage3Waves,
	startingGold: 300,
	startingLives: 10,
	availableTowers: ['arrow', 'cannon', 'frost'],
	parKeystrokes: 70,
	tutorialSteps: null,
	introText: 'New tower: Frost (3). Use 0/$ to jump to row start/end.'
};

// ─── Stage 4: The Gauntlet (20×14) ──────────────────────────

const stage4Grid = buildGrid([
	'....................',
	'.S###1..............',
	'.....#..............',
	'.....#..............',
	'.....#..............',
	'.3###2..............',
	'.#..................',
	'.#..................',
	'.#..................',
	'.4###5..............',
	'.....#..............',
	'.....#..............',
	'.....E..............',
	'....................'
]);

const stage4Waves: WaveDefinition[] = [
	{ groups: [{ type: 'walker', count: 8, spawnInterval: 0.8 }] },
	{ groups: [{ type: 'runner', count: 6, spawnInterval: 0.3 }, { type: 'walker', count: 5, spawnInterval: 0.6 }] },
	{ groups: [{ type: 'walker', count: 6, spawnInterval: 0.5 }, { type: 'tank', count: 2, spawnInterval: 2.0 }] },
	{ groups: [{ type: 'runner', count: 8, spawnInterval: 0.3 }, { type: 'tank', count: 3, spawnInterval: 1.5 }] },
	{ groups: [{ type: 'walker', count: 5, spawnInterval: 0.4 }, { type: 'runner', count: 5, spawnInterval: 0.3 }, { type: 'tank', count: 2, spawnInterval: 1.0 }] },
	{ groups: [{ type: 'tank', count: 5, spawnInterval: 1.0 }, { type: 'runner', count: 10, spawnInterval: 0.2 }] }
];

export const STAGE_4: StageDefinition = {
	id: 4,
	name: 'Stage 4: The Gauntlet',
	gridLayout: stage4Grid.layout,
	waypoints: stage4Grid.waypoints,
	waves: stage4Waves,
	startingGold: 400,
	startingLives: 10,
	availableTowers: ['arrow', 'cannon', 'frost', 'lightning'],
	parKeystrokes: 100,
	tutorialSteps: null,
	introText: 'New tower: Lightning (4). Try count prefixes (5j) and gg/G.'
};

// ─── All Stages ──────────────────────────────────────────────

export const ALL_STAGES: StageDefinition[] = [STAGE_1, STAGE_2, STAGE_3, STAGE_4];

export function getStage(id: number): StageDefinition | undefined {
	return ALL_STAGES.find((s) => s.id === id);
}
