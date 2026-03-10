import { describe, it, expect } from 'vitest';
import { updateCombat } from '../combat-manager.js';
import { createGrid, placeTower } from '../grid.js';
import { createEnemyManager, spawnEnemy } from '../enemy-manager.js';
import { expandWaypoints } from '../path-manager.js';
import { CELL_TYPES, TOWER_TYPES, ENEMY_TYPES } from '$lib/types/game.js';
import type { CellType } from '$lib/types/game.js';

/**
 * Test layout (8x5):
 *   0 1 2 3 4 5 6 7
 * 0 . . . . . . . .
 * 1 . . . . . . . .
 * 2 S P P P P P P E   (path along row 2)
 * 3 . . . . . . . .
 * 4 . . . . . . . .
 */
function makeTestLayout(): CellType[][] {
	const grid: CellType[][] = [];
	for (let y = 0; y < 5; y++) {
		const row: CellType[] = [];
		for (let x = 0; x < 8; x++) {
			if (y === 2) {
				if (x === 0) row.push(CELL_TYPES.spawn);
				else if (x === 7) row.push(CELL_TYPES.exit);
				else row.push(CELL_TYPES.path);
			} else {
				row.push(CELL_TYPES.empty);
			}
		}
		grid.push(row);
	}
	return grid;
}

const testPath = expandWaypoints([
	{ x: 0, y: 2 },
	{ x: 7, y: 2 }
]);

describe('Combat Manager — Arrow Tower (single target)', () => {
	it('arrow tower damages nearest enemy in range', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 3, 1, TOWER_TYPES.arrow); // range 3, above path

		const enemies = createEnemyManager(testPath);
		const walker = spawnEnemy(enemies, ENEMY_TYPES.walker);
		// Move walker to x=3 (directly below tower)
		walker.pathIndex = 3;
		walker.pathProgress = 0;

		const result = updateCombat(grid, enemies, 1.0);
		expect(walker.hp).toBeLessThan(100);
		expect(result.damageDealt).toBeGreaterThan(0);
	});

	it('arrow tower does not fire when on cooldown', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 3, 1, TOWER_TYPES.arrow);

		const enemies = createEnemyManager(testPath);
		const walker = spawnEnemy(enemies, ENEMY_TYPES.walker);
		walker.pathIndex = 3;

		// First shot
		updateCombat(grid, enemies, 0.1);
		const hpAfterFirst = walker.hp;

		// Second update with small dt — tower should still be on cooldown
		updateCombat(grid, enemies, 0.1);
		// Arrow fire rate is 2.0/sec → cooldown 0.5s. 0.1s is not enough
		expect(walker.hp).toBe(hpAfterFirst);
	});

	it('arrow tower does not fire when no enemies in range', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 3, 1, TOWER_TYPES.arrow);

		const enemies = createEnemyManager(testPath);
		const walker = spawnEnemy(enemies, ENEMY_TYPES.walker);
		// Walker at start (0,2), tower at (3,1) — distance > 3

		const result = updateCombat(grid, enemies, 1.0);
		expect(walker.hp).toBe(100);
		expect(result.damageDealt).toBe(0);
	});
});

describe('Combat Manager — Cannon Tower (AOE)', () => {
	it('cannon damages multiple enemies in splash radius', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 4, 1, TOWER_TYPES.cannon); // range 2.5, splash 1.5

		const enemies = createEnemyManager(testPath);
		const e1 = spawnEnemy(enemies, ENEMY_TYPES.walker);
		const e2 = spawnEnemy(enemies, ENEMY_TYPES.walker);
		// Place both enemies near the tower
		e1.pathIndex = 4;
		e1.pathProgress = 0;
		e2.pathIndex = 5;
		e2.pathProgress = 0;

		updateCombat(grid, enemies, 1.0);
		// Both should take damage (within splash radius 1.5)
		expect(e1.hp).toBeLessThan(100);
		expect(e2.hp).toBeLessThan(100);
	});
});

describe('Combat Manager — Frost Tower (slow)', () => {
	it('frost tower applies slow debuff without damage', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 3, 1, TOWER_TYPES.frost); // range 2.5, slowFactor 0.4

		const enemies = createEnemyManager(testPath);
		const walker = spawnEnemy(enemies, ENEMY_TYPES.walker);
		walker.pathIndex = 3;

		const originalSpeed = walker.speed;
		updateCombat(grid, enemies, 1.0);

		// HP unchanged (frost does 0 damage)
		expect(walker.hp).toBe(100);
		// Slow debuff applied
		expect(walker.slowTimer).toBeGreaterThan(0);
		expect(walker.speed).toBeLessThan(originalSpeed);
	});
});

