import { describe, it, expect } from 'vitest';
import { ALL_STAGES, getStage } from '../stage-data.js';
import { expandWaypoints } from '$lib/engine/path-manager.js';
import { CELL_TYPES } from '$lib/types/game.js';

describe('Stage Data', () => {
	it('has 4 stages', () => {
		expect(ALL_STAGES).toHaveLength(4);
	});

	it('stages have sequential IDs', () => {
		for (let i = 0; i < ALL_STAGES.length; i++) {
			expect(ALL_STAGES[i].id).toBe(i + 1);
		}
	});

	it('getStage returns correct stage by ID', () => {
		expect(getStage(1)?.name).toContain('First Steps');
		expect(getStage(4)?.name).toContain('Gauntlet');
		expect(getStage(99)).toBeUndefined();
	});

	for (const stage of ALL_STAGES) {
		describe(`Stage ${stage.id}: ${stage.name}`, () => {
			it('has a valid grid layout', () => {
				expect(stage.gridLayout.length).toBeGreaterThan(0);
				const width = stage.gridLayout[0].length;
				for (const row of stage.gridLayout) {
					expect(row.length).toBe(width);
				}
			});

			it('has exactly one spawn and one exit cell', () => {
				let spawns = 0;
				let exits = 0;
				for (const row of stage.gridLayout) {
					for (const cell of row) {
						if (cell === CELL_TYPES.spawn) spawns++;
						if (cell === CELL_TYPES.exit) exits++;
					}
				}
				expect(spawns).toBe(1);
				expect(exits).toBe(1);
			});

			it('has at least 2 waypoints (spawn + exit)', () => {
				expect(stage.waypoints.length).toBeGreaterThanOrEqual(2);
			});

			it('waypoints expand to a valid path', () => {
				const path = expandWaypoints(stage.waypoints);
				expect(path.length).toBeGreaterThanOrEqual(2);

				// First waypoint should be at spawn, last at exit
				const firstWp = stage.waypoints[0];
				const lastWp = stage.waypoints[stage.waypoints.length - 1];
				expect(stage.gridLayout[firstWp.y][firstWp.x]).toBe(CELL_TYPES.spawn);
				expect(stage.gridLayout[lastWp.y][lastWp.x]).toBe(CELL_TYPES.exit);
			});

			it('has at least 1 wave', () => {
				expect(stage.waves.length).toBeGreaterThanOrEqual(1);
			});

			it('waves have valid spawn groups', () => {
				for (const wave of stage.waves) {
					expect(wave.groups.length).toBeGreaterThanOrEqual(1);
					for (const group of wave.groups) {
						expect(group.count).toBeGreaterThan(0);
						expect(group.spawnInterval).toBeGreaterThan(0);
					}
				}
			});

			it('has positive starting gold and lives', () => {
				expect(stage.startingGold).toBeGreaterThan(0);
				expect(stage.startingLives).toBeGreaterThan(0);
			});

			it('has at least 1 available tower', () => {
				expect(stage.availableTowers.length).toBeGreaterThanOrEqual(1);
			});

			it('stage 1 has tutorial steps', () => {
				if (stage.id === 1) {
					expect(stage.tutorialSteps).not.toBeNull();
					expect(stage.tutorialSteps!.length).toBeGreaterThan(0);
				}
			});

			it('stages 2-4 have intro text', () => {
				if (stage.id > 1) {
					expect(stage.introText).not.toBeNull();
				}
			});
		});
	}
});
