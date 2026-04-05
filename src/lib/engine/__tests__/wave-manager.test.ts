import { describe, it, expect } from 'vitest';
import {
	createWaveManager,
	startWave,
	updateWave,
	isWaveComplete,
	isAllWavesComplete,
	advanceWave
} from '../wave-manager.js';
import { createEnemyManager, getAliveEnemies } from '../enemy-manager.js';
import { expandWaypoints } from '../path-manager.js';
import { ENEMY_TYPES } from '$lib/types/game.js';

const testPath = expandWaypoints([
	{ x: 0, y: 0 },
	{ x: 5, y: 0 }
]);

const testWaves = [
	{
		groups: [{ type: ENEMY_TYPES.walker, count: 3, spawnInterval: 0.5 }]
	},
	{
		groups: [
			{ type: ENEMY_TYPES.walker, count: 2, spawnInterval: 0.5 },
			{ type: ENEMY_TYPES.runner, count: 1, spawnInterval: 0.5 }
		]
	}
];

describe('createWaveManager', () => {
	it('creates a wave manager with wave definitions', () => {
		const mgr = createWaveManager(testWaves);
		expect(mgr.currentWave).toBe(0);
		expect(mgr.totalWaves).toBe(2);
	});
});

describe('startWave', () => {
	it('starts the current wave', () => {
		const mgr = createWaveManager(testWaves);
		startWave(mgr);
		expect(mgr.active).toBe(true);
		expect(mgr.spawnTimer).toBe(0);
	});
});

describe('updateWave', () => {
	it('spawns enemies at the defined interval', () => {
		const mgr = createWaveManager(testWaves);
		const enemies = createEnemyManager(testPath);
		startWave(mgr);

		// First enemy spawns immediately (timer starts at 0)
		updateWave(mgr, enemies, 0.01);
		expect(getAliveEnemies(enemies)).toHaveLength(1);

		// Second enemy spawns after interval (0.5s)
		updateWave(mgr, enemies, 0.5);
		expect(getAliveEnemies(enemies)).toHaveLength(2);

		// Third enemy after another interval
		updateWave(mgr, enemies, 0.5);
		expect(getAliveEnemies(enemies)).toHaveLength(3);
	});

	it('stops spawning when all enemies in wave have been spawned', () => {
		const mgr = createWaveManager(testWaves);
		const enemies = createEnemyManager(testPath);
		startWave(mgr);

		// Spawn all 3 walkers
		updateWave(mgr, enemies, 0.01);
		updateWave(mgr, enemies, 0.5);
		updateWave(mgr, enemies, 0.5);
		expect(getAliveEnemies(enemies)).toHaveLength(3);

		// No more should spawn
		updateWave(mgr, enemies, 1.0);
		expect(getAliveEnemies(enemies)).toHaveLength(3);
	});

	it('handles multiple spawn groups in a wave', () => {
		const mgr = createWaveManager(testWaves);
		const enemies = createEnemyManager(testPath);
		mgr.currentWave = 1; // second wave: 2 walkers + 1 runner
		startWave(mgr);

		// Spawn all (2 walkers + 1 runner = 3 total)
		updateWave(mgr, enemies, 0.01);
		updateWave(mgr, enemies, 0.5);
		updateWave(mgr, enemies, 0.5);
		expect(getAliveEnemies(enemies)).toHaveLength(3);
	});
});

describe('isWaveComplete', () => {
	it('returns false while enemies are alive', () => {
		const mgr = createWaveManager(testWaves);
		const enemies = createEnemyManager(testPath);
		startWave(mgr);
		updateWave(mgr, enemies, 0.01);
		expect(isWaveComplete(mgr, enemies)).toBe(false);
	});

	it('returns false while enemies are still spawning', () => {
		const mgr = createWaveManager(testWaves);
		const enemies = createEnemyManager(testPath);
		startWave(mgr);
		// Only 1 of 3 spawned
		updateWave(mgr, enemies, 0.01);
		// Kill the spawned one
		getAliveEnemies(enemies)[0].alive = false;
		expect(isWaveComplete(mgr, enemies)).toBe(false);
	});

	it('returns true when all enemies spawned and all dead/exited', () => {
		const mgr = createWaveManager(testWaves);
		const enemies = createEnemyManager(testPath);
		startWave(mgr);

		// Spawn all
		updateWave(mgr, enemies, 0.01);
		updateWave(mgr, enemies, 0.5);
		updateWave(mgr, enemies, 0.5);

		// Kill all
		for (const e of enemies.enemies) {
			e.alive = false;
		}

		expect(isWaveComplete(mgr, enemies)).toBe(true);
	});
});