describe('Combat Manager — Debuff Stacking', () => {
	it('multiple frost towers hitting same enemy refresh slow timer', () => {
		const grid = createGrid(makeTestLayout());
		// Place two frost towers in range of the path
		placeTower(grid, 3, 1, TOWER_TYPES.frost);
		placeTower(grid, 4, 1, TOWER_TYPES.frost);

		const enemies = createEnemyManager(testPath);
		const walker = spawnEnemy(enemies, ENEMY_TYPES.walker);
		walker.pathIndex = 4; // Between both towers

		// First tower hits
		updateCombat(grid, enemies, 0.01);
		expect(walker.slowTimer).toBeGreaterThan(0);

		// Wait for second tower to fire (after its cooldown)
		updateCombat(grid, enemies, 0.7);
		// Slow timer should be refreshed (set to slowDuration again)
		expect(walker.slowTimer).toBeGreaterThanOrEqual(1.0);
		// Speed should still be reduced
		expect(walker.speed).toBe(1.5 * 0.4); // walker base speed * frost slowFactor
	});

	it('slow effect uses base speed, not current slowed speed', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 3, 1, TOWER_TYPES.frost);

		const enemies = createEnemyManager(testPath);
		const walker = spawnEnemy(enemies, ENEMY_TYPES.walker);
		walker.pathIndex = 3;
		const baseSpeed = walker.speed; // 1.5

		// Apply slow
		updateCombat(grid, enemies, 0.01);
		const slowedSpeed = walker.speed;
		expect(slowedSpeed).toBe(baseSpeed * 0.4);

		// Fire again after cooldown - should not stack multiplicatively
		updateCombat(grid, enemies, 0.8);
		expect(walker.speed).toBe(baseSpeed * 0.4);
		// Speed should NOT be: slowedSpeed * 0.4 (stacking)
		expect(walker.speed).not.toBe(slowedSpeed * 0.4);
	});

	it('frost applies slow to multiple enemies in range', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 4, 1, TOWER_TYPES.frost);

		const enemies = createEnemyManager(testPath);
		const e1 = spawnEnemy(enemies, ENEMY_TYPES.walker);
		const e2 = spawnEnemy(enemies, ENEMY_TYPES.walker);
		e1.pathIndex = 4;
		e2.pathIndex = 5;

		updateCombat(grid, enemies, 1.0);

		// Both should be slowed
		expect(e1.slowTimer).toBeGreaterThan(0);
		expect(e2.slowTimer).toBeGreaterThan(0);
		expect(e1.speed).toBe(1.5 * 0.4);
		expect(e2.speed).toBe(1.5 * 0.4);
	});

	it('different enemy types have correct slowed speed', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 4, 1, TOWER_TYPES.frost);

		const enemies = createEnemyManager(testPath);
		const walker = spawnEnemy(enemies, ENEMY_TYPES.walker);
		const runner = spawnEnemy(enemies, ENEMY_TYPES.runner);
		walker.pathIndex = 4;
		runner.pathIndex = 5;

		updateCombat(grid, enemies, 1.0);

		// Walker base speed 1.5 * 0.4 = 0.6
		expect(walker.speed).toBe(1.5 * 0.4);
		// Runner base speed 3.0 * 0.4 = 1.2
		expect(runner.speed).toBe(3.0 * 0.4);
	});
});

describe('Combat Manager — Lightning Tower (chain)', () => {
	it('lightning chains damage to multiple enemies', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 4, 1, TOWER_TYPES.lightning); // range 3, chainCount 3

		const enemies = createEnemyManager(testPath);
		const e1 = spawnEnemy(enemies, ENEMY_TYPES.walker);
		const e2 = spawnEnemy(enemies, ENEMY_TYPES.walker);
		const e3 = spawnEnemy(enemies, ENEMY_TYPES.walker);
		e1.pathIndex = 4;
		e2.pathIndex = 5;
		e3.pathIndex = 6;

		updateCombat(grid, enemies, 1.0);
		// All three should take damage from the chain
		expect(e1.hp).toBeLessThan(100);
		expect(e2.hp).toBeLessThan(100);
		expect(e3.hp).toBeLessThan(100);
	});

	it('lightning chain stops when no more enemies in range', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 4, 1, TOWER_TYPES.lightning);

		const enemies = createEnemyManager(testPath);
		const e1 = spawnEnemy(enemies, ENEMY_TYPES.walker);
		e1.pathIndex = 4;
		// Only one enemy — chain should hit just that one

		updateCombat(grid, enemies, 1.0);
		expect(e1.hp).toBeLessThan(100);
	});
});

describe('Combat Manager — Cooldown Management', () => {
	it('tower cooldown decreases each tick', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 3, 1, TOWER_TYPES.arrow);
		const tower = grid.towers.get('3,1')!;

		const enemies = createEnemyManager(testPath);
		const walker = spawnEnemy(enemies, ENEMY_TYPES.walker);
		walker.pathIndex = 3;

		// Fire once (cooldown starts at 0, fires immediately)
		updateCombat(grid, enemies, 0.01);
		expect(tower.cooldownRemaining).toBeGreaterThan(0);

		// Tick down
		updateCombat(grid, enemies, 0.3);
		expect(tower.cooldownRemaining).toBeLessThan(0.5);
	});

	it('tower fires again after cooldown expires', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 3, 1, TOWER_TYPES.arrow);

		const enemies = createEnemyManager(testPath);
		const walker = spawnEnemy(enemies, ENEMY_TYPES.walker);
		walker.pathIndex = 3;

		// Fire once
		updateCombat(grid, enemies, 0.01);
		const hpAfterFirst = walker.hp;

		// Wait full cooldown (arrow fire rate 2.0/sec → 0.5s cooldown)
		updateCombat(grid, enemies, 0.6);
		expect(walker.hp).toBeLessThan(hpAfterFirst);
	});
});

describe('Combat Manager — Enemy Killed', () => {
	it('reports gold from killed enemies', () => {
		const grid = createGrid(makeTestLayout());
		placeTower(grid, 3, 1, TOWER_TYPES.arrow);

		const enemies = createEnemyManager(testPath);
		const walker = spawnEnemy(enemies, ENEMY_TYPES.walker);
		walker.pathIndex = 3;
		walker.hp = 1; // almost dead

		const result = updateCombat(grid, enemies, 1.0);
		expect(result.enemiesKilled).toBeGreaterThanOrEqual(1);
		expect(result.goldEarned).toBeGreaterThan(0);
	});
});
