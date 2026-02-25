/**
 * Wave manager — controls enemy spawning within waves.
 *
 * Each wave has one or more spawn groups (enemy type + count + interval).
 * Groups spawn sequentially — all enemies from group 1 first, then group 2, etc.
 */

import type { EnemyType } from '$lib/types/game.js';
import type { EnemyManager } from './enemy-manager.js';
import { spawnEnemy, getAliveEnemies } from './enemy-manager.js';

export type SpawnGroup = {
	readonly type: EnemyType;
	readonly count: number;
	readonly spawnInterval: number; // seconds between spawns
};

export type WaveDefinition = {
	readonly groups: SpawnGroup[];
};

export type WaveManager = {
	readonly waves: WaveDefinition[];
	currentWave: number;
	totalWaves: number;
	active: boolean;
	/** Index of current spawn group within the wave */
	groupIndex: number;
	/** How many enemies have been spawned in the current group */
	spawnedInGroup: number;
	/** Total enemies spawned this wave */
	totalSpawned: number;
	/** Total enemies to spawn this wave */
	totalToSpawn: number;
	/** Timer for spawn interval */
	spawnTimer: number;
};

export function createWaveManager(waves: WaveDefinition[]): WaveManager {
	return {
		waves,
		currentWave: 0,
		totalWaves: waves.length,
		active: false,
		groupIndex: 0,
		spawnedInGroup: 0,
		totalSpawned: 0,
		totalToSpawn: 0,
		spawnTimer: 0
	};
}

/** Start the current wave. Call this when transitioning to combat phase. */
export function startWave(mgr: WaveManager): void {
	if (mgr.currentWave >= mgr.waves.length) return;

	const wave = mgr.waves[mgr.currentWave];
	mgr.active = true;
	mgr.groupIndex = 0;
	mgr.spawnedInGroup = 0;
	mgr.totalSpawned = 0;
	mgr.totalToSpawn = wave.groups.reduce((sum, g) => sum + g.count, 0);
	mgr.spawnTimer = 0;
}

/** Update wave spawning. Call each tick during combat. */
export function updateWave(mgr: WaveManager, enemies: EnemyManager, dt: number): void {
	if (!mgr.active) return;
	if (mgr.currentWave >= mgr.waves.length) return;

	const wave = mgr.waves[mgr.currentWave];
	if (mgr.totalSpawned >= mgr.totalToSpawn) return;

	mgr.spawnTimer += dt;
	const group = wave.groups[mgr.groupIndex];
	if (!group) return;

	// Spawn enemies: first in each group spawns immediately, rest wait for interval
	while (mgr.spawnedInGroup < group.count) {
		if (mgr.spawnedInGroup > 0 && mgr.spawnTimer < group.spawnInterval) break;
		if (mgr.spawnedInGroup > 0) mgr.spawnTimer -= group.spawnInterval;
		spawnEnemy(enemies, group.type);
		mgr.spawnedInGroup++;
		mgr.totalSpawned++;
	}

	// Move to next group if current group is done
	if (mgr.spawnedInGroup >= group.count) {
		mgr.groupIndex++;
		mgr.spawnedInGroup = 0;
		mgr.spawnTimer = 0;
	}
}

/**
 * Check if the current wave is complete:
 * all enemies have been spawned AND all enemies are dead or have exited.
 */
export function isWaveComplete(mgr: WaveManager, enemies: EnemyManager): boolean {
	if (!mgr.active) return false;
	if (mgr.totalSpawned < mgr.totalToSpawn) return false;
	return getAliveEnemies(enemies).length === 0;
}

/** Advance to the next wave. Call after wave completion. */
export function advanceWave(mgr: WaveManager): void {
	mgr.currentWave++;
	mgr.active = false;
}

/** Check if all waves have been completed. */
export function isAllWavesComplete(mgr: WaveManager): boolean {
	return mgr.currentWave >= mgr.totalWaves;
}
