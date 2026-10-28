/**
 * Combat manager — handles tower targeting, firing, and damage application.
 *
 * Each combat tick:
 * 1. Decrease all tower cooldowns
 * 2. For each ready tower, find targets and fire
 * 3. Apply tower-specific behavior (single, AOE, slow, chain)
 * 4. Track kills and gold earned
 */

import type { Enemy, Tower, TowerType } from '$lib/types/game.js';
import type { Grid } from './grid.js';
import type { EnemyManager } from './enemy-manager.js';
import { getEnemiesInRange, damageEnemy } from './enemy-manager.js';
import { getPositionOnPath } from './path-manager.js';
import { getTowerStats } from './tower-stats.js';
import { getEnemyStats } from './enemy-stats.js';

/** A tower hitting (or slowing) an enemy, for the renderer to flash */
export type Shot = {
	readonly towerType: TowerType;
	readonly fromX: number;
	readonly fromY: number;
	readonly toX: number;
	readonly toY: number;
};

export type CombatResult = {
	damageDealt: number;
	enemiesKilled: number;
	goldEarned: number;
	shots: Shot[];
};

/**
 * Run one combat tick. Updates tower cooldowns, fires at enemies,
 * applies damage/effects, and returns summary stats.
 */
export function updateCombat(grid: Grid, enemies: EnemyManager, dt: number): CombatResult {
	const result: CombatResult = {
		damageDealt: 0,
		enemiesKilled: 0,
		goldEarned: 0,
		shots: []
	};

	for (const tower of grid.towers.values()) {
		// Tick cooldown
		tower.cooldownRemaining = Math.max(0, tower.cooldownRemaining - dt);

		// Skip if still on cooldown
		if (tower.cooldownRemaining > 0) continue;

		const stats = getTowerStats(tower.type);

		// Find enemies in range
		const targets = getEnemiesInRange(enemies, tower.x, tower.y, stats.range);
		if (targets.length === 0) continue;

		// Set cooldown for next shot
		tower.cooldownRemaining = 1.0 / stats.fireRate;

		// Apply tower-specific behavior
		let hit: Enemy[] = [];
		switch (tower.type) {
			case 'arrow':
				hit = fireSingleTarget(targets, stats.damage, enemies, result);
				break;
			case 'cannon':
				hit = fireAOE(targets, stats.damage, stats.splashRadius, enemies, result);
				break;
			case 'frost':
				hit = fireFrost(targets, stats.slowFactor, stats.slowDuration, stats.damage);
				break;
			case 'lightning':
				hit = fireChain(targets, stats.damage, stats.chainCount, enemies, result);
				break;
		}
		recordShots(tower, hit, enemies, result);
	}

	return result;
}

/** Arrow: damage the nearest enemy (first in the targets list — closest to tower). */
function fireSingleTarget(
	targets: Enemy[],
	damage: number,
	enemies: EnemyManager,
	result: CombatResult
): Enemy[] {
	// Sort by path progress (most advanced first = nearest to exit)
	const target = pickNearestToExit(targets, enemies);
	if (!target) return [];

	applyDamage(target, damage, result);
	return [target];
}

/** Cannon: damage primary target, then splash all nearby enemies. */
function fireAOE(
	targets: Enemy[],
	damage: number,
	splashRadius: number,
	enemies: EnemyManager,
	result: CombatResult
): Enemy[] {
	const primary = pickNearestToExit(targets, enemies);
	if (!primary) return [];

	// Get position of primary target for splash center
	const primaryPos = getPositionOnPath(enemies.path, primary.pathIndex, primary.pathProgress);

	// Damage all enemies within splash radius of primary target
	const splashTargets = getEnemiesInRange(enemies, primaryPos.x, primaryPos.y, splashRadius);
	for (const target of splashTargets) {
		applyDamage(target, damage, result);
	}

	// If primary wasn't in splash targets (shouldn't happen, but safety), damage it too
	if (!splashTargets.includes(primary)) {
		applyDamage(primary, damage, result);
		return [primary, ...splashTargets];
	}
	return splashTargets;
}

/** Frost: apply slow debuff to all enemies in range. No damage. */
function fireFrost(
	targets: Enemy[],
	slowFactor: number,
	slowDuration: number,
	_damage: number
): Enemy[] {
	for (const target of targets) {
		// Apply slow: reduce speed and set timer
		const baseStats = getEnemyStats(target.type);
		target.speed = baseStats.speed * slowFactor;
		target.slowTimer = slowDuration;
	}
	return targets;
}

/** Lightning: chain damage through N enemies, each jump finding the nearest unchained enemy. */
function fireChain(
	targets: Enemy[],
	damage: number,
	chainCount: number,
	enemies: EnemyManager,
	result: CombatResult
): Enemy[] {
	const hit = new Set<number>();
	const chain: Enemy[] = [];
	let currentTarget = pickNearestToExit(targets, enemies);

	for (let i = 0; i < chainCount && currentTarget; i++) {
		hit.add(currentTarget.id);
		chain.push(currentTarget);
		applyDamage(currentTarget, damage, result);

		// Find next unchained enemy nearest to current target
		const pos = getPositionOnPath(enemies.path, currentTarget.pathIndex, currentTarget.pathProgress);
		const nearby = getEnemiesInRange(enemies, pos.x, pos.y, 2.0);
		currentTarget = nearby.find((e) => !hit.has(e.id) && e.alive) ?? null;
	}
	return chain;
}

/** Record where each hit landed so the renderer can flash it */
function recordShots(tower: Tower, hit: Enemy[], enemies: EnemyManager, result: CombatResult): void {
	for (const enemy of hit) {
		const pos = getPositionOnPath(enemies.path, enemy.pathIndex, enemy.pathProgress);
		result.shots.push({
			towerType: tower.type,
			fromX: tower.x,
			fromY: tower.y,
			toX: Math.round(pos.x),
			toY: Math.round(pos.y)
		});
	}
}

/** Pick the enemy nearest to the exit (highest pathIndex + progress). */
function pickNearestToExit(targets: Enemy[], _enemies: EnemyManager): Enemy | null {
	if (targets.length === 0) return null;
	return targets.reduce((best, e) => {
		const bestProgress = best.pathIndex + best.pathProgress;
		const eProgress = e.pathIndex + e.pathProgress;
		return eProgress > bestProgress ? e : best;
	});
}

/** Apply damage and track kills/gold. */
function applyDamage(enemy: Enemy, damage: number, result: CombatResult): void {
	if (!enemy.alive) return;
	const wasDead = !enemy.alive;
	damageEnemy(enemy, damage);
	result.damageDealt += damage;

	if (!enemy.alive && !wasDead) {
		result.enemiesKilled++;
		result.goldEarned += getEnemyStats(enemy.type).goldReward;
	}
}
