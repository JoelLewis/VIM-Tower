import type { TowerType } from '$lib/types/game.js';

export type TowerStats = {
	readonly name: string;
	readonly char: string;
	readonly cost: number;
	readonly damage: number;
	readonly range: number;
	readonly fireRate: number; // shots per second
	readonly splashRadius: number; // 0 = single target
	readonly chainCount: number; // 0 = no chain
	readonly slowFactor: number; // 1.0 = no slow, 0.5 = half speed
	readonly slowDuration: number; // seconds
	readonly description: string;
};

const TOWER_STATS: Record<TowerType, TowerStats> = {
	arrow: {
		name: 'Arrow',
		char: '>',
		cost: 50,
		damage: 15,
		range: 3,
		fireRate: 2.0,
		splashRadius: 0,
		chainCount: 0,
		slowFactor: 1.0,
		slowDuration: 0,
		description: 'Fast single-target damage'
	},
	cannon: {
		name: 'Cannon',
		char: 'O',
		cost: 100,
		damage: 40,
		range: 2.5,
		fireRate: 0.8,
		splashRadius: 1.5,
		chainCount: 0,
		slowFactor: 1.0,
		slowDuration: 0,
		description: 'Slow AOE splash damage'
	},
	frost: {
		name: 'Frost',
		char: '*',
		cost: 75,
		damage: 0,
		range: 2.5,
		fireRate: 1.5,
		splashRadius: 0,
		chainCount: 0,
		slowFactor: 0.4,
		slowDuration: 2.0,
		description: 'Slows enemies, no damage'
	},
	lightning: {
		name: 'Lightning',
		char: '~',
		cost: 125,
		damage: 25,
		range: 3,
		fireRate: 1.2,
		splashRadius: 0,
		chainCount: 3,
		slowFactor: 1.0,
		slowDuration: 0,
		description: 'Chain damage to multiple enemies'
	}
};

export function getTowerStats(type: TowerType): TowerStats {
	return TOWER_STATS[type];
}

export function getTowerCost(type: TowerType): number {
	return TOWER_STATS[type].cost;
}

export function getSellValue(type: TowerType): number {
	return Math.floor(TOWER_STATS[type].cost * 0.6);
}