describe('isAllWavesComplete', () => {
	it('returns false when waves remain', () => {
		const mgr = createWaveManager(testWaves);
		expect(isAllWavesComplete(mgr)).toBe(false);
	});

	it('returns true when all waves have been played', () => {
		const mgr = createWaveManager(testWaves);
		mgr.currentWave = 2; // past the last wave (0-indexed, 2 waves total)
		expect(isAllWavesComplete(mgr)).toBe(true);
	});
});

describe('advanceWave', () => {
	it('increments currentWave counter', () => {
		const mgr = createWaveManager(testWaves);
		expect(mgr.currentWave).toBe(0);
		advanceWave(mgr);
		expect(mgr.currentWave).toBe(1);
	});

	it('sets active to false after advancing', () => {
		const mgr = createWaveManager(testWaves);
		startWave(mgr);
		expect(mgr.active).toBe(true);
		advanceWave(mgr);
		expect(mgr.active).toBe(false);
	});

	it('can advance past final wave', () => {
		const mgr = createWaveManager(testWaves);
		mgr.currentWave = 1; // last wave (0-indexed)
		advanceWave(mgr);
		expect(mgr.currentWave).toBe(2);
		expect(isAllWavesComplete(mgr)).toBe(true);
	});
});

describe('Final Wave Stage Complete Transition', () => {
	it('final wave completion flow from start to all waves complete', () => {
		const mgr = createWaveManager(testWaves);
		const enemies = createEnemyManager(testPath);

		// Start and complete wave 1
		startWave(mgr);
		updateWave(mgr, enemies, 0.01);
		updateWave(mgr, enemies, 0.5);
		updateWave(mgr, enemies, 0.5);

		// Kill all enemies
		for (const e of enemies.enemies) {
			e.alive = false;
		}
		expect(isWaveComplete(mgr, enemies)).toBe(true);
		expect(isAllWavesComplete(mgr)).toBe(false);

		// Advance to wave 2
		advanceWave(mgr);
		expect(mgr.currentWave).toBe(1);
		expect(isAllWavesComplete(mgr)).toBe(false);

		// Start and complete wave 2 (final wave)
		startWave(mgr);
		updateWave(mgr, enemies, 0.01);
		updateWave(mgr, enemies, 0.5);
		updateWave(mgr, enemies, 0.5);

		// Kill all enemies
		for (const e of enemies.enemies) {
			e.alive = false;
		}
		expect(isWaveComplete(mgr, enemies)).toBe(true);

		// Advance past final wave - should trigger stage complete
		advanceWave(mgr);
		expect(mgr.currentWave).toBe(2);
		expect(isAllWavesComplete(mgr)).toBe(true);
	});

	it('startWave does nothing when past final wave', () => {
		const mgr = createWaveManager(testWaves);
		mgr.currentWave = 2; // past all waves

		startWave(mgr);
		expect(mgr.active).toBe(false);
	});

	it('updateWave does nothing when past final wave', () => {
		const mgr = createWaveManager(testWaves);
		const enemies = createEnemyManager(testPath);
		mgr.currentWave = 2; // past all waves
		mgr.active = false;

		const initialEnemyCount = getAliveEnemies(enemies).length;
		updateWave(mgr, enemies, 1.0);
		expect(getAliveEnemies(enemies).length).toBe(initialEnemyCount);
	});

	it('single wave stage completes correctly', () => {
		const singleWave = [{ groups: [{ type: ENEMY_TYPES.walker, count: 1, spawnInterval: 0.5 }] }];
		const mgr = createWaveManager(singleWave);
		const enemies = createEnemyManager(testPath);

		expect(mgr.totalWaves).toBe(1);
		expect(isAllWavesComplete(mgr)).toBe(false);

		startWave(mgr);
		updateWave(mgr, enemies, 0.01);
		enemies.enemies[0].alive = false;

		expect(isWaveComplete(mgr, enemies)).toBe(true);
		advanceWave(mgr);
		expect(isAllWavesComplete(mgr)).toBe(true);
	});
});
