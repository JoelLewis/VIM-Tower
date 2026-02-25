/**
 * Stage progression — tracks unlocked stages and best scores.
 *
 * Uses localStorage for persistence across browser sessions.
 */

const STORAGE_KEY = 'vim-tower-progress';

export type StageScore = {
	readonly completed: boolean;
	readonly bestKeystrokes: number;
	readonly rating: 'S' | 'A' | 'B' | 'C' | null;
};

export type ProgressData = {
	readonly unlockedStages: number;
	readonly scores: Record<number, StageScore>;
};

function defaultProgress(): ProgressData {
	return {
		unlockedStages: 1,
		scores: {}
	};
}

export function loadProgress(): ProgressData {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return defaultProgress();
		const parsed = JSON.parse(raw) as ProgressData;
		if (typeof parsed.unlockedStages !== 'number') return defaultProgress();
		return parsed;
	} catch {
		return defaultProgress();
	}
}

export function saveProgress(data: ProgressData): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {
		// localStorage may be unavailable (private browsing, quota exceeded)
	}
}

export function calculateRating(keystrokes: number, par: number): 'S' | 'A' | 'B' | 'C' {
	const ratio = keystrokes / par;
	if (ratio <= 1.0) return 'S';
	if (ratio <= 1.5) return 'A';
	if (ratio <= 2.0) return 'B';
	return 'C';
}

export function completeStage(
	progress: ProgressData,
	stageId: number,
	keystrokes: number,
	par: number
): ProgressData {
	const rating = calculateRating(keystrokes, par);
	const existing = progress.scores[stageId];

	const newScore: StageScore = {
		completed: true,
		bestKeystrokes: existing ? Math.min(existing.bestKeystrokes, keystrokes) : keystrokes,
		rating: getBetterRating(existing?.rating ?? null, rating)
	};

	return {
		unlockedStages: Math.max(progress.unlockedStages, stageId + 1),
		scores: { ...progress.scores, [stageId]: newScore }
	};
}

const RATING_ORDER: Record<string, number> = { S: 4, A: 3, B: 2, C: 1 };

function getBetterRating(
	a: 'S' | 'A' | 'B' | 'C' | null,
	b: 'S' | 'A' | 'B' | 'C'
): 'S' | 'A' | 'B' | 'C' {
	if (a === null) return b;
	return (RATING_ORDER[a] >= RATING_ORDER[b]) ? a : b;
}
