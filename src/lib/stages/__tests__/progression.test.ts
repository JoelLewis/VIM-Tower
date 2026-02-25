import { describe, it, expect } from 'vitest';
import { calculateRating, completeStage } from '../progression.js';
import type { ProgressData } from '../progression.js';

describe('calculateRating', () => {
	it('returns S when at or below par', () => {
		expect(calculateRating(25, 30)).toBe('S');
		expect(calculateRating(30, 30)).toBe('S');
	});

	it('returns A when within 1.5x par', () => {
		expect(calculateRating(40, 30)).toBe('A');
		expect(calculateRating(45, 30)).toBe('A');
	});

	it('returns B when within 2x par', () => {
		expect(calculateRating(50, 30)).toBe('B');
		expect(calculateRating(60, 30)).toBe('B');
	});

	it('returns C when above 2x par', () => {
		expect(calculateRating(61, 30)).toBe('C');
		expect(calculateRating(100, 30)).toBe('C');
	});
});

describe('completeStage', () => {
	const emptyProgress: ProgressData = {
		unlockedStages: 1,
		scores: {}
	};

	it('unlocks next stage on completion', () => {
		const result = completeStage(emptyProgress, 1, 40, 30);
		expect(result.unlockedStages).toBe(2);
	});

	it('records score and rating', () => {
		const result = completeStage(emptyProgress, 1, 40, 30);
		expect(result.scores[1]).toEqual({
			completed: true,
			bestKeystrokes: 40,
			rating: 'A'
		});
	});

	it('keeps better keystroke count on replay', () => {
		const first = completeStage(emptyProgress, 1, 50, 30);
		const second = completeStage(first, 1, 35, 30);
		expect(second.scores[1].bestKeystrokes).toBe(35);
	});

	it('keeps better rating on replay', () => {
		const first = completeStage(emptyProgress, 1, 25, 30); // S rating
		const second = completeStage(first, 1, 50, 30); // B rating
		expect(second.scores[1].rating).toBe('S'); // keeps S
	});

	it('does not lower unlock count on replay of earlier stage', () => {
		const progress: ProgressData = { unlockedStages: 3, scores: {} };
		const result = completeStage(progress, 1, 40, 30);
		expect(result.unlockedStages).toBe(3);
	});
});
