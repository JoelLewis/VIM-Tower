/**
 * Enemy manager — spawns, updates, and queries enemies.
 *
 * Enemies move along a pre-computed path (from path-manager).
 * Movement is continuous: pathIndex is the current cell, pathProgress
 * is the fractional progress toward the next cell (0.0 to 1.0).
 */

import type { Enemy, EnemyType } from '$lib/types/game.js';
import type { Point } from './path-manager.js';
import { getPositionOnPath } from './path-manager.js';
import { getEnemyStats } from './enemy-stats.js';

export type EnemyManager = {
	readonly path: Point[];
	readonly enemies: Enemy[];
	nextId: number;
};

export type UpdateResult = {
	reachedExit: Enemy[];
	killed: Enemy[];
};

export function createEnemyManager(path: Point[]): EnemyManager {
	return {
		path,
		enemies: [],
		nextId: 1
	};
}

/** Spawn a new enemy at the start of the path. */
export function spawnEnemy(mgr: EnemyManager, type: EnemyType): Enemy {
	const stats = getEnemyStats(type);
	const enemy: Enemy = {
		id: mgr.nextId++,
		type,
		hp: stats.hp,
		maxHp: stats.hp,
		pathIndex: 0,
		pathProgress: 0,
		speed: stats.speed,
		slowTimer: 0,
		alive: true
	};
	mgr.enemies.push(enemy);
	return enemy;
}

/**
 * Advance all alive enemies along the path.
 * Returns enemies that reached the exit this tick.
 */
export function updateEnemies(mgr: EnemyManager, dt: number): UpdateResult {
	const result: UpdateResult = { reachedExit: [], killed: [] };
	const lastIndex = mgr.path.length - 1;

	for (const enemy of mgr.enemies) {
		if (!enemy.alive) continue;

		// Tick slow timer
		if (enemy.slowTimer > 0) {
			enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
		}

		// Advance along path
		const distance = enemy.speed * dt;
		enemy.pathProgress += distance;

		// Consume whole cells
		while (enemy.pathProgress >= 1.0 && enemy.pathIndex < lastIndex) {
			enemy.pathProgress -= 1.0;
			enemy.pathIndex++;
		}

		// Check if reached exit
		if (enemy.pathIndex >= lastIndex) {
			enemy.pathProgress = 0;
			enemy.pathIndex = lastIndex;
			enemy.alive = false;
			result.reachedExit.push(enemy);
		}
	}

	return result;
}

/** Get all alive enemies within a circular range of a point. */
export function getEnemiesInRange(
	mgr: EnemyManager,
	x: number,
	y: number,
	range: number
): Enemy[] {
	const rangeSq = range * range;
	const result: Enemy[] = [];

	for (const enemy of mgr.enemies) {
		if (!enemy.alive) continue;
		const pos = getPositionOnPath(mgr.path, enemy.pathIndex, enemy.pathProgress);
		const dx = pos.x - x;
		const dy = pos.y - y;
		if (dx * dx + dy * dy <= rangeSq) {
			result.push(enemy);
		}
	}

	return result;
}

/** Apply damage to an enemy. Marks as dead if HP reaches zero. */
export function damageEnemy(enemy: Enemy, damage: number): void {
	enemy.hp = Math.max(0, enemy.hp - damage);
	if (enemy.hp <= 0) {
		enemy.alive = false;
	}
}

/** Get all alive enemies. */
export function getAliveEnemies(mgr: EnemyManager): Enemy[] {
	return mgr.enemies.filter((e) => e.alive);
}

/** Get an enemy by ID. */
export function getEnemy(mgr: EnemyManager, id: number): Enemy | undefined {
	return mgr.enemies.find((e) => e.id === id);
}
