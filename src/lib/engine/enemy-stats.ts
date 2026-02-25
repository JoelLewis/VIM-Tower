import type { EnemyType } from '$lib/types/game.js';

export type EnemyStats = {
	readonly name: string;
	readonly char: string;
	readonly hp: number;
	readonly speed: number; // cells per second
	readonly goldReward: number;
	readonly description: string;
};

const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
	walker: {
		name: 'Walker',
		char: 'W',
		hp: 100,
		speed: 1.5,
		goldReward: 10,
		description: 'Standard speed, standard HP'
	},
	runner: {
		name: 'Runner',
		char: 'R',
		hp: 40,
		speed: 3.0,
		goldReward: 8,
		description: 'Fast, low HP'
	},
	tank: {
		name: 'Tank',
		char: 'T',
		hp: 400,
		speed: 0.8,
		goldReward: 25,
		description: 'Slow, very high HP'
	}
};

export function getEnemyStats(type: EnemyType): EnemyStats {
	return ENEMY_STATS[type];
}
