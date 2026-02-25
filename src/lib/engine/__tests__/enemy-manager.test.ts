import { describe, it, expect } from 'vitest';
import {
	createEnemyManager,
	spawnEnemy,
	updateEnemies,
	getEnemiesInRange,
	damageEnemy,
	getAliveEnemies
} from '../enemy-manager.js';
import { expandWaypoints } from '../path-manager.js';
import { ENEMY_TYPES } from '$lib/types/game.js';

const testPath = expandWaypoints([
	{ x: 0, y: 0 },
	{ x: 5, y: 0 }
]);

describe('createEnemyManager', () => {
	it('creates an empty manager', () => {
		const mgr = createEnemyManager(testPath);
		expect(getAliveEnemies(mgr)).toHaveLength(0);
	});
});

describe('spawnEnemy', () => {
	it('spawns an enemy at the start of the path', () => {
		const mgr = createEnemyManager(testPath);
		const enemy = spawnEnemy(mgr, ENEMY_TYPES.walker);
		expect(enemy.type).toBe('walker');
		expect(enemy.pathIndex).toBe(0);
		expect(enemy.pathProgress).toBe(0);
		expect(enemy.alive).toBe(true);
	});

	it('assigns unique IDs to each enemy', () => {
		const mgr = createEnemyManager(testPath);
		const e1 = spawnEnemy(mgr, ENEMY_TYPES.walker);
		const e2 = spawnEnemy(mgr, ENEMY_TYPES.runner);
		expect(e1.id).not.toBe(e2.id);
	});

	it('spawns enemies with correct stats', () => {
		const mgr = createEnemyManager(testPath);
		const walker = spawnEnemy(mgr, ENEMY_TYPES.walker);
		expect(walker.hp).toBe(100);
		expect(walker.maxHp).toBe(100);
		expect(walker.speed).toBe(1.5);

		const runner = spawnEnemy(mgr, ENEMY_TYPES.runner);
		expect(runner.hp).toBe(40);
		expect(runner.speed).toBe(3.0);

		const tank = spawnEnemy(mgr, ENEMY_TYPES.tank);
		expect(tank.hp).toBe(400);
		expect(tank.speed).toBe(0.8);
	});
});

describe('updateEnemies', () => {
	it('advances enemies along the path', () => {
		const mgr = createEnemyManager(testPath);
		const enemy = spawnEnemy(mgr, ENEMY_TYPES.walker);
		// Walker speed = 1.5 cells/sec, dt = 1.0 sec → moves 1.5 cells
		updateEnemies(mgr, 1.0);
		expect(enemy.pathIndex).toBe(1);
		expect(enemy.pathProgress).toBeCloseTo(0.5);
	});

	it('moves runner faster than walker', () => {
		const mgr = createEnemyManager(testPath);
		const runner = spawnEnemy(mgr, ENEMY_TYPES.runner);
		// Runner speed = 3.0, dt = 1.0 → moves 3 cells
		updateEnemies(mgr, 1.0);
		expect(runner.pathIndex).toBe(3);
		expect(runner.pathProgress).toBeCloseTo(0);
	});

	it('returns enemies that reached the exit', () => {
		const mgr = createEnemyManager(testPath);
		spawnEnemy(mgr, ENEMY_TYPES.runner);
		// Runner at speed 3.0, dt = 2.0 → moves 6 cells, path is 6 cells (indices 0-5)
		const result = updateEnemies(mgr, 2.0);
		expect(result.reachedExit).toHaveLength(1);
		expect(result.reachedExit[0].type).toBe('runner');
	});

	it('marks enemies that reach exit as not alive', () => {
		const mgr = createEnemyManager(testPath);
		const enemy = spawnEnemy(mgr, ENEMY_TYPES.runner);
		updateEnemies(mgr, 5.0);
		expect(enemy.alive).toBe(false);
	});

	it('does not update dead enemies', () => {
		const mgr = createEnemyManager(testPath);
		const enemy = spawnEnemy(mgr, ENEMY_TYPES.walker);
		enemy.alive = false;
		updateEnemies(mgr, 10.0);
		expect(enemy.pathIndex).toBe(0); // unchanged
	});

	it('applies slow debuff to enemy speed', () => {
		const mgr = createEnemyManager(testPath);
		const enemy = spawnEnemy(mgr, ENEMY_TYPES.walker);
		enemy.slowTimer = 2.0;
		enemy.speed = 1.5 * 0.4; // slowed to 40%
		updateEnemies(mgr, 1.0);
		// At 0.6 cells/sec for 1 sec = 0.6 cells
		expect(enemy.pathIndex).toBe(0);
		expect(enemy.pathProgress).toBeCloseTo(0.6);
		expect(enemy.slowTimer).toBeCloseTo(1.0);
	});
});

describe('getEnemiesInRange', () => {
	it('returns enemies within range of a point', () => {
		const mgr = createEnemyManager(testPath);
		spawnEnemy(mgr, ENEMY_TYPES.walker); // at (0,0)

		// Move it to cell 2 (x=2, y=0)
		updateEnemies(mgr, 1.333); // 1.5 * 1.333 ≈ 2.0 cells

		const inRange = getEnemiesInRange(mgr, 2, 0, 1.5);
		expect(inRange).toHaveLength(1);
	});

	it('excludes enemies out of range', () => {
		const mgr = createEnemyManager(testPath);
		spawnEnemy(mgr, ENEMY_TYPES.walker); // at (0,0)
		const inRange = getEnemiesInRange(mgr, 5, 0, 1);
		expect(inRange).toHaveLength(0);
	});

	it('excludes dead enemies', () => {
		const mgr = createEnemyManager(testPath);
		const enemy = spawnEnemy(mgr, ENEMY_TYPES.walker);
		enemy.alive = false;
		const inRange = getEnemiesInRange(mgr, 0, 0, 10);
		expect(inRange).toHaveLength(0);
	});
});

describe('damageEnemy', () => {
	it('reduces enemy HP', () => {
		const mgr = createEnemyManager(testPath);
		const enemy = spawnEnemy(mgr, ENEMY_TYPES.walker);
		damageEnemy(enemy, 30);
		expect(enemy.hp).toBe(70);
	});

	it('marks enemy as dead when HP reaches zero', () => {
		const mgr = createEnemyManager(testPath);
		const enemy = spawnEnemy(mgr, ENEMY_TYPES.walker);
		damageEnemy(enemy, 100);
		expect(enemy.hp).toBe(0);
		expect(enemy.alive).toBe(false);
	});

	it('marks enemy as dead when HP goes below zero', () => {
		const mgr = createEnemyManager(testPath);
		const enemy = spawnEnemy(mgr, ENEMY_TYPES.walker);
		damageEnemy(enemy, 999);
		expect(enemy.hp).toBe(0);
		expect(enemy.alive).toBe(false);
	});
});

describe('getAliveEnemies', () => {
	it('returns only alive enemies', () => {
		const mgr = createEnemyManager(testPath);
		const e1 = spawnEnemy(mgr, ENEMY_TYPES.walker);
		const e2 = spawnEnemy(mgr, ENEMY_TYPES.runner);
		e1.alive = false;
		expect(getAliveEnemies(mgr)).toHaveLength(1);
		expect(getAliveEnemies(mgr)[0].id).toBe(e2.id);
	});
});
